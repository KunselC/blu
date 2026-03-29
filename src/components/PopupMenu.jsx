import { MessageSquareText, PencilLine } from 'lucide-react'
import PropTypes from 'prop-types'

function MenuButton({ icon: Icon, title, description, onClick, progress = 0, active = false }) {
  const normalizedProgress = Math.max(0, Math.min(1, progress))
  const circumference = 2 * Math.PI * 16
  const dashOffset = circumference * (1 - normalizedProgress)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-white/80 px-5 py-4 text-left text-slate-700 shadow-sm ring-1 transition hover:bg-white ${
        active ? 'ring-emerald-300 shadow-emerald-200/40' : 'ring-slate-200'
      }`}
    >
      <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="3" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="rgb(16, 185, 129)"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <Icon size={20} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  )
}

export function PopupMenu({
  visible,
  onSelectChat,
  onSelectShareScreen,
  oneFingerProgress,
  twoFingerProgress,
  activeFingerCount,
}) {
  if (!visible) return null

  return (
    <div className="pointer-events-auto rounded-3xl bg-white/70 p-5 shadow-xl shadow-slate-500/10 backdrop-blur-md ring-1 ring-slate-200">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Gesture Menu</p>
      <div className="flex min-w-[300px] flex-col gap-3">
        <MenuButton
          icon={MessageSquareText}
          title="Chat"
          description="Hold one finger for one second to open chat"
          onClick={onSelectChat}
          progress={oneFingerProgress}
          active={activeFingerCount === 1}
        />
        <MenuButton
          icon={PencilLine}
          title="Share Screen"
          description="Hold two fingers for one second to start screen share"
          onClick={onSelectShareScreen}
          progress={twoFingerProgress}
          active={activeFingerCount === 2}
        />
      </div>
    </div>
  )
}

MenuButton.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  progress: PropTypes.number,
  active: PropTypes.bool,
}

PopupMenu.propTypes = {
  visible: PropTypes.bool.isRequired,
  onSelectChat: PropTypes.func.isRequired,
  onSelectShareScreen: PropTypes.func.isRequired,
  oneFingerProgress: PropTypes.number,
  twoFingerProgress: PropTypes.number,
  activeFingerCount: PropTypes.number,
}
