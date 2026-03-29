import { useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

export function DrawingCanvas({ canDraw }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    const nextWidth = parent.clientWidth
    const nextHeight = parent.clientHeight
    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)
    canvas.width = nextWidth
    canvas.height = nextHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#1f2937'

    if (imageData) {
      ctx.putImageData(imageData, 0, 0)
    }
  }, [])

  useEffect(() => {
    resizeCanvas()
    const parent = canvasRef.current?.parentElement
    if (!parent) return undefined

    const observer = new ResizeObserver(() => resizeCanvas())
    observer.observe(parent)
    return () => observer.disconnect()
  }, [resizeCanvas])

  const drawFromEvent = (event) => {
    if (!canDraw || !drawingRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handlePointerDown = (event) => {
    if (!canDraw) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    drawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handlePointerUp = () => {
    drawingRef.current = false
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={drawFromEvent}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  )
}

DrawingCanvas.propTypes = {
  canDraw: PropTypes.bool.isRequired,
}
