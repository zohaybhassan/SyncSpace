import { ref, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

let socket = null
const connectionState = ref('disconnected') // disconnected | connecting | connected | reconnecting
const listeners = new Map()

export function useSocket() {
  function connect() {
    if (socket?.connected) return

    connectionState.value = 'connecting'
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    })

    socket.on('connect', () => {
      connectionState.value = 'connected'
      console.log('[Socket] Connected:', socket.id)
      // Re-emit pending rejoins
      listeners.get('_reconnect')?.forEach(fn => fn())
    })

    socket.on('disconnect', (reason) => {
      connectionState.value = 'reconnecting'
      console.warn('[Socket] Disconnected:', reason)
    })

    socket.on('reconnect', (attempt) => {
      connectionState.value = 'connected'
      console.log('[Socket] Reconnected after', attempt, 'attempts')
    })

    socket.on('reconnect_attempt', () => {
      connectionState.value = 'reconnecting'
    })

    socket.on('connect_error', () => {
      connectionState.value = 'reconnecting'
    })
  }

  function emit(event, data) {
    if (!socket) connect()
    socket.emit(event, data)
  }

  function on(event, fn) {
    if (!socket) connect()
    socket.on(event, fn)
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(fn)
  }

  function off(event, fn) {
    socket?.off(event, fn)
    listeners.get(event)?.delete(fn)
  }

  function onReconnect(fn) {
    if (!listeners.has('_reconnect')) listeners.set('_reconnect', new Set())
    listeners.get('_reconnect').add(fn)
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    connectionState.value = 'disconnected'
  }

  return { connect, emit, on, off, onReconnect, disconnect, connectionState, socketId: () => socket?.id }
}
