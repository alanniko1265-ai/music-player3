<template>
  <div
    class="lyrics-panel"
    :class="{ 'lyrics-panel--expanded': isExpanded }"
    role="region"
    aria-label="Lyrics panel"
  >
    <button
      class="lyrics-panel__toggle"
      :aria-expanded="isExpanded"
      aria-controls="lyrics-content"
      @click="$emit('toggle-expand')"
    >
      <span class="lyrics-panel__toggle-mark">{{ isExpanded ? '[-]' : '[+]' }}</span>
      <span class="lyrics-panel__toggle-text">LYRICS</span>
    </button>

    <div
      v-show="isExpanded && metadataLines.length > 0"
      class="lyrics-panel__metadata"
      aria-label="歌曲制作信息"
    >
      <span
        v-for="entry in metadataLines"
        :key="`meta-${entry.index}`"
        class="lyrics-panel__metadata-item"
      >
        {{ entry.line.text }}
      </span>
    </div>

    <div
      v-show="isExpanded"
      id="lyrics-content"
      ref="lyricsContainerRef"
      class="lyrics-panel__content"
    >
      <div v-if="lyrics.length === 0" class="lyrics-panel__empty">
        <span>[ no lyrics loaded ]</span>
      </div>

      <div v-else-if="timedLyrics.length === 0" class="lyrics-panel__empty">
        <span>[ no timed lyrics ]</span>
      </div>

      <div v-else class="lyrics-panel__lines">
        <div
          v-for="(entry, index) in timedLyrics"
          :key="entry.index"
          :ref="(el) => setLineRef(el, index)"
          class="lyrics-panel__line"
          :class="lineClasses(index)"
          role="button"
          :tabindex="0"
          :aria-current="index === activeLine ? 'true' : undefined"
          @click="$emit('seek', entry.line.time)"
          @keydown.enter="$emit('seek', entry.line.time)"
          @keydown.space.prevent="$emit('seek', entry.line.time)"
        >
          <span class="lyrics-panel__line-prefix">{{ index === activeLine ? '>' : '.' }}</span>
          <span class="lyrics-panel__line-text">{{ entry.line.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import type { LyricLine } from '@/types'

export interface LyricsPanelProps {
  lyrics: LyricLine[]
  currentTime: number
  isExpanded: boolean
}

export interface LyricsPanelEmits {
  (e: 'seek', time: number): void
  (e: 'toggle-expand'): void
}

const props = defineProps<LyricsPanelProps>()
defineEmits<LyricsPanelEmits>()

const lyricsContainerRef = ref<HTMLElement | null>(null)
const lineRefs = ref<(HTMLElement | null)[]>([])
const metadataPattern = /^(?:作?词|作?曲|编曲|演唱|制作人|监制|混音|录音|lyrics?|composer|arranger|producer)\s*[:：]/i

const indexedLyrics = computed(() => props.lyrics.map((line, index) => ({ line, index })))
const metadataLines = computed(() => indexedLyrics.value.filter(({ line }) => metadataPattern.test(line.text.trim())))
const timedLyrics = computed(() => indexedLyrics.value.filter(({ line }) => !metadataPattern.test(line.text.trim())))

function setLineRef(el: Element | ComponentPublicInstance | null, index: number) {
  lineRefs.value[index] = el as HTMLElement | null
}

const activeLine = computed(() => {
  const lyrics = timedLyrics.value.map(({ line }) => line)
  const { currentTime } = props
  if (!lyrics.length) {
    return -1
  }

  if (currentTime < lyrics[0].time) {
    return -1
  }

  let low = 0
  let high = lyrics.length - 1
  let result = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lyrics[mid].time <= currentTime) {
      result = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return result
})

function lineClasses(index: number) {
  const distance = activeLine.value < 0 ? Number.POSITIVE_INFINITY : Math.abs(index - activeLine.value)

  return {
    'lyrics-panel__line--active': distance === 0,
    'lyrics-panel__line--near': distance === 1,
    'lyrics-panel__line--context': distance === 2,
  }
}

watch([activeLine, () => props.lyrics, () => props.isExpanded], async ([newIndex]) => {
  if (newIndex < 0 || !props.isExpanded) return

  await nextTick()

  const lineEl = lineRefs.value[newIndex]
  const container = lyricsContainerRef.value

  if (lineEl && container) {
    const containerHeight = container.clientHeight
    const maxScroll = Math.max(0, container.scrollHeight - containerHeight)

    if (containerHeight === 0 || maxScroll === 0) return

    const containerRect = container.getBoundingClientRect()
    const lineRect = lineEl.getBoundingClientRect()
    const lineTop = lineRect.top - containerRect.top + container.scrollTop
    const scrollTarget = lineTop - (containerHeight - lineRect.height) / 2

    container.scrollTo({
      top: Math.max(0, Math.min(scrollTarget, maxScroll)),
      behavior: 'smooth',
    })
  }
})
</script>

<style scoped lang="scss">
.lyrics-panel {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: rgba(8, 10, 8, 0.5);

  &__toggle {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text-secondary);

    &:hover {
      color: var(--color-text);
    }
  }

  &__toggle-mark {
    color: var(--color-primary);
  }

  &__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-behavior: smooth;
    padding: 10px 0;
  }

  &__metadata {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: 4px 14px;
    max-height: 68px;
    padding: 8px 14px;
    overflow-y: auto;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text-disabled);
    font-size: var(--font-size-xs);
  }

  &__metadata-item {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &__empty {
    display: flex;
    min-height: 120px;
    align-items: center;
    justify-content: center;
    color: var(--color-text-disabled);
  }

  &__lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
  }

  &__line {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 8px 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    opacity: 0.4;
    transition: opacity var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);

    &:hover {
      border-color: var(--color-border);
      background: rgba(18, 24, 18, 0.56);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    &--active {
      color: var(--color-text);
      border-color: var(--color-border);
      background: rgba(18, 24, 18, 0.72);
      opacity: 1;
      transform: translateX(2px);
    }

    &--near {
      opacity: 0.72;
    }

    &--context {
      opacity: 0.54;
    }

  }

  &__line-prefix {
    color: var(--color-primary);
  }

  &__line-text {
    line-height: 1.7;
  }
}
</style>
