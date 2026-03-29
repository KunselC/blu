import { createServer } from 'node:http'
import { Server } from 'socket.io'

const PORT = Number(process.env.PORT ?? 3001)

const sessionState = {
  chatMessages: [],
  drawingSegments: [],
  transcriptionLog: [],
  liveTranscript: '',
}

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

io.on('connection', (socket) => {
  socket.emit('session:snapshot', sessionState)

  socket.on('chat:message', (payload) => {
    sessionState.chatMessages = [...sessionState.chatMessages.slice(-199), payload]
    socket.broadcast.emit('chat:message', payload)
  })

  socket.on('drawing:segment', (payload) => {
    if (!payload?.segment) return
    sessionState.drawingSegments = [...sessionState.drawingSegments.slice(-5999), payload.segment]
    socket.broadcast.emit('drawing:segment', payload)
  })

  socket.on('transcript:append', (payload) => {
    if (typeof payload?.segment !== 'string') return
    const segment = payload.segment.trim()
    if (!segment) return
    sessionState.transcriptionLog = [...sessionState.transcriptionLog.slice(-499), segment]
    socket.broadcast.emit('transcript:append', payload)
  })

  socket.on('transcript:update', (payload) => {
    if (typeof payload?.text !== 'string') return
    sessionState.liveTranscript = payload.text
    socket.broadcast.emit('transcript:update', payload)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on http://0.0.0.0:${PORT}`)
})
