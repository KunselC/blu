import { useEffect } from 'react'
import PropTypes from 'prop-types'

export function GestureController({
  holdDuration = 900,
  holdDurations,
  onHoldProgress,
  onHoldStateChange,
  onOneFingerHold,
  onTwoFingerHold,
  onFiveFingerHold,
}) {
  useEffect(() => {
    const timers = new Map()
    const starts = new Map()
    const rafs = new Map()

    const getHoldDuration = (fingerCount) => holdDurations?.[fingerCount] ?? holdDuration

    const clearHold = (fingerCount) => {
      const timer = timers.get(fingerCount)
      if (timer) {
        window.clearTimeout(timer)
      }
      const raf = rafs.get(fingerCount)
      if (raf) {
        window.cancelAnimationFrame(raf)
      }
      timers.delete(fingerCount)
      starts.delete(fingerCount)
      rafs.delete(fingerCount)
      onHoldProgress(fingerCount, 0, false)
      onHoldStateChange(fingerCount, false)
    }

    const runProgress = (fingerCount) => {
      const startedAt = starts.get(fingerCount)
      if (!startedAt) return
      const currentHoldDuration = getHoldDuration(fingerCount)
      const elapsed = Date.now() - startedAt
      const progress = Math.min(1, elapsed / currentHoldDuration)
      onHoldProgress(fingerCount, progress, true)
      if (progress < 1) {
        const raf = window.requestAnimationFrame(() => runProgress(fingerCount))
        rafs.set(fingerCount, raf)
      }
    }

    const beginHold = (fingerCount, onComplete) => {
      if (timers.has(fingerCount)) return
      const currentHoldDuration = getHoldDuration(fingerCount)
      const start = Date.now()
      starts.set(fingerCount, start)
      onHoldStateChange(fingerCount, true)
      onHoldProgress(fingerCount, 0, true)
      runProgress(fingerCount)
      const timer = window.setTimeout(() => {
        onComplete()
        onHoldProgress(fingerCount, 1, false)
        clearHold(fingerCount)
      }, currentHoldDuration)
      timers.set(fingerCount, timer)
    }

    const onKeyDown = (event) => {
      if (event.repeat) return
        switch (event.key) {
          case '1':
            beginHold(1, onOneFingerHold)
            break
          case '2':
            beginHold(2, onTwoFingerHold)
            break
          case '5':
            beginHold(5, onFiveFingerHold)
            break
          default:
            break
        }
      }

    const onKeyUp = (event) => {
      if (event.key === '1' || event.key === '2' || event.key === '5') {
        clearHold(Number(event.key))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      ;[1, 2, 5].forEach(clearHold)
    }
  }, [holdDuration, holdDurations, onFiveFingerHold, onHoldProgress, onHoldStateChange, onOneFingerHold, onTwoFingerHold])

  return null
}

GestureController.propTypes = {
  holdDuration: PropTypes.number,
  holdDurations: PropTypes.objectOf(PropTypes.number),
  onHoldProgress: PropTypes.func.isRequired,
  onHoldStateChange: PropTypes.func.isRequired,
  onOneFingerHold: PropTypes.func.isRequired,
  onTwoFingerHold: PropTypes.func.isRequired,
  onFiveFingerHold: PropTypes.func.isRequired,
}
