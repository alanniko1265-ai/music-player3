<template>
  <div
    class="track-item"
    role="listitem"
    :aria-label="`${track.title} - ${track.artist}`"
  >
    <div
      class="track-item__body"
      role="button"
      tabindex="0"
      :aria-label="`播放 ${track.title} - ${track.artist}`"
      @click="$emit('play', track)"
      @keydown.enter="$emit('play', track)"
      @keydown.space.prevent="$emit('play', track)"
    >
      <span class="track-item__marker">&gt;</span>
      <span class="track-item__title">{{ track.title }}</span>
      <span class="track-item__artist">{{ track.artist }}</span>
      <span class="track-item__album">{{ track.album }}</span>
    </div>

    <div class="track-item__actions">
      <span class="track-item__duration">{{ formattedDuration }}</span>

      <button
        class="track-item__toggle"
        :class="{ 'track-item__toggle--active': isFavorite }"
        :aria-label="isFavorite ? '取消收藏' : '收藏'"
        :aria-pressed="isFavorite"
        @click.stop="$emit('toggleFavorite', track)"
      >
        {{ isFavorite ? '[已藏]' : '[收藏]' }}
      </button>

      <div v-if="playlists.length > 0" class="track-item__menu-wrapper" ref="menuWrapperRef">
        <button
          class="track-item__toggle"
          aria-label="加入歌单"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          @click.stop="toggleMenu"
        >
          [歌单]
        </button>

        <Transition name="track-item-menu">
          <div
            v-if="menuOpen"
            class="track-item__menu"
            role="menu"
            aria-label="选择歌单"
          >
            <div class="track-item__menu-header">加入歌单</div>
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="track-item__menu-item"
              role="menuitem"
              @click.stop="addToPlaylist(playlist.id)"
            >
              <span class="track-item__menu-prefix">+</span>
              <span class="track-item__menu-item-name">{{ playlist.name }}</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Playlist, Track } from '@/types'
import { usePlaylistStore } from '@/stores/playlist-store'

export interface TrackItemProps {
  track: Track
  isFavorite: boolean
}

const props = defineProps<TrackItemProps>()

defineEmits<{
  play: [track: Track]
  toggleFavorite: [track: Track]
  addToPlaylist: [track: Track, playlistId: string]
}>()

const playlistStore = usePlaylistStore()
const playlists = computed<Playlist[]>(() => playlistStore.playlists)
const menuOpen = ref(false)
const menuWrapperRef = ref<HTMLElement | null>(null)

const formattedDuration = computed(() => {
  const totalSeconds = Math.floor(props.track.duration)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

function closeMenu(): void {
  menuOpen.value = false
}

async function addToPlaylist(playlistId: string): Promise<void> {
  closeMenu()
  await playlistStore.addTrack(playlistId, props.track)
}

function handleOutsideClick(event: MouseEvent): void {
  if (menuWrapperRef.value && !menuWrapperRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped lang="scss">
.track-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), background-color var(--transition-fast);

  &:hover {
    border-color: var(--color-divider);
    background: rgba(18, 24, 18, 0.5);
  }

  &__body {
    display: grid;
    grid-template-columns: 18px minmax(120px, 1.2fr) minmax(100px, 0.9fr) minmax(100px, 1fr);
    gap: 12px;
    align-items: center;
    min-width: 0;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }

  &__marker {
    color: var(--color-primary);
  }

  &__title,
  &__artist,
  &__album {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm);
  }

  &__title {
    color: var(--color-text);
  }

  &__artist,
  &__album,
  &__duration {
    color: var(--color-text-secondary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__duration {
    min-width: 40px;
    text-align: right;
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }

  &__toggle {
    padding: 5px 7px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);

    &:hover {
      color: var(--color-text);
      border-color: var(--color-border);
    }

    &--active {
      color: var(--color-primary);
    }
  }

  &__menu-wrapper {
    position: relative;
  }

  &__menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    min-width: 180px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(8, 10, 8, 0.98);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
  }

  &__menu-header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-primary);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__menu-item {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    text-align: left;

    &:hover {
      background: rgba(18, 24, 18, 0.72);
    }
  }

  &__menu-prefix {
    color: var(--color-primary);
  }

  &__menu-item-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.track-item-menu-enter-active,
.track-item-menu-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.track-item-menu-enter-from,
.track-item-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
