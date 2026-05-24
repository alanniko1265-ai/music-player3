<template>
  <div class="source-selector">
    <span class="source-selector__label">音乐源</span>
    <div class="source-selector__buttons">
      <button
        class="source-btn"
        :class="{ 'source-btn--active': currentSource === 'qq' }"
        @click="switchSource('qq')"
        title="QQ 音乐"
      >
        QQ
      </button>
      <button
        class="source-btn"
        :class="{ 'source-btn--active': currentSource === 'netease' }"
        @click="switchSource('netease')"
        title="网易云音乐"
      >
        云
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { MusicSource } from '@/types/index'

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
.source-selector {
  padding: var(--spacing-md) var(--spacing-lg);
  margin-top: auto;
  margin-bottom: var(--spacing-sm);
}

.source-selector__label {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: block;
}

.source-selector__buttons {
  display: flex;
  gap: 4px;
}

.source-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.source-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.source-btn--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.source-btn--active:hover {
  background: var(--color-primary);
  color: #fff;
}
</style>
