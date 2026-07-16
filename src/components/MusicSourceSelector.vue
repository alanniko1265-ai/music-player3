<template>
  <div class="source-selector">
    <div class="source-selector__buttons">
      <button
        class="source-btn"
        :class="{ 'source-btn--active': currentSource === 'qq' }"
        @click="switchSource('qq')"
        title="QQ Music"
      >
        [QQ]
      </button>
      <button
        class="source-btn"
        :class="{ 'source-btn--active': currentSource === 'netease' }"
        @click="switchSource('netease')"
        title="Netease"
      >
        [WY]
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { MusicSource } from '@/types'

const currentSource = ref<MusicSource>('qq')

const emit = defineEmits<{
  (e: 'change', source: MusicSource): void
}>()

async function switchSource(source: MusicSource) {
  currentSource.value = source
  emit('change', source)
}

defineExpose({ currentSource })
</script>

<style scoped>
.source-selector__buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.source-btn {
  padding: 7px 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: rgba(8, 10, 8, 0.58);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.source-btn:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
}

.source-btn--active {
  color: var(--color-primary);
  background: rgba(159, 247, 177, 0.1);
  border-color: var(--color-primary);
}
</style>
