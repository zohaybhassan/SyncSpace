<template>
  <div class="min-h-screen bg-slate-900">

    <!-- Landing / Join screen -->
    <div v-if="!joined" class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">🔄</div>
          <h1 class="text-3xl font-bold text-white">SyncSpace</h1>
          <p class="text-slate-400 mt-2 text-sm">Real-time collaborative task boards</p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Name</label>
            <input
              v-model="userName"
              class="mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors text-sm"
              placeholder="Enter your name..."
              @keyup.enter="joinOrCreate"
            />
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Board ID (leave blank to create new)</label>
            <input
              v-model="boardIdInput"
              class="mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors text-sm font-mono"
              placeholder="e.g. abc12345"
              @keyup.enter="joinOrCreate"
            />
          </div>

          <button
            @click="joinOrCreate"
            :disabled="!userName.trim() || loading"
            class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {{ boardIdInput.trim() ? 'Join Board' : 'Create New Board' }}
          </button>

          <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Board view -->
    <div v-else class="flex flex-col h-screen">
      <!-- Top bar -->
      <header class="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm flex-shrink-0">
        <div class="flex items-center gap-3">
          <span class="text-lg">🔄</span>
          <input
            v-model="boardNameInput"
            class="bg-transparent font-semibold text-white text-sm outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
            @blur="store.updateBoardName(boardNameInput)"
            @keyup.enter="store.updateBoardName(boardNameInput); $event.target.blur()"
          />
          <!-- Connection indicator -->
          <div class="flex items-center gap-1.5 ml-2">
            <div
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-green-400': connectionState === 'connected',
                'bg-yellow-400 pulse': connectionState === 'reconnecting',
                'bg-slate-500': connectionState === 'connecting' || connectionState === 'disconnected',
              }"
            />
            <span class="text-xs text-slate-400 capitalize">{{ connectionState }}</span>
          </div>
          <!-- Syncing indicator -->
          <span v-if="store.isSyncing" class="text-xs text-indigo-400 animate-pulse">Saving...</span>
        </div>

        <div class="flex items-center gap-3">
          <!-- Share board ID -->
          <div class="hidden sm:flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5">
            <span class="text-xs text-slate-400">Board:</span>
            <code class="text-xs font-mono text-indigo-300">{{ store.board?.id }}</code>
            <button @click="copyBoardId" class="text-slate-400 hover:text-white text-xs transition-colors" title="Copy">
              {{ copied ? '✓' : '⎘' }}
            </button>
          </div>

          <!-- Online users -->
          <PresenceAvatars :users="store.activeUsers" />

          <!-- My avatar -->
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-indigo-500"
            :style="{ background: store.myUser.color }"
            :title="store.myUser.name + ' (you)'"
          >
            {{ store.myUser.name[0]?.toUpperCase() }}
          </div>
        </div>
      </header>

      <!-- Board canvas -->
      <main class="flex-1 overflow-x-auto overflow-y-hidden">
        <div class="flex gap-4 p-4 h-full items-start">
          <!-- Columns -->
          <BoardColumn
            v-for="col in store.columns"
            :key="col.id"
            :column="col"
            :cards="store.cardsByColumn[col.id] || []"
            @add-card="(colId, title) => store.addCard(colId, title)"
            @move-card="handleMoveCard"
            @delete-card="store.deleteCard"
            @open-card="openCard"
            @delete-column="store.deleteColumn"
            @rename-column="(id, title) => store.updateColumn(id, { title })"
          />

          <!-- Add column button -->
          <div class="w-72 flex-shrink-0">
            <div v-if="addingColumn" class="column-bg rounded-xl p-3 space-y-2">
              <input
                v-model="newColumnTitle"
                ref="newColInput"
                class="w-full bg-slate-700/50 border border-indigo-500 rounded-lg p-2 text-sm text-white placeholder-slate-500 outline-none"
                placeholder="Column name..."
                @keyup.enter="submitColumn"
                @keyup.escape="addingColumn = false"
              />
              <div class="flex gap-2">
                <button
                  @click="submitColumn"
                  class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >Add Column</button>
                <button
                  @click="addingColumn = false"
                  class="text-slate-400 hover:text-white text-xs px-2 py-1.5 transition-colors"
                >Cancel</button>
              </div>
            </div>
            <button
              v-else
              @click="startAddColumn"
              class="w-full column-bg rounded-xl py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span class="text-xl leading-none">+</span> Add Column
            </button>
          </div>
        </div>
      </main>
    </div>

    <!-- Card modal -->
    <CardModal
      v-if="activeCard"
      :card="activeCard"
      @update="changes => store.updateCard(activeCard.id, changes)"
      @delete="deleteActiveCard"
      @close="activeCard = null"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useBoardStore } from './stores/boardStore'
import { useSocket } from './composables/useSocket'
import BoardColumn from './components/BoardColumn.vue'
import BoardCard from './components/BoardCard.vue'
import CardModal from './components/CardModal.vue'
import PresenceAvatars from './components/PresenceAvatars.vue'

const store = useBoardStore()
const { connectionState } = useSocket()

// Landing state
const joined = ref(false)
const userName = ref('')
const boardIdInput = ref('')
const loading = ref(false)
const error = ref('')

// Board UI state
const boardNameInput = ref('')
const activeCard = ref(null)
const addingColumn = ref(false)
const newColumnTitle = ref('')
const newColInput = ref(null)
const copied = ref(false)

watch(() => store.board?.name, (n) => { if (n) boardNameInput.value = n })

async function joinOrCreate() {
  if (!userName.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    let boardId = boardIdInput.value.trim()
    if (!boardId) boardId = await store.createBoard('SyncSpace Board')
    await store.loadBoard(boardId, userName.value.trim())
    boardNameInput.value = store.board?.name || ''
    joined.value = true
  } catch (e) {
    error.value = 'Could not connect. Is the server running?'
  } finally {
    loading.value = false
  }
}

function handleMoveCard({ cardId, fromColumnId, toColumnId, newOrder }) {
  store.moveCard(cardId, fromColumnId, toColumnId, newOrder)
}

function openCard(card) {
  activeCard.value = card
}

function deleteActiveCard() {
  store.deleteCard(activeCard.value.id)
  activeCard.value = null
}

function startAddColumn() {
  addingColumn.value = true
  nextTick(() => newColInput.value?.focus())
}

function submitColumn() {
  if (newColumnTitle.value.trim()) {
    store.addColumn(newColumnTitle.value.trim())
    newColumnTitle.value = ''
    addingColumn.value = false
  }
}

async function copyBoardId() {
  await navigator.clipboard.writeText(store.board?.id || '')
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>
