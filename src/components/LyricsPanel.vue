<template>
  <div
    class="lyrics-panel"
    :class="{ 'lyrics-panel--expanded': isExpanded }"
    role="region"
    aria-label="歌词面板"
  >
    <!-- Toggle button -->
    <button
      class="lyrics-panel__toggle"
      :aria-expanded="isExpanded"
      aria-controls="lyrics-content"
      @click="$emit('toggle-expand')"
    >
      <svg
        class="lyrics-panel__toggle-icon"
        :class="{ 'lyrics-panel__toggle-icon--expanded': isExpanded }"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M7 10l5 5 5-5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="lyrics-panel__toggle-text">歌词</span>
    </button>

    <!-- Lyrics content -->
    <div
      v-show="isExpanded"
      id="lyrics-content"
      ref="lyricsContainerRef"
      class="lyrics-panel__content"
    >
      <!-- No lyrics placeholder -->
      <div v-if="lyrics.length === 0" class="lyrics-panel__empty">
        <span>暂无歌词</span>
      </div>

      <!-- Lyrics lines -->
      <div v-else class="lyrics-panel__lines">
        <div
          v-for="(line, index) in lyrics"
          :key="index"
          :ref="(el) => setLineRef(el, index)"
          class="lyrics-panel__line"
          :class="{ 'lyrics-panel__line--active': index === activeLine }"
          role="button"
          :tabindex="0"
          :aria-current="index === activeLine ? 'true' : undefined"
          @click="$emit('seek', line.time)"
          @keydown.enter="$emit('seek', line.time)"
          @keydown.space.prevent="$emit('seek', line.time)"
        >
          {{ line.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, type ComponentPublicInstance } from 'vue'
import type { LyricLine } from '../types/index'

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

function setLineRef(el: Element | ComponentPublicInstance | null, index: number) {
  lineRefs.value[index] = el as HTMLElement | null
}

/**
 * Compute the active lyric line index based on currentTime.
 * Uses the same logic as LyricsService.getActiveLine (binary search).
 */
const activeLine = computed(() => {
  const { lyrics, currentTime } = props
  if (!lyrics || lyrics.length === 0) {
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

/**
 * Auto-scroll to keep the active line centered in the viewport
 */
watch(activeLine, async (newIndex) => {
  if (newIndex < 0 || !props.isExpanded) return

  await nextTick()

  const lineEl = lineRefs.value[newIndex]
  const container = lyricsContainerRef.value

  if (lineEl && container) {
    const containerHeight = container.clientHeight
    const lineTop = lineEl.offsetTop
    const lineHeight = lineEl.clientHeight
    const scrollTarget = lineTop - containerHeight / 2 + lineHeight / 2

    container.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    })
  }
})
</script>

<style scoped lang="scss">
.lyrics-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: var(--radius-md, 12px);
  background-color: var(--color-surface, #1A1A2E);
  overflow: hidden;
  transition: all var(--transition-base, 250ms ease);

  &--expanded {
    flex: 1;
  }

  &__toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 12px) var(--spacing-base, 16px);
    background: none;
    border: none;
    color: var(--color-text-secondary, #B3B3B3);
    cursor: pointer;
    font-size: var(--font-size-base, 14px);
    transition: color var(--transition-fast, 150ms ease);

    &:hover {
      color: var(--color-text, #FFFFFF);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary, #1DB954);
      outline-offset: -2px;
      border-radius: var(--radius-sm, 4px);
    }
  }

  &__toggle-icon {
    width: 20px;
    height: 20px;
    transition: transform var(--transition-base, 250ms ease);

    &--expanded {
      transform: rotate(180deg);
    }
  }

  &__toggle-text {
    font-weight: var(--font-weight-medium, 500);
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-base, 16px);
    padding-top: 0;
    max-height: 400px;
    scroll-behavior: smooth;

    // Custom scrollbar
    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--color-border, rgba(255, 255, 255, 0.1));
      border-radius: var(--radius-full, 9999px);
    }
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    color: var(--color-text-secondary, #B3B3B3);
    font-size: var(--font-size-base, 14px);
  }

  &__lines {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-lg, 24px) 0;
  }

  &__line {
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-secondary, #B3B3B3);
    font-size: var(--font-size-base, 14px);
    line-height: var(--line-height-relaxed, 1.75);
    cursor: pointer;
    transition:
      color var(--transition-base, 250ms ease),
      font-size var(--transition-base, 250ms ease),
      transform var(--transition-base, 250ms ease),
      background-color var(--transition-fast, 150ms ease);
    opacity: 0.6;

    &:hover {
      background-color: var(--color-surface-hover, #222240);
      opacity: 0.9;
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary, #1DB954);
      outline-offset: 2px;
    }

    &--active {
      color: var(--color-primary, #1DB954);
      font-size: var(--font-size-lg, 18px);
      font-weight: var(--font-weight-semibold, 600);
      opacity: 1;
      transform: scale(1.02);
    }
  }
}
</style>
