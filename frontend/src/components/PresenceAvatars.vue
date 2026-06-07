<template>
  <div class="flex items-center gap-1">
    <div
      v-for="user in visibleUsers"
      :key="user.id"
      class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900 transition-all"
      :style="{ background: user.color }"
      :title="user.name"
    >
      {{ user.name[0]?.toUpperCase() }}
    </div>
    <div
      v-if="overflow > 0"
      class="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 ring-2 ring-slate-900"
    >
      +{{ overflow }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ users: Array })
const MAX = 5
const visibleUsers = computed(() => props.users.slice(0, MAX))
const overflow = computed(() => Math.max(0, props.users.length - MAX))
</script>
