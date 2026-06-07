import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { useSocket } from '../composables/useSocket'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const useBoardStore = defineStore('board', () => {
  const socket = useSocket()

  // State
  const board = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const activeUsers = ref([])
  const myUser = ref({ id: '', name: '', color: '' })
  const pendingMutations = ref([]) // optimistic queue
  const isSyncing = ref(false)

  // Getters
  const columns = computed(() => {
    if (!board.value) return []
    return [...board.value.columns].sort((a, b) => a.order - b.order)
  })

  const cardsByColumn = computed(() => {
    if (!board.value) return {}
    const map = {}
    for (const col of board.value.columns) {
      map[col.id] = board.value.cards
        .filter(c => c.columnId === col.id)
        .sort((a, b) => a.order - b.order)
    }
    return map
  })

  // Initialize user identity
  function initUser(name) {
    const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#06b6d4','#8b5cf6','#ec4899','#f97316']
    myUser.value = {
      id: socket.socketId() || uuidv4(),
      name: name || 'Anonymous',
      color: colors[Math.floor(Math.random() * colors.length)]
    }
  }

  // Load board from REST, then join via socket
  async function loadBoard(boardId, userName) {
    loading.value = true
    error.value = null
    try {
      const { data } = await axios.get(`${API}/api/board/${boardId}`)
      board.value = data
    } catch (e) {
      error.value = 'Could not load board'
    } finally {
      loading.value = false
    }

    initUser(userName)
    socket.connect()
    joinBoard(boardId)
    setupSocketListeners(boardId)

    // Re-join on reconnect
    socket.onReconnect(() => joinBoard(boardId))
  }

  function joinBoard(boardId) {
    socket.emit('join_board', { boardId, user: myUser.value })
  }

  function setupSocketListeners(boardId) {
    // Full state sync (on join or re-sync)
    socket.on('board_state', (state) => {
      board.value = state
      pendingMutations.value = []
      isSyncing.value = false
    })

    // Another client's mutation applied — update our state
    socket.on('mutation_applied', ({ state }) => {
      board.value = state
    })

    // Our mutation confirmed by server
    socket.on('mutation_confirmed', ({ state }) => {
      board.value = state
      // Remove from pending queue
      if (pendingMutations.value.length > 0) pendingMutations.value.shift()
      isSyncing.value = false
    })

    // Server rejected our mutation — rollback to server state
    socket.on('mutation_rejected', ({ reason }) => {
      console.warn('[Board] Mutation rejected:', reason)
      isSyncing.value = false
      pendingMutations.value = []
    })

    socket.on('presence_update', ({ users }) => {
      activeUsers.value = users.filter(u => u.id !== socket.socketId())
    })
  }

  // Send mutation with optimistic update
  function sendMutation(type, payload) {
    if (!board.value) return

    const mutation = {
      id: uuidv4(),
      type,
      payload,
      clientVersion: board.value.version,
      timestamp: Date.now(),
    }

    // Apply optimistically
    applyOptimistic(mutation)

    // Queue and send
    pendingMutations.value.push(mutation)
    isSyncing.value = true
    socket.emit('mutation', { boardId: board.value.id, mutation })
  }

  // Optimistic local state update (mirrors server logic)
  function applyOptimistic(mutation) {
    const { type, payload } = mutation
    if (!board.value) return

    switch (type) {
      case 'ADD_CARD':
        board.value.cards.push({
          id: payload.id,
          columnId: payload.columnId,
          title: payload.title,
          description: payload.description || '',
          order: board.value.cards.filter(c => c.columnId === payload.columnId).length,
          color: payload.color || '#6366f1',
          createdAt: Date.now(),
        })
        break

      case 'UPDATE_CARD': {
        const card = board.value.cards.find(c => c.id === payload.id)
        if (card) Object.assign(card, payload.changes)
        break
      }

      case 'DELETE_CARD':
        board.value.cards = board.value.cards.filter(c => c.id !== payload.id)
        break

      case 'MOVE_CARD': {
        const card = board.value.cards.find(c => c.id === payload.cardId)
        if (!card) break
        board.value.cards = board.value.cards.filter(c => c.id !== payload.cardId)

        const destCards = board.value.cards
          .filter(c => c.columnId === payload.toColumnId)
          .sort((a, b) => a.order - b.order)
        destCards.splice(payload.newOrder, 0, { ...card, columnId: payload.toColumnId })
        destCards.forEach((c, i) => { c.order = i })

        if (payload.fromColumnId !== payload.toColumnId) {
          board.value.cards
            .filter(c => c.columnId === payload.fromColumnId)
            .sort((a, b) => a.order - b.order)
            .forEach((c, i) => { c.order = i })
        }

        const others = board.value.cards.filter(
          c => c.columnId !== payload.toColumnId && c.columnId !== payload.fromColumnId
        )
        const src = payload.fromColumnId !== payload.toColumnId
          ? board.value.cards.filter(c => c.columnId === payload.fromColumnId)
          : []
        board.value.cards = [...others, ...src, ...destCards]
        break
      }

      case 'ADD_COLUMN':
        board.value.columns.push({ id: payload.id, title: payload.title, order: board.value.columns.length })
        break

      case 'UPDATE_COLUMN': {
        const col = board.value.columns.find(c => c.id === payload.id)
        if (col) Object.assign(col, payload.changes)
        break
      }

      case 'DELETE_COLUMN':
        board.value.columns = board.value.columns.filter(c => c.id !== payload.id)
        board.value.cards = board.value.cards.filter(c => c.columnId !== payload.id)
        break

      case 'UPDATE_BOARD_NAME':
        board.value.name = payload.name
        break
    }
  }

  // Action helpers
  function addCard(columnId, title, color) {
    sendMutation('ADD_CARD', { id: uuidv4(), columnId, title, color })
  }

  function updateCard(id, changes) {
    sendMutation('UPDATE_CARD', { id, changes })
  }

  function deleteCard(id) {
    sendMutation('DELETE_CARD', { id })
  }

  function moveCard(cardId, fromColumnId, toColumnId, newOrder) {
    sendMutation('MOVE_CARD', { cardId, fromColumnId, toColumnId, newOrder })
  }

  function addColumn(title) {
    sendMutation('ADD_COLUMN', { id: uuidv4(), title })
  }

  function updateColumn(id, changes) {
    sendMutation('UPDATE_COLUMN', { id, changes })
  }

  function deleteColumn(id) {
    sendMutation('DELETE_COLUMN', { id })
  }

  function updateBoardName(name) {
    sendMutation('UPDATE_BOARD_NAME', { name })
  }

  // Create new board via REST
  async function createBoard(name) {
    const { data } = await axios.post(`${API}/api/board`, { name })
    return data.boardId
  }

  return {
    board, loading, error, activeUsers, myUser, isSyncing,
    columns, cardsByColumn,
    loadBoard, createBoard,
    addCard, updateCard, deleteCard, moveCard,
    addColumn, updateColumn, deleteColumn, updateBoardName,
  }
})
