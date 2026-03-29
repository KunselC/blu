import { useCallback, useMemo, useState } from 'react'
import { DrawingCanvas } from './components/DrawingCanvas'
import { GestureController } from './components/GestureController'
import { PopupMenu } from './components/PopupMenu'
import { VoicePanel } from './components/VoicePanel'
import { useSpeechTranscription } from './hooks/useSpeechTranscription'
import { MODES } from './lib/modes'

function App() {
  const [mode, setMode] = useState(MODES.IDLE)

  const {
    transcript,
    setTranscript,
    isListening,
    error,
    startListening,
    stopListening,
  } = useSpeechTranscription({ active: mode === MODES.VOICE })

  const isMenuOpen = mode === MODES.MENU
  const isDrawing = mode === MODES.DRAWING
  const isVoiceMode = mode === MODES.VOICE

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

      <div className="pointer-events-none absolute left-6 top-6 z-10 h-36 w-56 rounded-2xl bg-slate-900/80 p-4 text-xs text-slate-200 shadow-lg ring-1 ring-slate-700/60">
        <p className="mb-2 font-medium text-slate-100">Camera Feed (Placeholder)</p>
        <div className="flex h-[calc(100%-1.5rem)] items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-800/60 text-center text-[11px] text-slate-400">
          Live gesture camera stream
        </div>
      </div>

      <DrawingCanvas canDraw={isDrawing} />

      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <PopupMenu visible={isMenuOpen} onSelectDraw={activateDraw} onSelectVoice={activateVoice} />
      </div>

      <div className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2">
        {isVoiceMode ? (
          <VoicePanel
            transcript={transcript}
            setTranscript={setTranscript}
            isListening={isListening}
            error={error}
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
    </div>
  )
}

export default App
