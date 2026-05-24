<template>
  <div class="playlist-detail-view">
    <!-- Header -->
    <div class="playlist-detail-view__header">
      <button
        class="playlist-detail-view__back-btn"
        aria-label="返回歌单列表"
        @click="goBack"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <!-- Editable playlist name -->
      <div class="playlist-detail-view__title-wrapper">
        <input
          v-if="isEditingName"
          ref="nameInputRef"
          v-model="editingName"
          class="playlist-detail-view__title-input"
          type="text"
          maxlength="50"
          aria-label="歌单名称"
          @blur="confirmRename"
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
        />
        <h1
          v-else
          class="playlist-detail-view__title"
          @dblclick="startRename"
        >
          {{ playlist?.name ?? '未知歌单' }}
          <button
            class="playlist-detail-view__edit-btn"
            aria-label="编辑歌单名称"
            @click="startRename"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </h1>
      </div>

      <!-- Play All button -->
      <button
        v-if="playlist && playlist.tracks.length > 0"
        class="playlist-detail-view__play-all-btn"
        @click="playAll"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        播放全部
      </button>
    </div>

    <!-- Content -->
    <div class="playlist-detail-view__content">
      <!-- Playlist not found -->
      <div v-if="!playlist" class="playlist-detail-view__not-found">
        <svg class="playlist-detail-view__not-found-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="playlist-detail-view__not-found-text">歌单不存在</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="playlist.tracks.length === 0" class="playlist-detail-view__empty">
        <svg class="playlist-detail-view__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
        <p class="playlist-detail-view__empty-text">歌单暂无曲目</p>
        <p class="playlist-detail-view__empty-hint">从搜索页面添加喜欢的音乐</p>
      </div>

      <!-- Track list with drag-and-drop -->
      <div v-else class="playlist-detail-view__tracks" role="list">
        <div
          v-for="(track, index) in playlist.tracks"
          :key="track.id"
          class="playlist-detail-view__track-row"
          :class="{
            'playlist-detail-view__track-row--dragging': dragIndex === index,
            'playlist-detail-view__track-row--drag-over': dragOverIndex === index && dragIndex !== index,
          }"
          role="listitem"
          :aria-label="`${track.title} - ${track.artist}`"
        >
          <!-- Drag handle -->
          <button
            class="playlist-detail-view__drag-handle"
            aria-label="拖拽排序"
            @mousedown="startDrag($event, index)"
            @touchstart.prevent="startDrag($event, index)"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>

          <!-- Track info (clickable to play) -->
          <div
            class="playlist-detail-view__track-info"
            role="button"
            tabindex="0"
            @click="playTrack(track)"
            @keydown.enter="playTrack(track)"
          >
            <span class="playlist-detail-view__track-title">{{ track.title }}</span>
            <span class="playlist-detail-view__track-meta">
              {{ track.artist }} · {{ track.album }}
            </span>
          </div>

          <!-- Duration -->
          <span class="playlist-detail-view__track-duration">{{ formatDuration(track.duration) }}</span>

          <!-- Remove button -->
          <button
            class="playlist-detail-view__remove-btn"
            :aria-label="`从歌单移除 ${track.title}`"
            @click="removeTrack(track.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Track } from '@/types'
import { usePlaylistStore } from '@/stores/playlist-store'
import { usePlayerStore } from '@/stores/player-store'

// ========== Route & Stores ==========
const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()

// ========== Computed ==========

/** Get playlist ID from route params */
const playlistId = computed(() => route.params.id as string)

/** Get the playlist from the store */
const playlist = computed(() =>
  playlistStore.playlists.find(p => p.id === playlistId.value) ?? null
)

// ========== Rename State ==========
const isEditingName = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

/**
 * Start editing the playlist name
 */
