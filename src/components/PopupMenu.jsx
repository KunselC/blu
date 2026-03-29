import { MessageSquareText, PencilLine } from 'lucide-react'

function MenuButton({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-white/80 px-5 py-4 text-left text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
    >
      <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
        <Icon size={20} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  )
}

export function PopupMenu({ visible, onSelectDraw, onSelectVoice }) {
  if (!visible) return null

  return (
    <div className="pointer-events-auto rounded-3xl bg-white/70 p-5 shadow-xl shadow-slate-500/10 backdrop-blur-md ring-1 ring-slate-200">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Gesture Menu</p>
      <div className="flex min-w-[300px] flex-col gap-3">
        <MenuButton
          icon={PencilLine}
          title="Draw"
          description="Activate one-finger drawing mode"
          onClick={onSelectDraw}
        />
        <MenuButton
          icon={MessageSquareText}
          title="Voice Transcription"
          description="Capture and display spoken text"
          onClick={onSelectVoice}
        />
      </div>
    </div>
  )
}
