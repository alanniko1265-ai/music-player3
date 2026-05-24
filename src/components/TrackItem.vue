<template>
  <div
    class="track-item"
    role="listitem"
    :aria-label="`${track.title} - ${track.artist}`"
  >
    <!-- 主体区域：点击播放 -->
    <div
      class="track-item__body"
      role="button"
      tabindex="0"
      :aria-label="`播放 ${track.title} - ${track.artist}`"
      @click="$emit('play', track)"
      @keydown.enter="$emit('play', track)"
      @keydown.space.prevent="$emit('play', track)"
    >
      <div class="track-item__info">
        <span class="track-item__title">{{ track.title }}</span>
        <span class="track-item__meta">
          <span class="track-item__artist">{{ track.artist }}</span>
          <span class="track-item__separator">·</span>
          <span class="track-item__album">{{ track.album }}</span>
        </span>
      </div>
    </div>

    <div class="track-item__actions">
      <span class="track-item__duration">{{ formattedDuration }}</span>

      <!-- 收藏按钮 -->
      <button
        class="track-item__favorite-btn"
        :class="{ 'track-item__favorite-btn--active': isFavorite }"
        :aria-label="isFavorite ? '取消收藏' : '收藏'"
        :aria-pressed="isFavorite"
        @click.stop="$emit('toggleFavorite', track)"
      >
        <!-- Filled heart when favorite -->
        <svg
          v-if="isFavorite"
          class="track-item__heart-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <!-- Outline heart when not favorite -->
        <svg
          v-else
          class="track-item__heart-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </button>

      <!-- 添加到歌单按钮（仅当有歌单时显示） -->
      <div v-if="playlists.length > 0" class="track-item__menu-wrapper" ref="menuWrapperRef">
        <button
          class="track-item__menu-btn"
          aria-label="添加到歌单"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          @click.stop="toggleMenu"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>

        <!-- 歌单下拉菜单 -->
        <Transition name="track-item-menu">
          <div
            v-if="menuOpen"
            class="track-item__menu"
            role="menu"
            aria-label="选择歌单"
          >
            <div class="track-item__menu-header">添加到歌单</div>
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="track-item__menu-item"
              role="menuitem"
              @click.stop="addToPlaylist(playlist.id)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
              </svg>
              <span class="track-item__menu-item-name">{{ playlist.name }}</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import type { Track } from '@/types'
import type { Playlist } from '@/types'
import { usePlaylistStore } from '@/stores/playlist-store'

export interface TrackItemProps {
  track: Track
  isFavorite: boolean
}

const props = defineProps<TrackItemProps>()

const emit = defineEmits<{
  play: [track: Track]
  toggleFavorite: [track: Track]
  addToPlaylist: [track: Track, playlistId: string]
}>()

const playlistStore = usePlaylistStore()
const playlists = computed<Playlist[]>(() => playlistStore.playlists)

/** 菜单开关状态 */
const menuOpen = ref(false)
const menuWrapperRef = ref<HTMLElement | null>(null)

/**
 * 格式化时长为 mm:ss 格式
 */
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

/**
 * 添加到指定歌单
 */
async function addToPlaylist(playlistId: string): Promise<void> {
  closeMenu()
  await playlistStore.addTrack(playlistId, props.track)
  emit('addToPlaylist', props.track, playlistId)
}

/**
 * 点击外部关闭菜单
 */
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-base);
  border-radius: var(--radius-base);
  transition: background-color var(--transition-fast);
  user-select: none;

  &:hover {
    background-color: var(--color-surface-hover);
  }

  &__body {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
    cursor: pointer;
    padding: var(--spacing-xs) 0;
    border-radius: var(--radius-sm);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);

    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    &:active {
      transform: translateY(0) scale(0.99);
      box-shadow: none;
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 0;
    flex: 1;
  }

  &__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__separator {
    margin: 0 var(--spacing-xs);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-shrink: 0;
    margin-left: var(--spacing-base);
  }

  &__duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  &__favorite-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color var(--transition-fast), transform var(--transition-spring);

    &:hover {
      color: var(--color-accent-hover);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.8);
    }

    &--active {
      color: var(--color-accent);

      &:hover {
        color: var(--color-accent-hover);
      }
    }
  }

  &__heart-icon {
    width: 18px;
    height: 18px;
  }

  // 更多操作菜单
  &__menu-wrapper {
    position: relative;
  }

  &__menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color var(--transition-fast), background var(--transition-fast);

    svg {
      width: 18px;
      height: 18px;
    }

    &:hover {
      color: var(--color-text);
      background: var(--color-surface-hover);
    }
  }

  &__menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: var(--z-dropdown);
    min-width: 160px;
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-base);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  &__menu-header {
    padding: var(--spacing-sm) var(--spacing-base);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-border);
  }

  &__menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-base);
    background: transparent;
    border: none;
    color: var(--color-text);
    font-size: var(--font-size-sm);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast);

    svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: var(--color-text-secondary);
    }

    &:hover {
      background: var(--color-surface-hover);
    }

    &:active {
      background: var(--color-surface-active);
    }
  }

  &__menu-item-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// 菜单动画
.track-item-menu-enter-active,
.track-item-menu-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.track-item-menu-enter-from,
.track-item-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
