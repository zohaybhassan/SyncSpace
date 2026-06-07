<template>
  <div class="column-bg rounded-xl flex flex-col w-72 flex-shrink-0 max-h-full">
    <!-- Column header -->
    <div class="flex items-center justify-between px-3 pt-3 pb-2">
      <input
        v-if="editingTitle"
        v-model="titleInput"
        ref="titleInputEl"
        class="bg-transparent text-sm font-semibold text-white outline-none border-b border-indigo-500 flex-1 mr-2"
        @blur="saveTitle"
        @keyup.enter="saveTitle"
        @keyup.escape="editingTitle = false"
      />
      <h3
        v-else
        class="text-sm font-semibold text-slate-200 flex-1 cursor-pointer hover:text-white transition-colors"
        @dblclick="startEditTitle"
      >{{ column.title }}</h3>

      <div class="flex items-center gap-1">
        <span class="text-xs text-slate-500 bg-slate-700/50 rounded-full px-2 py-0.5">
          {{ cards.length }}
        </span>
        <button
          @click="$emit('delete-column', column.id)"
          class="text-slate-500 hover:text-red-400 transition-colors text-xs ml-1 p-0.5 rounded hover:bg-red-400/10"
          title="Delete column"
        >✕</button>
      </div>
    </div>

    <!-- Card list (draggable) -->
    <draggable
      class="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[40px]"
      v-model="localCards"
      :group="{ name: 'cards' }"
      item-key="id"
      ghost-class="sortable-ghost"
      chosen-class="sortable-chosen"
      animation="200"
      @end="onDragEnd"
    >
      <template #item="{ element }">
        <BoardCard
          :card="element"
          @click="$emit('open-card', element)"
          @delete="$emit('delete-card', element.id)"
        />
      </template>
    </draggable>

    <!-- Add card -->
    <div class="px-2 pb-2">
      <div v-if="addingCard" class="space-y-2">
        <input
          v-model="newCardTitle"
          ref="newCardInput"
          class="w-full bg-slate-700/50 border border-indigo-500 rounded-lg p-2 text-sm text-white placeholder-slate-500 outline-none"
          placeholder="Card title..."
          @keyup.enter="submitCard"
          @keyup.escape="addingCard = false"
        />
        <div class="flex gap-2">
          <button
            @click="submitCard"
            class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >Add</button>
          <button
            @click="addingCard = false"
            class="text-slate-400 hover:text-white text-xs px-2 py-1.5 transition-colors"
          >Cancel</button>
        </div>
      </div>
      <button
        v-else
        @click="startAdd"
        class="w-full text-slate-400 hover:text-white hover:bg-white/5 text-sm py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <span class="text-lg leading-none">+</span> Add card
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import draggable from 'vuedraggable'
import BoardCard from './BoardCard.vue'

const props = defineProps({
  column: Object,
  cards: Array,
})
const emit = defineEmits(['add-card', 'move-card', 'delete-card', 'open-card', 'delete-column', 'rename-column'])

const localCards = ref([...props.cards])
watch(() => props.cards, (c) => { localCards.value = [...c] })

// Title editing
const editingTitle = ref(false)
const titleInput = ref(props.column.title)
const titleInputEl = ref(null)

function startEditTitle() {
  titleInput.value = props.column.title
  editingTitle.value = true
  nextTick(() => titleInputEl.value?.focus())
}

function saveTitle() {
  editingTitle.value = false
  if (titleInput.value.trim() && titleInput.value !== props.column.title) {
    emit('rename-column', props.column.id, titleInput.value.trim())
  }
}

// Add card
const addingCard = ref(false)
const newCardTitle = ref('')
const newCardInput = ref(null)

function startAdd() {
  addingCard.value = true
  nextTick(() => newCardInput.value?.focus())
}

function submitCard() {
  if (newCardTitle.value.trim()) {
    emit('add-card', props.column.id, newCardTitle.value.trim())
    newCardTitle.value = ''
    addingCard.value = false
  }
}

// Drag end — compute new position
function onDragEnd(evt) {
  const { item, newIndex, to, from } = evt
  const cardId = item.dataset.id || localCards.value[newIndex]?.id
  if (!cardId) return

  const toColumnId = to.__vue_component_instance__?.props?.column?.id || props.column.id
  const fromColumnId = from.__vue_component_instance__?.props?.column?.id || props.column.id

  emit('move-card', {
    cardId: localCards.value[newIndex]?.id,
    fromColumnId: props.column.id,
    toColumnId: props.column.id,
    newOrder: newIndex,
  })
}
</script>
