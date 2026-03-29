import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DrawingCanvas } from './components/DrawingCanvas'
import { GestureController } from './components/GestureController'
import { PopupMenu } from './components/PopupMenu'
import { VoicePanel } from './components/VoicePanel'
import { useSpeechTranscription } from './hooks/useSpeechTranscription'
import { MODES } from './lib/modes'

const TRANSCRIPT_LOG_KEY = 'vboard-transcription-log'
const translateText = (text) => text

function App() {
  const [mode, setMode] = useState(MODES.IDLE)
  const [translateEnabled, setTranslateEnabled] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('es')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [screenShareError, setScreenShareError] = useState('')
  const [splitRatio, setSplitRatio] = useState(0.65)
  const [isDraggingDivider, setIsDraggingDivider] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
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
  const screenStreamRef = useRef(null)

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

  const toggleMenu = useCallback(() => {
    setMode((current) => (current === MODES.MENU ? MODES.IDLE : MODES.MENU))
  }, [])

  const activateDraw = useCallback(() => {
    setMode(MODES.DRAWING)
  }, [])

  const activateVoice = useCallback(() => {
    setMode(MODES.VOICE)
  }, [])

  const handleOneFingerTap = useCallback(() => {
    if (mode === MODES.MENU) {
      setMode(MODES.DRAWING)
      return
    }

    if (mode === MODES.DRAWING || mode === MODES.VOICE) {
      setMode(MODES.IDLE)
    }
  }, [mode])

  const handleEscape = useCallback(() => {
    setMode(MODES.IDLE)
  }, [])

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
        onTwoFingerTap={toggleMenu}
        onOneFingerTap={handleOneFingerTap}
        onDrawMode={activateDraw}
        onVoiceMode={activateVoice}
        onEscape={handleEscape}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.75),_rgba(241,245,249,0.65)_40%,_rgba(226,232,240,0.45))]" />

      <div className="pointer-events-none absolute right-6 top-6 z-20 rounded-xl bg-white/70 px-3 py-2 text-xs shadow-sm ring-1 ring-slate-200 backdrop-blur">
        <p>Mode: {modeLabel}</p>
        <p className="mt-1 text-slate-500">Mock Gestures: [2] menu, [1] tap, [D] draw, [V] voice, [Esc] idle</p>
      </div>

      <div className="absolute inset-0 z-10 flex gap-3 p-4 pb-24">
        <aside className="w-72 rounded-2xl bg-white/80 p-4 shadow ring-1 ring-slate-200 backdrop-blur">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Transcription Log</h2>
          <div className="h-[calc(100vh-9.5rem)] space-y-2 overflow-y-auto rounded-xl bg-white p-3 ring-1 ring-slate-200">
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
        </aside>

        <div ref={splitContainerRef} className="relative flex flex-1">
          <section className="relative rounded-2xl bg-white/40 shadow ring-1 ring-slate-200" style={{ width: `${splitRatio * 100}%` }}>
            <DrawingCanvas canDraw={isDrawing} />

            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <PopupMenu visible={isMenuOpen} onSelectDraw={activateDraw} onSelectVoice={activateVoice} />
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
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-lg ring-1 ring-slate-200">
        <button
          type="button"
          onClick={toggleScreenShare}
          className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          {isScreenSharing ? 'Stop Share' : 'Share Screen'}
        </button>
        <button
          type="button"
          onClick={() => setShowSummaryModal(true)}
          className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          Meeting End
        </button>
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
