<template>
  <div class="playlist-detail-view">
    <section class="playlist-detail-view__banner">
      <div class="playlist-detail-view__left">
        <button class="playlist-detail-view__back-btn" aria-label="返回" @click="goBack">..</button>
        <div>
          <div class="playlist-detail-view__kicker">$ playlist</div>
          <h1 v-if="isEditingName" class="playlist-detail-view__title">
            <input
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
          </h1>
          <h1 v-else class="playlist-detail-view__title" @dblclick="startRename">
            {{ playlist?.name ?? '未知歌单' }}
          </h1>
        </div>
      </div>

      <div class="playlist-detail-view__stats">
        <span>歌曲 {{ playlist?.tracks.length ?? 0 }}</span>
        <span v-if="playlist">更新于 {{ formatDate(playlist.updatedAt) }}</span>
      </div>
    </section>

    <section class="playlist-detail-view__toolbar">
      <button
        v-if="playlist && playlist.tracks.length > 0"
        class="playlist-detail-view__btn playlist-detail-view__btn--primary"
        @click="playAll"
      >
        [全部播放]
      </button>
    </section>

    <div class="playlist-detail-view__content">
      <div v-if="!playlist" class="playlist-detail-view__empty">
        <div class="playlist-detail-view__empty-box">[ 丢失 ]</div>
        <p>歌单不存在</p>
      </div>

      <div v-else-if="playlist.tracks.length === 0" class="playlist-detail-view__empty">
        <div class="playlist-detail-view__empty-box">[ 空 ]</div>
        <p>这个歌单里还没有歌曲</p>
      </div>

      <div v-else class="playlist-detail-view__table" role="list">
        <div class="playlist-detail-view__table-head">
          <span>#</span>
          <span>标题</span>
          <span>歌手</span>
          <span>专辑</span>
          <span>时长</span>
          <span>操作</span>
        </div>

        <div
          v-for="(track, index) in playlist.tracks"
          :key="track.id"
          class="playlist-detail-view__row"
          :class="{
            'playlist-detail-view__row--dragging': dragIndex === index,
            'playlist-detail-view__row--drag-over': dragOverIndex === index && dragIndex !== index,
          }"
          role="listitem"
          :aria-label="`${track.title} - ${track.artist}`"
        >
          <button
            class="playlist-detail-view__drag-handle"
            aria-label="拖动排序"
            @mousedown="startDrag($event, index)"
            @touchstart.prevent="startDrag($event, index)"
          >
            ::
          </button>

          <div class="playlist-detail-view__track-info" role="button" tabindex="0" @click="playTrack(track)" @keydown.enter="playTrack(track)">
            <span class="playlist-detail-view__track-title">{{ track.title }}</span>
          </div>

          <span class="playlist-detail-view__cell">{{ track.artist }}</span>
          <span class="playlist-detail-view__cell">{{ track.album }}</span>
          <span class="playlist-detail-view__cell playlist-detail-view__cell--time">{{ formatDuration(track.duration) }}</span>

          <div class="playlist-detail-view__actions">
            <button class="playlist-detail-view__icon-btn" type="button" @click="playTrack(track)">[播放]</button>
            <button class="playlist-detail-view__icon-btn playlist-detail-view__icon-btn--danger" type="button" @click="removeTrack(track.id)">[x]</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Track } from '@/types'
import { usePlaylistStore } from '@/stores/playlist-store'
import { usePlayerStore } from '@/stores/player-store'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()

const playlistId = computed(() => route.params.id as string)
const playlist = computed(() => playlistStore.playlists.find((p) => p.id === playlistId.value) ?? null)

const isEditingName = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startRename(): void {
  if (!playlist.value) return
  editingName.value = playlist.value.name
  isEditingName.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

async function confirmRename(): Promise<void> {
  const trimmed = editingName.value.trim()
  if (trimmed && playlist.value && trimmed !== playlist.value.name) {
    await playlistStore.renamePlaylist(playlistId.value, trimmed)
  }
  isEditingName.value = false
}

function cancelRename(): void {
  isEditingName.value = false
}

function goBack(): void {
  router.push({ name: 'playlists' })
}

async function playAll(): Promise<void> {
  if (!playlist.value || playlist.value.tracks.length === 0) return
  playerStore.setPlaylist(playlist.value.tracks)
  await playerStore.playTrack(playlist.value.tracks[0])
}

async function playTrack(track: Track): Promise<void> {
  if (!playlist.value) return
  playerStore.setPlaylist(playlist.value.tracks)
  await playerStore.playTrack(track)
}

async function removeTrack(trackId: string): Promise<void> {
  await playlistStore.removeTrack(playlistId.value, trackId)
}

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
let dragAbortController: AbortController | null = null

function startDrag(event: MouseEvent | TouchEvent, index: number): void {
  dragAbortController?.abort()
  dragAbortController = new AbortController()
  const { signal } = dragAbortController
  dragIndex.value = index

  const onMove = (e: MouseEvent | TouchEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const rows = document.querySelectorAll('.playlist-detail-view__row')
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
    if (dragIndex.value !== null && dragOverIndex.value !== null && dragIndex.value !== dragOverIndex.value) {
      await playlistStore.reorderTracks(playlistId.value, dragIndex.value, dragOverIndex.value)
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

function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

onBeforeUnmount(() => {
  dragAbortController?.abort()
  dragAbortController = null
})
</script>

<style lang="scss" scoped>
.playlist-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 12px;

  &__banner,
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-divider);
    background: rgba(10, 13, 10, 0.44);
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  &__kicker,
  &__stats,
  &__toolbar-right {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  &__kicker {
    color: var(--color-accent);
    letter-spacing: 0;
  }

  &__title {
    margin: 2px 0 0;
    font-size: var(--font-size-xl);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__title-input {
    width: min(100%, 420px);
    padding: 8px 10px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background: rgba(8, 15, 10, 0.92);
    color: var(--color-text);
  }

  &__back-btn,
  &__btn,
  &__icon-btn {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.56);
    color: var(--color-text-secondary);

    &:hover {
      color: var(--color-text);
      border-color: var(--color-primary);
    }
  }

  &__btn--primary {
    color: #071009;
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  &__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: rgba(8, 10, 8, 0.38);
  }

  &__empty {
    min-height: 100%;
    display: grid;
    place-items: center;
    gap: 10px;
    color: var(--color-text-secondary);
  }

  &__empty-box {
    color: var(--color-primary);
  }

  &__table {
    display: flex;
    flex-direction: column;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: 34px minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) 90px 160px;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
  }

  &__table-head {
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-primary);
    background: rgba(8, 10, 8, 0.96);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__row {
    border-bottom: 1px solid var(--color-divider);

    &:hover {
      background: rgba(18, 24, 18, 0.58);
    }

    &--dragging {
      opacity: 0.5;
    }

    &--drag-over {
      box-shadow: inset 0 2px 0 var(--color-primary);
    }
  }

  &__drag-handle {
    color: var(--color-primary);
  }

  &__track-info {
    min-width: 0;
    overflow: hidden;
    cursor: pointer;
  }

  &__track-title,
  &__cell {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__track-title {
    color: var(--color-text);
  }

  &__cell {
    color: var(--color-text-secondary);
  }

  &__cell--time {
    font-variant-numeric: tabular-nums;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  &__icon-btn--danger {
    color: var(--color-error);
  }
}
</style>
