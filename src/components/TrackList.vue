<template>
  <div class="track-list">
    <!-- Empty state -->
    <div v-if="tracks.length === 0" class="track-list__empty">
      <svg
        class="track-list__empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"
          fill="currentColor"
        />
      </svg>
      <p class="track-list__empty-text">暂无曲目</p>
    </div>

    <!-- Track items with staggered enter animation -->
    <TransitionGroup
      v-else
      name="list-stagger"
      tag="div"
      class="track-list__items"
      role="list"
    >
      <TrackItem
        v-for="(track, index) in tracks"
        :key="track.id"
        role="listitem"
        :track="track"
        :is-favorite="checkIsFavorite(track.id)"
        :style="{ transitionDelay: `${index * 30}ms` }"
        @play="onPlay"
        @toggle-favorite="onToggleFavorite"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { Track } from '@/types'
import { useFavoritesStore } from '@/stores/favorites-store'
import TrackItem from './TrackItem.vue'

export interface TrackListProps {
  tracks: Track[]
}

defineProps<TrackListProps>()

const emit = defineEmits<{
  play: [track: Track]
  toggleFavorite: [track: Track]
}>()

const favoritesStore = useFavoritesStore()

/**
 * 检查曲目是否已收藏
 */
function checkIsFavorite(trackId: string): boolean {
  return favoritesStore.isFavorite(trackId)
}

function onPlay(track: Track) {
  emit('play', track)
}

function onToggleFavorite(track: Track) {
  emit('toggleFavorite', track)
}
</script>

<style scoped lang="scss">
.track-list {
  min-height: 0;
  width: 100%;

  &__items {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    color: var(--color-text-secondary);
  }

  &__empty-icon {
    width: 48px;
    height: 48px;
    opacity: 0.4;
    margin-bottom: var(--spacing-md);
  }

  &__empty-text {
    font-size: var(--font-size-base);
    margin: 0;
  }
}
</style>
