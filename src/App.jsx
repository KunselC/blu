import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Hand, MessageSquareText, X } from 'lucide-react'
import { io } from 'socket.io-client'
import { DrawingCanvas } from './components/DrawingCanvas'
import { GestureController } from './components/GestureController'
import { GESTURE_STATES, OpenCvGestureBridge } from './components/OpenCvGestureBridge'
import { PopupMenu } from './components/PopupMenu'
import { VoicePanel } from './components/VoicePanel'
import { useSpeechTranscription } from './hooks/useSpeechTranscription'
import { MODES } from './lib/modes'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001'
const GESTURE_EXIT_PULSE_URL = import.meta.env.VITE_GESTURE_EXIT_PULSE_URL ?? 'http://127.0.0.1:8765/pulse-exit'
const DEFAULT_HOLD_DURATION = 900
const CHAT_SELECTION_HOLD_DURATION = 3000
const MAX_DRAW_SEGMENTS = 6000
const MAX_CHAT_MESSAGES = 200
const MAX_TRANSCRIPT_LOG = 500
const translateText = (text) => text

function App() {
  const [mode, setMode] = useState(MODES.IDLE)
  const [translateEnabled, setTranslateEnabled] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('es')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [screenShareError, setScreenShareError] = useState('')
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [drawingSegments, setDrawingSegments] = useState([])
  const [transcriptionLog, setTranscriptionLog] = useState([])
  const [gestureFeedback, setGestureFeedback] = useState({ label: 'Idle', active: false })
  const [holdProgress, setHoldProgress] = useState({ 1: 0, 2: 0, 5: 0 })
  const [activeHoldFingerCount, setActiveHoldFingerCount] = useState(0)
  const [showVoiceTranslateToggle, setShowVoiceTranslateToggle] = useState(false)
  const [gestureState, setGestureState] = useState(GESTURE_STATES.EMPTY)
  const [fingersHeldUp, setFingersHeldUp] = useState(0)
  const [pointerTip, setPointerTip] = useState(null)
  const [clientId] = useState(() => `client-${Math.random().toString(36).slice(2, 10)}`)
  const screenVideoRef = useRef(null)
  const transcriptionLogRef = useRef(null)
  const screenStreamRef = useRef(null)
  const gestureTimeoutRef = useRef(null)
  const bridgeHoldRef = useRef({ fingerCount: 0, startAt: 0, timerId: null, rafId: null })
  const lastBridgeGestureRef = useRef(GESTURE_STATES.EMPTY)
  const lastFingerDrawPointRef = useRef(null)
  const socketRef = useRef(null)
  const lastTranscriptRef = useRef('')
  const applyingRemoteTranscriptRef = useRef(false)
  const getHoldDurationForFinger = useCallback(
    (fingerCount) => (fingerCount === 1 ? CHAT_SELECTION_HOLD_DURATION : DEFAULT_HOLD_DURATION),
    [],
  )

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
  const isChatMode = mode === MODES.CHAT

  useEffect(
    () => () => {
      if (gestureTimeoutRef.current) {
        window.clearTimeout(gestureTimeoutRef.current)
      }
      if (bridgeHoldRef.current.timerId) {
        window.clearTimeout(bridgeHoldRef.current.timerId)
      }
      if (bridgeHoldRef.current.rafId) {
        window.cancelAnimationFrame(bridgeHoldRef.current.rafId)
      }
    },
    [],
  )

  useEffect(() => {
    const logElement = transcriptionLogRef.current
    if (logElement) {
      logElement.scrollTop = logElement.scrollHeight
    }
  }, [transcriptionLog])

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current = null
    setIsScreenSharing(false)
    setMode((current) => (current === MODES.SCREEN_SHARE ? MODES.IDLE : current))
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
    } catch (shareError) {
      const message = shareError instanceof Error ? shareError.message : String(shareError)
      setScreenShareError(`Screen share failed: ${message}`)
      setIsScreenSharing(false)
      setMode((current) => (current === MODES.SCREEN_SHARE ? MODES.IDLE : current))
    }
  }, [stopScreenShare])

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current
    }
  }, [isScreenSharing])

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('session:snapshot', (snapshot) => {
      setChatMessages(Array.isArray(snapshot.chatMessages) ? snapshot.chatMessages : [])
      setDrawingSegments(Array.isArray(snapshot.drawingSegments) ? snapshot.drawingSegments : [])
      setTranscriptionLog(Array.isArray(snapshot.transcriptionLog) ? snapshot.transcriptionLog : [])
      if (typeof snapshot.liveTranscript === 'string') {
        applyingRemoteTranscriptRef.current = true
        setTranscript(snapshot.liveTranscript)
        lastTranscriptRef.current = snapshot.liveTranscript
      }
    })

    socket.on('chat:message', (payload) => {
      if (payload?.senderId === clientId) return
      setChatMessages((current) => [...current.slice(-(MAX_CHAT_MESSAGES - 1)), payload])
    })

    socket.on('drawing:segment', (payload) => {
      if (payload?.senderId === clientId || !payload?.segment) return
      setDrawingSegments((current) => [...current.slice(-(MAX_DRAW_SEGMENTS - 1)), payload.segment])
    })

    socket.on('transcript:append', (payload) => {
      if (payload?.senderId === clientId || typeof payload?.segment !== 'string') return
      const nextSegment = payload.segment.trim()
      if (!nextSegment) return
      setTranscriptionLog((current) => [...current.slice(-(MAX_TRANSCRIPT_LOG - 1)), nextSegment])
    })

    socket.on('transcript:update', (payload) => {
      if (payload?.senderId === clientId || typeof payload?.text !== 'string') return
      applyingRemoteTranscriptRef.current = true
      setTranscript(payload.text)
      lastTranscriptRef.current = payload.text
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [clientId, setTranscript])

  useEffect(() => {
    const latestText = displayTranscript.trim()
    if (applyingRemoteTranscriptRef.current) {
      applyingRemoteTranscriptRef.current = false
      return
    }

    const previousText = lastTranscriptRef.current.trim()
    if (!latestText) {
      lastTranscriptRef.current = ''
      return
    }
    if (latestText === previousText) return

    const nextSegment = previousText && latestText.startsWith(previousText)
      ? latestText.slice(previousText.length).trim()
      : latestText
    if (nextSegment) {
      setTranscriptionLog((currentLog) => [...currentLog.slice(-(MAX_TRANSCRIPT_LOG - 1)), nextSegment])
      socketRef.current?.emit('transcript:append', { segment: nextSegment, senderId: clientId })
    }
    socketRef.current?.emit('transcript:update', { text: latestText, senderId: clientId })
    lastTranscriptRef.current = latestText
  }, [displayTranscript, clientId])

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

  const clearBridgeHold = useCallback(() => {
    if (bridgeHoldRef.current.timerId) {
      window.clearTimeout(bridgeHoldRef.current.timerId)
    }
    if (bridgeHoldRef.current.rafId) {
      window.cancelAnimationFrame(bridgeHoldRef.current.rafId)
    }
    const fingerCount = bridgeHoldRef.current.fingerCount
    bridgeHoldRef.current = { fingerCount: 0, startAt: 0, timerId: null, rafId: null }
    if (fingerCount) {
      setHoldProgress((current) => ({ ...current, [fingerCount]: 0 }))
      setActiveHoldFingerCount((current) => (current === fingerCount ? 0 : current))
    }
  }, [])

  const pulseExitGesture = useCallback(async () => {
    try {
      await fetch(GESTURE_EXIT_PULSE_URL, { method: 'POST' })
    } catch {
      // Keep exit behavior working even if the local bridge is unavailable.
    }
  }, [])

  const exitToBaseState = useCallback(() => {
    clearBridgeHold()
    pulseExitGesture()
    setActiveHoldFingerCount(0)
    setHoldProgress({ 1: 0, 2: 0, 5: 0 })
    stopScreenShare()
    setMode(MODES.IDLE)
    setShowVoiceTranslateToggle(false)
    setShowSummaryModal(false)
  }, [clearBridgeHold, pulseExitGesture, stopScreenShare])

  const handleFiveFingerHold = useCallback(() => {
    exitToBaseState()
    setGestureFlash('5-finger exit')
  }, [exitToBaseState, setGestureFlash])

  const handleOneFingerHold = useCallback(() => {
    if (mode !== MODES.MENU) return
    setGestureFlash('Chat selected')
    setMode(MODES.CHAT)
  }, [mode, setGestureFlash])

  const handleScreenShareSelection = useCallback(() => {
    if (mode !== MODES.MENU) return
    setGestureFlash('Screen share selected')
    setMode(MODES.SCREEN_SHARE)
    startScreenShare()
  }, [mode, setGestureFlash, startScreenShare])

  const handleChatSelection = useCallback(() => {
    if (mode !== MODES.MENU) return
    setGestureFlash('Chat selected')
    setMode(MODES.CHAT)
  }, [mode, setGestureFlash])

  const handleTwoFingerHold = useCallback(() => {
    handleScreenShareSelection()
  }, [handleScreenShareSelection])

  const startBridgeHold = useCallback((fingerCount) => {
    if (![1, 2, 5].includes(fingerCount)) {
      clearBridgeHold()
      return
    }

    if (bridgeHoldRef.current.fingerCount === fingerCount && bridgeHoldRef.current.timerId) {
      return
    }

    clearBridgeHold()
    const holdDuration = getHoldDurationForFinger(fingerCount)
    const startedAt = Date.now()

    const updateProgress = () => {
      const elapsed = Date.now() - startedAt
      const progress = Math.min(1, elapsed / holdDuration)
      setHoldProgress((current) => ({ ...current, [fingerCount]: progress }))
      if (progress < 1) {
        bridgeHoldRef.current.rafId = window.requestAnimationFrame(updateProgress)
      }
    }

    bridgeHoldRef.current = {
      fingerCount,
      startAt: startedAt,
      rafId: window.requestAnimationFrame(updateProgress),
      timerId: window.setTimeout(() => {
        if (fingerCount === 1) handleOneFingerHold()
        if (fingerCount === 2) handleTwoFingerHold()
        if (fingerCount === 5) handleFiveFingerHold()
        clearBridgeHold()
      }, holdDuration),
    }

    setActiveHoldFingerCount(fingerCount)
    setHoldProgress((current) => ({ ...current, [fingerCount]: 0 }))
  }, [clearBridgeHold, getHoldDurationForFinger, handleFiveFingerHold, handleOneFingerHold, handleTwoFingerHold])

  const sendChatMessage = useCallback(() => {
    const nextMessage = chatInput.trim()
    if (!nextMessage) return
    const payload = { id: Date.now(), text: nextMessage, senderId: clientId }
    setChatMessages((current) => [...current.slice(-(MAX_CHAT_MESSAGES - 1)), payload])
    socketRef.current?.emit('chat:message', payload)
    setChatInput('')
  }, [chatInput, clientId])

  const handleSegmentDraw = useCallback((segment) => {
    setDrawingSegments((current) => [...current.slice(-(MAX_DRAW_SEGMENTS - 1)), segment])
    socketRef.current?.emit('drawing:segment', { segment, senderId: clientId })
  }, [clientId])

  useEffect(() => {
    if (!isDrawing || fingersHeldUp !== 1 || !pointerTip) {
      lastFingerDrawPointRef.current = null
      return
    }

    if (!lastFingerDrawPointRef.current) {
      lastFingerDrawPointRef.current = pointerTip
      return
    }

    const deltaX = pointerTip.x - lastFingerDrawPointRef.current.x
    const deltaY = pointerTip.y - lastFingerDrawPointRef.current.y
    if (Math.hypot(deltaX, deltaY) < 0.003) {
      return
    }

    handleSegmentDraw({
      from: lastFingerDrawPointRef.current,
      to: pointerTip,
    })
    lastFingerDrawPointRef.current = pointerTip
  }, [fingersHeldUp, handleSegmentDraw, isDrawing, pointerTip])

  const modeLabel = useMemo(() => {
    switch (mode) {
      case MODES.DRAWING:
        return 'DRAWING'
      case MODES.VOICE:
        return 'VOICE'
      case MODES.MENU:
        return 'MENU'
      case MODES.CHAT:
        return 'CHAT'
      case MODES.SCREEN_SHARE:
        return 'SCREEN SHARE'
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

  useEffect(() => {
    if (!isMenuOpen) {
      clearBridgeHold()
      return
    }

    if ([1, 2, 5].includes(fingersHeldUp)) {
      startBridgeHold(fingersHeldUp)
      return
    }

    clearBridgeHold()
  }, [clearBridgeHold, fingersHeldUp, isMenuOpen, startBridgeHold])

  useEffect(() => {
    if (mode === MODES.CHAT || mode === MODES.SCREEN_SHARE) {
      lastBridgeGestureRef.current = gestureState
      return
    }

    if (gestureState === lastBridgeGestureRef.current) return

    if (gestureState === GESTURE_STATES.DRAWING) {
      setMode(MODES.DRAWING)
      setGestureFlash('1 finger: drawing')
    } else if (gestureState === GESTURE_STATES.VOICE) {
      setShowVoiceTranslateToggle(true)
      setMode(MODES.VOICE)
      setGestureFlash('2 fingers: voice')
    } else if (gestureState === GESTURE_STATES.MENU) {
      setMode(MODES.MENU)
      setGestureFlash('3 fingers: menu')
    } else if (gestureState === GESTURE_STATES.EMPTY) {
      setMode((current) => (current === MODES.DRAWING || current === MODES.VOICE || current === MODES.MENU ? MODES.IDLE : current))
    }

    lastBridgeGestureRef.current = gestureState
  }, [gestureState, mode, setGestureFlash])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700">
      <GestureController
        holdDuration={DEFAULT_HOLD_DURATION}
        holdDurations={{ 1: CHAT_SELECTION_HOLD_DURATION }}
        onOneFingerHold={handleOneFingerHold}
        onTwoFingerHold={handleTwoFingerHold}
        onFiveFingerHold={handleFiveFingerHold}
        onHoldStateChange={(fingerCount, isActive) => {
          setActiveHoldFingerCount((current) => (isActive ? fingerCount : current === fingerCount ? 0 : current))
        }}
        onHoldProgress={(fingerCount, progress) => {
          setHoldProgress((current) => ({ ...current, [fingerCount]: progress }))
        }}
      />

      <div className="absolute inset-x-0 top-3 z-30 flex justify-center">
        <div className="rounded-full bg-white/35 px-5 py-2 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-white/50 backdrop-blur-md">
          Global Mode: {modeLabel}
        </div>
      </div>

      <main className="h-full px-4 pb-20 pt-14">
        <div className="grid h-full grid-cols-[280px_minmax(0,1fr)_320px] gap-4">
          <aside className="flex min-h-0 flex-col rounded-2xl bg-white/35 p-4 shadow ring-1 ring-white/50 backdrop-blur-md">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Caption Log</h2>
            <div ref={transcriptionLogRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl bg-white/60 p-3 ring-1 ring-white/60">
              {transcriptionLog.length === 0 ? (
                <p className="text-xs text-slate-500">No transcriptions yet.</p>
              ) : (
                transcriptionLog.map((entry, index) => (
                  <p key={`${entry}-${index}`} className="rounded-lg bg-white/80 px-2 py-1 text-xs text-slate-700">
                    {entry}
                  </p>
                ))
              )}
            </div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl bg-white/60 p-2 ring-1 ring-white/60">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">Chat</h3>
                <MessageSquareText size={14} className={isChatMode ? 'text-emerald-600' : 'text-slate-500'} />
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-white/80 p-2">
                {chatMessages.length === 0 ? <p className="text-xs text-slate-500">No messages yet.</p> : null}
                {chatMessages.map((message) => (
                  <div
                    key={`${message.id}-${message.senderId ?? 'sender'}`}
                    className={`max-w-[90%] rounded-lg px-2 py-1 text-xs ${
                      message.senderId === clientId
                        ? 'ml-auto bg-slate-700 text-white'
                        : 'mr-auto bg-white text-slate-700 ring-1 ring-slate-200'
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') sendChatMessage()
                  }}
                  placeholder="Type message…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-300"
                />
                <button type="button" onClick={sendChatMessage} className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-white">
                  Send
                </button>
              </div>
            </div>
          </aside>

          <section className="relative min-h-0 rounded-2xl bg-white/40 shadow ring-1 ring-white/50 backdrop-blur-md">
            <h2 className="absolute left-4 top-3 z-20 text-xs font-semibold uppercase tracking-wide text-slate-600">Whiteboard</h2>
            <DrawingCanvas canDraw={isDrawing} segments={drawingSegments} onSegmentDraw={handleSegmentDraw} />
            {pointerTip ? (
              <div className="pointer-events-none absolute inset-0 z-20">
                <div
                  className="absolute"
                  style={{
                    left: `${pointerTip.x * 100}%`,
                    top: `${pointerTip.y * 100}%`,
                    transform: 'translate(-50%, -90%)',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                    <path
                      d="M14 3.5c1.2 0 2.3.7 2.9 1.8l7.1 13c1 1.8-.3 4.1-2.4 4.1H6.4c-2.1 0-3.4-2.3-2.4-4.1l7.1-13A3.3 3.3 0 0 1 14 3.5Z"
                      fill="rgba(16, 185, 129, 0.88)"
                      stroke="rgba(5, 150, 105, 0.95)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 7.5 19 17H9l5-9.5Z"
                      fill="rgba(236, 253, 245, 0.9)"
                      stroke="none"
                    />
                  </svg>
                </div>
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <PopupMenu
                visible={isMenuOpen}
                onSelectChat={handleChatSelection}
                onSelectScreenShare={handleScreenShareSelection}
                oneFingerProgress={holdProgress[1]}
                twoFingerProgress={holdProgress[2]}
                activeFingerCount={activeHoldFingerCount}
              />
            </div>
            <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
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
                    if (isListening) stopListening()
                    else startListening()
                  }}
                />
              ) : null}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-2xl bg-slate-900/80 p-4 text-xs text-slate-200 shadow-lg ring-1 ring-slate-700/60">
            <h2 className="mb-2 font-semibold text-slate-100">Camera Feed</h2>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-dashed border-slate-600 bg-slate-800/60">
              {isScreenSharing ? (
                <video ref={screenVideoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
              ) : isChatMode ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-slate-300">
                  <div>
                    <p className="text-sm font-medium text-slate-100">Chat mode active</p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      The gesture camera is paused while the text chat is open.
                    </p>
                    <button
                      type="button"
                      onClick={exitToBaseState}
                      className="mt-4 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white ring-1 ring-slate-600"
                    >
                      Exit Chat
                    </button>
                  </div>
                </div>
              ) : (
                <OpenCvGestureBridge
                  onStateChange={setGestureState}
                  onFingerCountChange={setFingersHeldUp}
                  onPointerTipChange={setPointerTip}
                />
              )}
            </div>
            {isScreenSharing ? (
              <button
                type="button"
                onClick={exitToBaseState}
                className="mt-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white ring-1 ring-slate-600"
              >
                Stop Sharing
              </button>
            ) : null}
            {screenShareError ? <p className="mt-2 text-[11px] text-rose-300">{screenShareError}</p> : null}
          </section>
        </div>
      </main>

      <div className="absolute inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-fit items-center gap-3">
          <button type="button" onClick={() => setMode(MODES.MENU)} className="rounded-xl bg-white/65 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-white/80">
            Open Menu
          </button>
          <button type="button" onClick={() => setMode(MODES.DRAWING)} className="rounded-xl bg-white/65 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-white/80">
            Drawing Mode
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVoiceTranslateToggle(true)
              setMode(MODES.VOICE)
            }}
            className="rounded-xl bg-white/65 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-white/80"
          >
            Voice Mode
          </button>
          <button type="button" onClick={() => setShowSummaryModal(true)} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-white">
            Meeting End
          </button>
          <span
            className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs ring-1 ${
              gestureFeedback.active ? 'bg-emerald-100 text-emerald-700 ring-emerald-300' : 'bg-white/65 text-slate-600 ring-white/80'
            }`}
          >
            <Hand size={13} />
            {gestureFeedback.label} (OpenCV live, keys 1/2/5 simulate menu holds)
          </span>
        </div>
      </div>

      {showSummaryModal ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-[min(90vw,560px)] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Summary of Conversation</h3>
              <button type="button" onClick={() => setShowSummaryModal(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X size={14} />
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{summaryText}</pre>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
