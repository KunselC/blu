/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'

export const GESTURE_STATES = {
  EMPTY: '',
  DRAWING: 'drawing',
  VOICE: 'voice',
  MENU: 'menu',
}

export function resolveGestureState(previousState, fingerCount) {
  const count = Number.isFinite(fingerCount) ? Math.max(0, Math.min(5, fingerCount)) : 0

  if (previousState === GESTURE_STATES.MENU) {
    if (count === 0 || count === 1 || count === 2 || count === 3) return GESTURE_STATES.MENU
    if (count === 5) return GESTURE_STATES.EMPTY
    return previousState
  }

  if (count === 1) return GESTURE_STATES.DRAWING
  if (count === 2) return GESTURE_STATES.VOICE
  if (count === 3) return GESTURE_STATES.MENU
  if (count === 0 || count === 5) return GESTURE_STATES.EMPTY
  return previousState
}

function readFingerCount(payload) {
  const candidates = [
    payload?.fingersHeldUp,
    payload?.fingerCount,
    payload?.fingers_up,
    payload?.count,
  ]
  const rawCount = candidates.find((value) => value !== undefined && value !== null)
  const parsedCount = Number(rawCount)
  return Number.isFinite(parsedCount) ? parsedCount : 0
}

function readGestureState(payload, fingerCount, previousState) {
  const candidate =
    typeof payload?.state === 'string' && Object.values(GESTURE_STATES).includes(payload.state)
      ? payload.state
      : null

  return candidate ?? resolveGestureState(previousState, fingerCount)
}

function readPointerTip(payload) {
  const tip = payload?.pointerTip
  if (!tip || typeof tip !== 'object') return null

  const x = Number(tip.x)
  const y = Number(tip.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  }
}

export function OpenCvGestureBridge({
  statusUrl = 'http://127.0.0.1:8765/status',
  frameUrl = 'http://127.0.0.1:8765/frame.jpg',
  pollInterval = 250,
  onStateChange,
  onFingerCountChange,
  onPointerTipChange,
}) {
  const [gestureState, setGestureState] = useState(GESTURE_STATES.EMPTY)
  const [fingersHeldUp, setFingersHeldUp] = useState(0)
  const [frameToken, setFrameToken] = useState(Date.now())
  const [connectionMessage, setConnectionMessage] = useState('Waiting for Python/OpenCV gesture bridge...')

  useEffect(() => {
    let isMounted = true

    const pollStatus = async () => {
      try {
        const response = await fetch(statusUrl, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json()
        if (!isMounted) return

        const nextFingerCount = readFingerCount(payload)
        const nextPointerTip = readPointerTip(payload)
        setConnectionMessage(payload?.message || 'Connected to Python/OpenCV gesture bridge')
        setFingersHeldUp(nextFingerCount)
        setGestureState((currentState) => readGestureState(payload, nextFingerCount, currentState))
        onPointerTipChange?.(nextPointerTip)
        setFrameToken(payload?.frameToken ?? payload?.updatedAt ?? Date.now())
      } catch {
        if (!isMounted) return
        setConnectionMessage('Waiting for Python/OpenCV gesture bridge...')
        setFingersHeldUp(0)
        setGestureState((currentState) => resolveGestureState(currentState, 0))
        onPointerTipChange?.(null)
      }
    }

    pollStatus()
    const intervalId = window.setInterval(pollStatus, pollInterval)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [onPointerTipChange, pollInterval, statusUrl])

  useEffect(() => {
    onStateChange?.(gestureState)
  }, [gestureState, onStateChange])

  useEffect(() => {
    onFingerCountChange?.(fingersHeldUp)
  }, [fingersHeldUp, onFingerCountChange])

  const frameSrc = useMemo(() => `${frameUrl}?t=${encodeURIComponent(frameToken)}`, [frameToken, frameUrl])

  return (
    <div className="flex h-full min-w-[220px] flex-1 flex-col rounded-2xl bg-slate-900/80 p-4 text-xs text-slate-200 shadow-lg ring-1 ring-slate-700/60">
      <p className="mb-2 font-medium text-slate-100">Gesture Camera</p>
      <div className="relative flex-1 overflow-hidden rounded-xl border border-dashed border-slate-600 bg-slate-800/60">
        <img
          src={frameSrc}
          alt="Hand tracking feed"
          className="h-full w-full object-contain"
          onError={() => {
            setConnectionMessage('Waiting for Python/OpenCV gesture bridge...')
          }}
        />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2">
          <span className="w-fit rounded-lg bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-100">
            State: {gestureState || 'none'}
          </span>
          <span className="w-fit rounded-lg bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-100">
            Fingers held up: {fingersHeldUp}
          </span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-3 py-3 text-[11px] text-slate-300">
          {connectionMessage}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Python bridge feed: <code className="font-mono">{statusUrl}</code>
      </p>
    </div>
  )
}

OpenCvGestureBridge.propTypes = {
  statusUrl: PropTypes.string,
  frameUrl: PropTypes.string,
  pollInterval: PropTypes.number,
  onStateChange: PropTypes.func,
  onFingerCountChange: PropTypes.func,
  onPointerTipChange: PropTypes.func,
}
