import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Hand, MessageSquareText, X } from 'lucide-react'
import { DrawingCanvas } from './components/DrawingCanvas'
import { GestureController } from './components/GestureController'
import { PopupMenu } from './components/PopupMenu'
import { VoicePanel } from './components/VoicePanel'
import { useSpeechTranscription } from './hooks/useSpeechTranscription'
import { MODES } from './lib/modes'

const TRANSCRIPT_LOG_KEY = 'vboard-transcription-log'
const translateText = (text) => text
const insightTemplates = [
  'Decision-making is converging, with speakers aligning on immediate next steps.',
  'The conversation emphasizes follow-up actions and ownership clarity.',
  'A short recap: active discussion, open questions reduced, direction becoming clearer.',
  'Team focus appears to be narrowing around implementation details and timing.',
]

function App() {
  const [mode, setMode] = useState(MODES.IDLE)
  const [translateEnabled, setTranslateEnabled] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('es')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [screenShareError, setScreenShareError] = useState('')
  const [splitRatio, setSplitRatio] = useState(0.65)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [isSplitScreen, setIsSplitScreen] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [, setTranscriptMoments] = useState([])
  const [liveInsight, setLiveInsight] = useState('Listening for context to generate live insights...')
  const [gestureFeedback, setGestureFeedback] = useState({ label: 'Idle', active: false })
  const [holdProgress, setHoldProgress] = useState({ 1: 0, 2: 0, 3: 0 })
  const [activeHoldFingerCount, setActiveHoldFingerCount] = useState(0)
  const [drawHoldActive, setDrawHoldActive] = useState(false)
  const [showVoiceTranslateToggle, setShowVoiceTranslateToggle] = useState(false)
  const [transcriptionLog, setTranscriptionLog] = useState(() => {
    const raw = window.localStorage.getItem(TRANSCRIPT_LOG_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw)
    } catch (error) {
      console.error('Failed to parse transcription history', error)
      return []
    }
  })
  const screenVideoRef = useRef(null)
  const splitContainerRef = useRef(null)
  const transcriptionLogRef = useRef(null)
  const screenStreamRef = useRef(null)
  const gestureTimeoutRef = useRef(null)

  const {
    transcript,
    setTranscript,
    isListening,
    error,
    startListening,
    stopListening,
  } = useSpeechTranscription({ active: mode === MODES.VOICE })

  const displayTranscript = useMemo(
    () => (translateEnabled ? translateText(transcript) : transcript),
    [transcript, translateEnabled],
  )

  const isMenuOpen = mode === MODES.MENU
  const isDrawing = mode === MODES.DRAWING
  const isVoiceMode = mode === MODES.VOICE

  useEffect(() => {
    window.localStorage.setItem(TRANSCRIPT_LOG_KEY, JSON.stringify(transcriptionLog))
  }, [transcriptionLog])

  useEffect(() => {
    const latestText = displayTranscript.trim()
    if (!latestText) return

    setTranscriptionLog((currentLog) =>
      currentLog[currentLog.length - 1] === latestText ? currentLog : [...currentLog, latestText],
    )
  }, [displayTranscript])

  useEffect(
    () => () => {
      if (gestureTimeoutRef.current) {
        window.clearTimeout(gestureTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const latestText = displayTranscript.trim()
    if (!latestText) return

    setTranscriptMoments((current) => {
      const now = Date.now()
      if (current[current.length - 1]?.text === latestText) {
        return current
      }
      return [...current, { text: latestText, timestamp: now }].slice(-120)
    })
  }, [displayTranscript])

  useEffect(() => {
    const logElement = transcriptionLogRef.current
    if (logElement) {
      logElement.scrollTop = logElement.scrollHeight
    }
  }, [transcriptionLog])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now()
      setTranscriptMoments((current) => {
        const filtered = current.filter((item) => now - item.timestamp <= 60000)
        const recentSnippets = filtered.filter((item) => now - item.timestamp <= 30000).map((item) => item.text)
        const mockSummary = insightTemplates[Math.floor(Math.random() * insightTemplates.length)]
        if (recentSnippets.length === 0) {
          setLiveInsight(mockSummary)
          return filtered
        }
        const latestSnippet = recentSnippets[recentSnippets.length - 1]
        setLiveInsight(`${mockSummary} Latest: "${latestSnippet.slice(0, 80)}${latestSnippet.length > 80 ? '…' : ''}"`)
        return filtered
      })
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current
    }
  }, [isScreenSharing])

  useEffect(() => {
    if (!isDraggingDivider) return undefined

    const onPointerMove = (event) => {
      const container = splitContainerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const nextRatio = (event.clientX - rect.left) / rect.width
      const boundedRatio = Math.min(0.8, Math.max(0.2, nextRatio))
      setSplitRatio(boundedRatio)
    }

    const onPointerUp = () => setIsDraggingDivider(false)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [isDraggingDivider])

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setIsScreenSharing(false)
  }, [])

  useEffect(() => () => stopScreenShare(), [stopScreenShare])

  const startScreenShare = useCallback(async () => {
    try {
      setScreenShareError('')
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenStreamRef.current = stream
      setIsScreenSharing(true)
      const [track] = stream.getVideoTracks()
      if (track) {
        track.onended = () => stopScreenShare()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setScreenShareError(`Screen share failed: ${message}`)
      setIsScreenSharing(false)
    }
  }, [stopScreenShare])

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare()
      return
    }
    startScreenShare()
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  const activateDraw = useCallback(() => {
    setMode(MODES.DRAWING)
  }, [])

  const activateVoice = useCallback(() => {
    setMode(MODES.VOICE)
  }, [])

  const setGestureFlash = useCallback((label) => {
    setGestureFeedback({ label, active: true })
    if (gestureTimeoutRef.current) {
      window.clearTimeout(gestureTimeoutRef.current)
    }
    gestureTimeoutRef.current = window.setTimeout(
      () => setGestureFeedback((current) => ({ ...current, active: false })),
      1200,
    )
  }, [])

  const handleThreeFingerHold = useCallback(() => {
    setMode((current) => (current === MODES.IDLE ? MODES.MENU : MODES.IDLE))
    setDrawHoldActive(false)
    setGestureFlash('3-finger hold')
  }, [setGestureFlash])

  const handleOneFingerHold = useCallback(() => {
    setMode((current) => {
      if (current === MODES.MENU) {
        setGestureFlash('Draw selected')
        return MODES.DRAWING
      }
      return current
    })
  }, [setGestureFlash])

  const handleTwoFingerHold = useCallback(() => {
    setMode((current) => {
      if (current === MODES.MENU) {
        setShowVoiceTranslateToggle(true)
        setGestureFlash('Voice selected')
        return MODES.VOICE
      }
      return current
    })
  }, [setGestureFlash])

  const sendChatMessage = useCallback(() => {
    const nextMessage = chatInput.trim()
    if (!nextMessage) return
    setChatMessages((current) => [...current, { id: Date.now(), text: nextMessage }])
    setChatInput('')
  }, [chatInput])

  const handleEscape = useCallback(() => {
    handleThreeFingerHold()
    setGestureFlash('3-finger hold (Esc)')
  }, [handleThreeFingerHold, setGestureFlash])

  const modeLabel = useMemo(() => {
    switch (mode) {
      case MODES.DRAWING:
        return 'DRAWING'
      case MODES.VOICE:
        return 'VOICE'
      case MODES.MENU:
        return 'MENU'
      default:
        return 'IDLE'
    }
  }, [mode])

  useEffect(() => {
    if (mode !== MODES.DRAWING) {
      setDrawHoldActive(false)
    }
    if (mode !== MODES.VOICE) {
      setShowVoiceTranslateToggle(false)
    }
  }, [mode])

  const summaryText = useMemo(() => {
    const recentItems = transcriptionLog.slice(-5)
    const bulletPoints =
      recentItems.length > 0
        ? recentItems.map((item) => `- ${item}`).join('\n')
        : '- No conversation captured yet.'
    return `Summary of Conversation:\n${bulletPoints}`
  }, [transcriptionLog])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700">
      <GestureController
        holdDuration={900}
        onOneFingerHold={handleOneFingerHold}
        onTwoFingerHold={handleTwoFingerHold}
        onThreeFingerHold={handleThreeFingerHold}
        onEscapeHold={handleEscape}
        onHoldStateChange={(fingerCount, isActive) => {
          setActiveHoldFingerCount((current) => (isActive ? fingerCount : current === fingerCount ? 0 : current))
          if (fingerCount === 1 && mode === MODES.DRAWING) {
            setDrawHoldActive(isActive)
          }
        }}
        onHoldProgress={(fingerCount, progress) => {
          setHoldProgress((current) => ({ ...current, [fingerCount]: progress }))
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.75),_rgba(241,245,249,0.65)_40%,_rgba(226,232,240,0.45))]" />

      <div className="absolute inset-x-0 top-0 z-30 border-b border-slate-200/70 bg-white/85 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700">Global Mode: {modeLabel}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ring-1 transition ${
                gestureFeedback.active ? 'bg-emerald-100 text-emerald-700 ring-emerald-300' : 'bg-white text-slate-500 ring-slate-200'
              }`}
            >
              <Hand size={12} />
              {gestureFeedback.label}
            </span>
          </div>
          <p className="text-slate-500">Hold: [3] toggle/exit, [1] draw, [2] voice, [Esc] = 3-finger fallback</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {[1, 2, 3].map((count) => (
            <div
              key={count}
              className={`relative overflow-hidden rounded-md border px-2 py-1 text-[11px] ${
                activeHoldFingerCount === count ? 'border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500'
              }`}
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-emerald-200/40 transition-all duration-100"
                style={{ width: `${Math.max(0, Math.min(100, holdProgress[count] * 100))}%` }}
              />
              <span className="relative z-10">{count}-finger hold</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-16 top-14 z-10 flex gap-3 p-4">
        <aside className="flex w-72 min-h-0 flex-col rounded-2xl bg-white/80 p-4 shadow ring-1 ring-slate-200 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Caption Log</h2>
          <div
            ref={transcriptionLogRef}
            className="max-h-[44vh] min-h-[170px] space-y-2 overflow-y-auto rounded-xl bg-white p-3 ring-1 ring-slate-200"
          >
            {transcriptionLog.length === 0 ? (
              <p className="text-xs text-slate-400">No transcriptions yet.</p>
            ) : (
              transcriptionLog.map((entry, index) => (
                <p key={`${entry}-${index}`} className="text-xs text-slate-600">
                  {entry}
                </p>
              ))
            )}
          </div>
          <div className="mt-3 flex-1 rounded-xl bg-slate-900/90 p-3 text-[11px] text-slate-200 ring-1 ring-slate-700">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Live Insights</p>
            <p>{liveInsight}</p>
          </div>
        </aside>

        <div ref={splitContainerRef} className="relative flex flex-1">
          <section className="relative rounded-2xl bg-white/40 shadow ring-1 ring-slate-200" style={{ width: `${splitRatio * 100}%` }}>
            <DrawingCanvas canDraw={isDrawing && drawHoldActive} />

            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <PopupMenu
                visible={isMenuOpen}
                onSelectDraw={activateDraw}
                onSelectVoice={activateVoice}
                oneFingerProgress={holdProgress[1]}
                twoFingerProgress={holdProgress[2]}
                activeFingerCount={activeHoldFingerCount}
              />
            </div>

            <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
              {isVoiceMode ? (
                <VoicePanel
                  transcript={displayTranscript}
                  setTranscript={setTranscript}
                  isListening={isListening}
                  error={error}
                  translateEnabled={translateEnabled}
                  onToggleTranslate={setTranslateEnabled}
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  showTranslateToggle={showVoiceTranslateToggle || activeHoldFingerCount === 2}
                  onToggleListening={() => {
                    if (isListening) {
                      stopListening()
                    } else {
                      startListening()
                    }
                  }}
                />
              ) : null}
            </div>
          </section>

          {isSplitScreen ? (
            <>
              <button
                type="button"
                onPointerDown={() => setIsDraggingDivider(true)}
                className="z-30 mx-2 my-1 w-2 cursor-col-resize rounded-full bg-slate-300/80 hover:bg-slate-400"
                aria-label="Resize split screen"
              />

              <section className="flex min-w-[220px] flex-1 flex-col rounded-2xl bg-slate-900/80 p-4 text-xs text-slate-200 shadow-lg ring-1 ring-slate-700/60">
                <p className="mb-2 font-medium text-slate-100">{isScreenSharing ? 'Screen Share' : 'Camera Feed (Placeholder)'}</p>
                <div className="relative flex-1 overflow-hidden rounded-xl border border-dashed border-slate-600 bg-slate-800/60">
                  {isScreenSharing ? (
                    <video ref={screenVideoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-[11px] text-slate-400">
                      Live gesture camera stream
                    </div>
                  )}
                </div>
                {screenShareError ? <p className="mt-2 text-[11px] text-rose-300">{screenShareError}</p> : null}
              </section>
            </>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsChatOpen((current) => !current)}
        className="absolute right-4 top-1/2 z-40 -translate-y-1/2 rounded-xl bg-white/90 p-3 text-slate-700 shadow ring-1 ring-slate-200"
      >
        <MessageSquareText size={16} />
      </button>

      <aside
        className={`absolute bottom-4 right-4 z-40 flex h-[min(62vh,460px)] w-[min(90vw,320px)] flex-col rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-200 transition-transform duration-300 ${
          isChatOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700">Chat</h3>
          <button type="button" onClick={() => setIsChatOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100">
          {chatMessages.length === 0 ? <p className="text-xs text-slate-400">No messages yet.</p> : null}
          {chatMessages.map((message) => (
            <div key={message.id} className="ml-auto max-w-[85%] rounded-lg bg-slate-700 px-2 py-1 text-xs text-white">
              {message.text}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                sendChatMessage()
              }
            }}
            placeholder="Type message…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-300"
          />
          <button type="button" onClick={sendChatMessage} className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-white">
            Send
          </button>
        </div>
      </aside>

      <div className="absolute inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-fit items-center gap-3">
        <button
          type="button"
          onClick={toggleScreenShare}
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {isScreenSharing ? 'Stop Share' : 'Share Screen'}
        </button>
        <button
          type="button"
          onClick={() => setIsSplitScreen((current) => !current)}
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {isSplitScreen ? 'Split Screen: On' : 'Split Screen: Off'}
        </button>
        <button
          type="button"
          onClick={() => setShowSummaryModal(true)}
          className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          Meeting End
        </button>
        </div>
      </div>

      {showSummaryModal ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-[min(90vw,560px)] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <h3 className="mb-3 text-base font-semibold text-slate-800">Summary of Conversation</h3>
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{summaryText}</pre>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
