import { useEffect } from 'react'

export function GestureController({ onTwoFingerTap, onOneFingerTap, onDrawMode, onVoiceMode, onEscape }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      switch (event.key) {
        case '2':
          onTwoFingerTap()
          break
        case '1':
          onOneFingerTap()
          break
        case 'd':
        case 'D':
          onDrawMode()
          break
        case 'v':
        case 'V':
          onVoiceMode()
          break
        case 'Escape':
          onEscape()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDrawMode, onEscape, onOneFingerTap, onTwoFingerTap, onVoiceMode])

  return null
}
