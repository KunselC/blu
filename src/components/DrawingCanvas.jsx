import { useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

const drawSegment = (ctx, segment, width, height) => {
  const fromX = segment.from.x * width
  const fromY = segment.from.y * height
  const toX = segment.to.x * width
  const toY = segment.to.y * height
  ctx.strokeStyle = segment.color ?? '#1f2937'
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
}

export function DrawingCanvas({ canDraw, segments, onSegmentDraw, enablePointerInput = false }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const lastRenderedCountRef = useRef(0)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    const nextWidth = parent.clientWidth
    const nextHeight = parent.clientHeight
    canvas.width = nextWidth
    canvas.height = nextHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    segments.forEach((segment) => drawSegment(ctx, segment, canvas.width, canvas.height))
    lastRenderedCountRef.current = segments.length
  }, [segments])

  useEffect(() => {
    resizeCanvas()
    const parent = canvasRef.current?.parentElement
    if (!parent) return undefined

    const observer = new ResizeObserver(() => resizeCanvas())
    observer.observe(parent)
    return () => observer.disconnect()
  }, [resizeCanvas])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (segments.length < lastRenderedCountRef.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      segments.forEach((segment) => drawSegment(ctx, segment, canvas.width, canvas.height))
      lastRenderedCountRef.current = segments.length
      return
    }
    segments.slice(lastRenderedCountRef.current).forEach((segment) => drawSegment(ctx, segment, canvas.width, canvas.height))
    lastRenderedCountRef.current = segments.length
  }, [segments])

  const drawFromEvent = (event) => {
    if (!enablePointerInput || !canDraw || !drawingRef.current) return

    const canvas = canvasRef.current
    if (!canvas || !lastPointRef.current) return

    const rect = canvas.getBoundingClientRect()
    const currentPoint = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
    onSegmentDraw({
      from: lastPointRef.current,
      to: currentPoint,
    })
    lastPointRef.current = currentPoint
  }

  const handlePointerDown = (event) => {
    if (!enablePointerInput || !canDraw) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))

    drawingRef.current = true
    lastPointRef.current = { x, y }
  }

  const handlePointerUp = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${canDraw && enablePointerInput ? 'cursor-crosshair' : 'cursor-default'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={drawFromEvent}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  )
}

DrawingCanvas.propTypes = {
  canDraw: PropTypes.bool.isRequired,
  segments: PropTypes.arrayOf(
    PropTypes.shape({
      from: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
      }).isRequired,
      to: PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired,
      }).isRequired,
    }),
  ).isRequired,
  onSegmentDraw: PropTypes.func.isRequired,
  enablePointerInput: PropTypes.bool,
}
