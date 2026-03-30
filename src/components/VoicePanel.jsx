import { Check, Copy, Mic, MicOff } from "lucide-react";
import PropTypes from "prop-types";

export function VoicePanel({
  transcript,
  setTranscript,
  isListening,
  error,
  onToggleListening,
  translateEnabled,
  onToggleTranslate,
  spokenLanguage,
  onSpokenLanguageChange,
  targetLanguage,
  onTargetLanguageChange,
  latestTranslation,
  isTranslatingLatest,
  onCopyLatestTranslation,
  copiedLatest,
  showTranslateToggle = true,
}) {
  const spokenLanguageOptions = [
    { value: "en", speechCode: "en-US", label: "English" },
    { value: "es", speechCode: "es-ES", label: "Spanish" },
    { value: "fr", speechCode: "fr-FR", label: "French" },
    { value: "de", speechCode: "de-DE", label: "German" },
    { value: "ja", speechCode: "ja-JP", label: "Japanese" },
  ];

  const targetLanguageOptions = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "ja", label: "Japanese" },
  ];

  return (
    <div className="pointer-events-auto w-[min(90vw,540px)] rounded-2xl bg-white/80 p-4 shadow-lg backdrop-blur ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Voice Transcription
        </h2>
        <button
          type="button"
          onClick={onToggleListening}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700"
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening ? "Stop" : "Start"}
        </button>
      </div>
      {showTranslateToggle ? (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <span className="min-w-20">Speaking in</span>
            <select
              value={spokenLanguage}
              onChange={(event) => onSpokenLanguageChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {spokenLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={translateEnabled}
                onChange={(event) => onToggleTranslate(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
              />
              Translate
            </label>
            <span className="text-xs text-slate-600">to</span>
            <select
              value={targetLanguage}
              onChange={(event) => onTargetLanguageChange(event.target.value)}
              disabled={!translateEnabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {targetLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <textarea
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder="Your spoken words will appear here..."
        className="h-36 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-slate-300"
      />
      {isTranslatingLatest ? (
        <p className="mt-2 text-xs text-slate-500">
          Translating latest voice content...
        </p>
      ) : null}
      {latestTranslation ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-800">
              Latest Translation
            </p>
            <button
              type="button"
              onClick={onCopyLatestTranslation}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200"
            >
              {copiedLatest ? <Check size={12} /> : <Copy size={12} />}
              {copiedLatest ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-emerald-900">{latestTranslation}</p>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}

VoicePanel.propTypes = {
  transcript: PropTypes.string.isRequired,
  setTranscript: PropTypes.func.isRequired,
  isListening: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onToggleListening: PropTypes.func.isRequired,
  translateEnabled: PropTypes.bool.isRequired,
  onToggleTranslate: PropTypes.func.isRequired,
  spokenLanguage: PropTypes.string.isRequired,
  onSpokenLanguageChange: PropTypes.func.isRequired,
  targetLanguage: PropTypes.string.isRequired,
  onTargetLanguageChange: PropTypes.func.isRequired,
  latestTranslation: PropTypes.string,
  isTranslatingLatest: PropTypes.bool.isRequired,
  onCopyLatestTranslation: PropTypes.func.isRequired,
  copiedLatest: PropTypes.bool.isRequired,
  showTranslateToggle: PropTypes.bool,
};
