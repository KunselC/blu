import { MessageSquareText, Monitor } from 'lucide-react'
import PropTypes from 'prop-types'

function MenuButton({ icon: Icon, title, description, onClick, progress = 0, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-white/80 px-5 py-4 text-left text-slate-700 shadow-sm ring-1 transition hover:bg-white ${
        active ? 'ring-emerald-300 shadow-emerald-200/40' : 'ring-slate-200'
      }`}
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-emerald-200/40 transition-all duration-100"
        style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
      />
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

export function PopupMenu({ visible, onSelectChat, onSelectScreenShare, oneFingerProgress, twoFingerProgress, activeFingerCount }) {
  if (!visible) return null

  return (
    <div className="pointer-events-auto rounded-3xl bg-white/35 p-5 shadow-xl shadow-slate-500/10 backdrop-blur-md ring-1 ring-white/50">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Gesture Menu</p>
      <div className="flex min-w-[300px] flex-col gap-3">
        <MenuButton
          icon={MessageSquareText}
          title="Chat"
          description="1-finger hold in menu"
          onClick={onSelectChat}
          progress={oneFingerProgress}
          active={activeFingerCount === 1}
        />
        <MenuButton
          icon={Monitor}
          title="Screen Share"
          description="2-finger hold in menu"
          onClick={onSelectScreenShare}
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
  onSelectScreenShare: PropTypes.func.isRequired,
  oneFingerProgress: PropTypes.number,
  twoFingerProgress: PropTypes.number,
  activeFingerCount: PropTypes.number,
}
