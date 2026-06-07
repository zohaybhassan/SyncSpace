<template>
  <div
    class="card-shadow rounded-lg p-3 cursor-grab active:cursor-grabbing select-none transition-all duration-150 hover:translate-y-[-1px] group"
    :style="{ background: cardBg, borderLeft: `3px solid ${card.color}` }"
    @click="$emit('click')"
  >
    <!-- Color strip + title -->
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm font-medium text-white leading-snug flex-1">{{ card.title }}</p>
      <button
        @click.stop="$emit('delete')"
        class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all text-xs p-0.5 rounded"
        title="Delete card"
      >✕</button>
    </div>

    <!-- Description preview -->
    <p v-if="card.description" class="text-xs text-slate-400 mt-1.5 line-clamp-2">
      {{ card.description }}
    </p>

    <!-- Footer -->
    <div class="flex items-center justify-between mt-2">
      <span
        class="text-xs px-2 py-0.5 rounded-full font-medium"
        :style="{ background: card.color + '22', color: card.color }"
      >
        {{ colorLabel }}
      </span>
      <span class="text-xs text-slate-500">{{ timeAgo }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ card: Object })
defineEmits(['click', 'delete'])

const cardBg = 'rgba(255,255,255,0.06)'

const colorLabels = {
  '#6366f1': 'Feature',
  '#f59e0b': 'Review',
  '#10b981': 'Done',
  '#ef4444': 'Bug',
  '#06b6d4': 'Dev',
  '#8b5cf6': 'Design',
  '#ec4899': 'UX',
  '#f97316': 'Urgent',
}

const colorLabel = computed(() => colorLabels[props.card.color] || 'Task')

const timeAgo = computed(() => {
  if (!props.card.createdAt) return ''
  const diff = Date.now() - props.card.createdAt
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
})
</script>
