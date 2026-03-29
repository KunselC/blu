import { MessageSquareText, Monitor } from 'lucide-react'
import PropTypes from 'prop-types'

function HoldRing({ progress }) {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const degrees = clampedProgress * 360

  return (
    <span className="pointer-events-none absolute right-4 top-1/2 z-20 h-12 w-12 -translate-y-1/2">
      <span className="absolute inset-0 rounded-full bg-emerald-100/95 ring-2 ring-emerald-300 shadow-md shadow-emerald-300/40" />
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(rgb(16 185 129) ${degrees}deg, rgb(167 243 208 / 0.25) ${degrees}deg 360deg)`,
        }}
      />
      <span className="absolute inset-[4px] rounded-full bg-white/95" />
      <span className="absolute inset-[10px] rounded-full bg-emerald-50 ring-1 ring-emerald-300/80" />
    </span>
  )
}

function MenuButton({ icon: Icon, title, description, onClick, progress = 0, active = false }) {
  const clampedProgress = Math.max(0, Math.min(1, progress))

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-white/80 px-5 py-4 pr-20 text-left text-slate-700 shadow-sm ring-1 transition hover:bg-white ${
        active ? 'ring-emerald-300 shadow-emerald-200/40' : 'ring-slate-200'
      }`}
    >
      {active ? <HoldRing progress={clampedProgress} /> : null}
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-emerald-200/40 transition-all duration-100"
        style={{ width: `${clampedProgress * 100}%` }}
      />
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="relative rounded-xl bg-slate-100 p-2 text-slate-600 ring-1 ring-slate-200/70">
          <Icon size={20} />
        </span>
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

HoldRing.propTypes = {
  progress: PropTypes.number.isRequired,
}

PopupMenu.propTypes = {
  visible: PropTypes.bool.isRequired,
  onSelectChat: PropTypes.func.isRequired,
  onSelectScreenShare: PropTypes.func.isRequired,
  oneFingerProgress: PropTypes.number,
  twoFingerProgress: PropTypes.number,
  activeFingerCount: PropTypes.number,
}
