<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')" />
      <div class="relative bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl z-10">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-slate-700">
          <div
            class="w-3 h-3 rounded-full flex-shrink-0"
            :style="{ background: localCard.color }"
          />
          <input
            v-model="localCard.title"
            class="flex-1 mx-3 bg-transparent text-white font-semibold text-lg outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
            placeholder="Card title..."
            @blur="save"
          />
          <button @click="$emit('close')" class="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>

        <!-- Body -->
        <div class="p-4 space-y-4">
          <!-- Description -->
          <div>
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</label>
            <textarea
              v-model="localCard.description"
              rows="4"
              class="mt-1.5 w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 resize-none transition-colors"
              placeholder="Add a description..."
              @blur="save"
            />
          </div>

          <!-- Color picker -->
          <div>
            <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Label Color</label>
            <div class="flex gap-2 mt-2">
              <button
                v-for="color in colors"
                :key="color"
                class="w-7 h-7 rounded-full transition-transform hover:scale-110 ring-offset-slate-800"
                :class="localCard.color === color ? 'ring-2 ring-white ring-offset-2 scale-110' : ''"
                :style="{ background: color }"
                @click="localCard.color = color; save()"
              />
            </div>
          </div>
        </div>

        <!-- Footer actions -->
        <div class="flex justify-between items-center p-4 border-t border-slate-700">
          <button
            @click="$emit('delete')"
            class="text-sm text-red-400 hover:text-red-300 transition-colors"
          >Delete card</button>
          <button
            @click="save(); $emit('close')"
            class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({ card: Object })
const emit = defineEmits(['update', 'delete', 'close'])

const colors = ['#6366f1','#f59e0b','#10b981','#ef4444','#06b6d4','#8b5cf6','#ec4899','#f97316']
const localCard = ref({ ...props.card })

watch(() => props.card, (c) => { localCard.value = { ...c } })

function save() {
  emit('update', {
    title: localCard.value.title,
    description: localCard.value.description,
    color: localCard.value.color,
  })
}
</script>
