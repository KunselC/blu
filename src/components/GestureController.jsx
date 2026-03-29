import { useEffect } from 'react'

export function GestureController({
  onTwoFingerTap,
  onOneFingerTap,
  onDrawMode,
  onVoiceMode,
  onEscape,
  onGestureRecognized,
}) {
  useEffect(() => {
    const onKeyDown = (event) => {
      switch (event.key) {
        case '2':
          onGestureRecognized('two-finger')
          onTwoFingerTap()
          break
        case '1':
          onGestureRecognized('tap')
          onOneFingerTap()
          break
        case 'd':
        case 'D':
          onGestureRecognized('draw')
          onDrawMode()
          break
        case 'v':
        case 'V':
          onGestureRecognized('voice')
          onVoiceMode()
          break
        case 'Escape':
          onGestureRecognized('escape')
          onEscape()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDrawMode, onEscape, onGestureRecognized, onOneFingerTap, onTwoFingerTap, onVoiceMode])

  return null
}
