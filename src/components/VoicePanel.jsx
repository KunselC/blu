import { Mic, MicOff } from 'lucide-react'
import PropTypes from 'prop-types'

export function VoicePanel({
  transcript,
  setTranscript,
  isListening,
  error,
  onToggleListening,
  translateEnabled,
  onToggleTranslate,
  selectedLanguage,
  onLanguageChange,
  showTranslateToggle = true,
}) {
  const languageOptions = [
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ja', label: 'Japanese' },
  ]

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
      {showTranslateToggle ? (
        <div className="mb-3 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={translateEnabled}
              onChange={(event) => onToggleTranslate(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
            />
            Translate
          </label>
          <select
            value={selectedLanguage}
            onChange={(event) => onLanguageChange(event.target.value)}
            disabled={!translateEnabled}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
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

VoicePanel.propTypes = {
  transcript: PropTypes.string.isRequired,
  setTranscript: PropTypes.func.isRequired,
  isListening: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onToggleListening: PropTypes.func.isRequired,
  translateEnabled: PropTypes.bool.isRequired,
  onToggleTranslate: PropTypes.func.isRequired,
  selectedLanguage: PropTypes.string.isRequired,
  onLanguageChange: PropTypes.func.isRequired,
  showTranslateToggle: PropTypes.bool,
}
