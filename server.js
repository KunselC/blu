import { createServer } from 'node:http'
import { Server } from 'socket.io'

const PORT = Number(process.env.PORT ?? 3001)

const sessionState = {
  chatMessages: [],
  drawingSegments: [],
  transcriptionLog: [],
  liveTranscripts: {},
  participantStates: {},
}

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})

io.on('connection', (socket) => {
  socket.emit('session:snapshot', sessionState)

  socket.on('participant:join', (payload) => {
    if (typeof payload?.senderId !== 'string') return
    const participant = {
      senderId: payload.senderId,
      role: payload?.role === 'host' ? 'host' : 'join',
      cameraFrame: sessionState.participantStates[payload.senderId]?.cameraFrame ?? null,
      pointerTip: sessionState.participantStates[payload.senderId]?.pointerTip ?? null,
      gestureState: sessionState.participantStates[payload.senderId]?.gestureState ?? '',
      fingersHeldUp: sessionState.participantStates[payload.senderId]?.fingersHeldUp ?? 0,
    }
    sessionState.participantStates[payload.senderId] = participant
    socket.data.senderId = payload.senderId
    io.emit('participant:upsert', participant)
  })

  socket.on('participant:state', (payload) => {
    if (typeof payload?.senderId !== 'string') return
    const currentParticipant = sessionState.participantStates[payload.senderId] ?? {
      senderId: payload.senderId,
      role: payload?.role === 'host' ? 'host' : 'join',
      cameraFrame: null,
      pointerTip: null,
      gestureState: '',
      fingersHeldUp: 0,
    }
    const nextParticipant = {
      ...currentParticipant,
      role: payload?.role === 'host' ? 'host' : currentParticipant.role,
      pointerTip: payload?.pointerTip ?? null,
      gestureState: typeof payload?.gestureState === 'string' ? payload.gestureState : currentParticipant.gestureState,
      fingersHeldUp: Number.isFinite(payload?.fingersHeldUp) ? payload.fingersHeldUp : currentParticipant.fingersHeldUp,
    }
    sessionState.participantStates[payload.senderId] = nextParticipant
    socket.broadcast.emit('participant:upsert', nextParticipant)
  })

  socket.on('camera:frame', (payload) => {
    if (typeof payload?.senderId !== 'string') return
    const currentParticipant = sessionState.participantStates[payload.senderId] ?? {
      senderId: payload.senderId,
      role: payload?.role === 'host' ? 'host' : 'join',
      cameraFrame: null,
      pointerTip: null,
      gestureState: '',
      fingersHeldUp: 0,
    }
    const nextParticipant = {
      ...currentParticipant,
      cameraFrame: typeof payload?.frame === 'string' ? payload.frame : null,
      role: payload?.role === 'host' ? 'host' : currentParticipant.role,
    }
    sessionState.participantStates[payload.senderId] = nextParticipant
    socket.broadcast.emit('participant:upsert', nextParticipant)
  })

  socket.on('chat:message', (payload) => {
    sessionState.chatMessages = [...sessionState.chatMessages.slice(-199), payload]
    socket.broadcast.emit('chat:message', payload)
  })

  socket.on('drawing:segment', (payload) => {
    if (!payload?.segment) return
    sessionState.drawingSegments = [...sessionState.drawingSegments.slice(-5999), payload.segment]
    socket.broadcast.emit('drawing:segment', payload)
  })

  socket.on('drawing:clear', () => {
    sessionState.drawingSegments = []
    io.emit('drawing:clear')
  })

  socket.on('transcript:append', (payload) => {
    if (typeof payload?.segment !== 'string') return
    const segment = payload.segment.trim()
    if (!segment) return
    sessionState.transcriptionLog = [
      ...sessionState.transcriptionLog.slice(-499),
      {
        senderId: payload?.senderId ?? 'participant',
        role: payload?.role === 'host' ? 'host' : 'join',
        segment,
      },
    ]
    socket.broadcast.emit('transcript:append', payload)
  })

  socket.on('transcript:update', (payload) => {
    if (typeof payload?.senderId !== 'string' || typeof payload?.text !== 'string') return
    sessionState.liveTranscripts[payload.senderId] = {
      senderId: payload.senderId,
      role: payload?.role === 'host' ? 'host' : 'join',
      text: payload.text,
    }
    socket.broadcast.emit('transcript:update', payload)
  })

  socket.on('disconnect', () => {
    const senderId = socket.data.senderId
    if (!senderId) return
    delete sessionState.participantStates[senderId]
    delete sessionState.liveTranscripts[senderId]
    socket.broadcast.emit('participant:remove', { senderId })
    socket.broadcast.emit('transcript:remove', { senderId })
  })
})

httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on http://0.0.0.0:${PORT}`)
})