function startRename(): void {
  if (!playlist.value) return
  editingName.value = playlist.value.name
  isEditingName.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

/**
 * Confirm the rename operation
 */
async function confirmRename(): Promise<void> {
  const trimmed = editingName.value.trim()
  if (trimmed && playlist.value && trimmed !== playlist.value.name) {
    await playlistStore.renamePlaylist(playlistId.value, trimmed)
  }
  isEditingName.value = false
}

/**
 * Cancel the rename operation
 */
function cancelRename(): void {
  isEditingName.value = false
}

// ========== Navigation ==========

/**
 * Navigate back to playlist list
 */
function goBack(): void {
  router.push({ name: 'playlists' })
}

// ========== Playback ==========

/**
 * Play all tracks in the playlist
 */
async function playAll(): Promise<void> {
  if (!playlist.value || playlist.value.tracks.length === 0) return
  playerStore.setPlaylist(playlist.value.tracks)
  await playerStore.playTrack(playlist.value.tracks[0])
}

/**
 * Play a specific track from the playlist
 */
async function playTrack(track: Track): Promise<void> {
  if (!playlist.value) return
  playerStore.setPlaylist(playlist.value.tracks)
  await playerStore.playTrack(track)
}

// ========== Remove Track ==========

/**
 * Remove a track from the playlist
 */
async function removeTrack(trackId: string): Promise<void> {
  await playlistStore.removeTrack(playlistId.value, trackId)
}

// ========== Drag and Drop ==========
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

/**
 * 当前拖拽会话的 AbortController，用于在组件卸载时清理监听器
 */
let dragAbortController: AbortController | null = null

/**
 * Start dragging a track
 */
function startDrag(event: MouseEvent | TouchEvent, index: number): void {
  // 取消上一次未结束的拖拽（防御性处理）
  dragAbortController?.abort()
  dragAbortController = new AbortController()
  const { signal } = dragAbortController

  dragIndex.value = index

  const onMove = (e: MouseEvent | TouchEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const rows = document.querySelectorAll('.playlist-detail-view__track-row')
    let targetIndex: number | null = null

    rows.forEach((row, i) => {
      const rect = row.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) {
        targetIndex = i
      }
    })

    dragOverIndex.value = targetIndex
  }

  const onEnd = async () => {
    if (
      dragIndex.value !== null &&
      dragOverIndex.value !== null &&
      dragIndex.value !== dragOverIndex.value
    ) {
      await playlistStore.reorderTracks(
        playlistId.value,
        dragIndex.value,
        dragOverIndex.value
      )
    }

    dragIndex.value = null
    dragOverIndex.value = null
    dragAbortController?.abort()
    dragAbortController = null
  }

  document.addEventListener('mousemove', onMove, { signal })
  document.addEventListener('mouseup', onEnd, { signal })
  document.addEventListener('touchmove', onMove, { signal })
  document.addEventListener('touchend', onEnd, { signal })
}

// ========== Utilities ==========

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ========== Cleanup ==========
onBeforeUnmount(() => {
  // 中止所有拖拽相关的事件监听器
  dragAbortController?.abort()
  dragAbortController = null
})
</script>

<style lang="scss" scoped>
.playlist-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    flex-shrink: 0;
  }

  &__back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast);
    flex-shrink: 0;

    svg {
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: var(--color-surface-hover);
      transform: scale(1.05);
    }

    &:active {
      background: var(--color-surface-active);
      transform: scale(0.95);
    }
  }

  &__title-wrapper {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
  }

  &__title-input {
    width: 100%;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    background: var(--color-surface);
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-base);
    padding: var(--spacing-xs) var(--spacing-sm);
    outline: none;
    font-family: var(--font-family);
  }

  &__edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transition-fast), color var(--transition-fast);
    flex-shrink: 0;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--color-primary);
    }
  }

  &__title:hover &__edit-btn {
    opacity: 1;
  }

  &__play-all-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-base);
    background: var(--color-primary);
    color: var(--color-text);
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast);
    flex-shrink: 0;
    white-space: nowrap;

    svg {
      width: 18px;
      height: 18px;
    }

    &:hover {
      background: var(--color-primary-hover);
      transform: scale(1.02);
    }

    &:active {
      background: var(--color-primary-active);
      transform: scale(0.98);
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
  }

  // Not found state
  &__not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__not-found-icon {
    width: 48px;
    height: 48px;
    color: var(--color-error);
    opacity: 0.8;
    margin-bottom: var(--spacing-base);
  }

  &__not-found-text {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin: 0;
  }

  // Empty state
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__empty-icon {
    width: 48px;
    height: 48px;
    color: var(--color-text-secondary);
    opacity: 0.4;
    margin-bottom: var(--spacing-base);
  }

  &__empty-text {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-xs);
  }

  &__empty-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-disabled);
    margin: 0;
  }

  // Track list
  &__tracks {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  &__track-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-sm);
    border-radius: var(--radius-base);
    transition: background-color var(--transition-fast), opacity var(--transition-fast);

    &:hover {
      background-color: var(--color-surface-hover);
    }

    &--dragging {
      opacity: 0.5;
      background-color: var(--color-surface);
    }

    &--drag-over {
      border-top: 2px solid var(--color-primary);
    }
  }

  &__drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-disabled);
    cursor: grab;
    flex-shrink: 0;
    transition: color var(--transition-fast);

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--color-text-secondary);
    }

    &:active {
      cursor: grabbing;
      color: var(--color-primary);
    }
  }

  &__track-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
    cursor: pointer;
    padding: var(--spacing-xs) 0;

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
  }

  &__track-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__track-meta {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__track-duration {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  &__remove-btn {
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
    flex-shrink: 0;
    transition: color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--color-error);
      background: rgba(244, 67, 54, 0.1);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}
</style>
