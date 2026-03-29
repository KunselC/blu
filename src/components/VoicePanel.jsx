import { Mic, MicOff } from 'lucide-react'

export function VoicePanel({ transcript, setTranscript, isListening, error, onToggleListening }) {
  return (
    <div className="pointer-events-auto w-[min(90vw,540px)] rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Voice Transcription</h2>
        <button
          type="button"
          onClick={onToggleListening}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700"
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening ? 'Stop' : 'Start'}
        </button>
      </div>
      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="Your spoken words will appear here..."
        className="h-36 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-slate-300"
      />
      {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}
    </div>
  )
}
