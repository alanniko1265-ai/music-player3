<template>
  <div class="queue-view">
    <section class="queue-view__banner">
      <div>
        <div class="queue-view__kicker">$ queue</div>
        <h1 class="queue-view__title">播放列表</h1>
      </div>
      <div class="queue-view__stats">
        <span>{{ queueTracks.length }} 首</span>
        <span v-if="currentIndex >= 0">当前 {{ currentIndex + 1 }} / {{ queueTracks.length }}</span>
      </div>
    </section>

    <section class="queue-view__toolbar">
      <span>当前播放队列会自动保存，下次启动继续保留</span>
      <button class="queue-view__btn" type="button" :disabled="queueTracks.length === 0" @click="clearUpcoming">
        [清空待播]
      </button>
    </section>

    <div ref="contentRef" class="queue-view__content" @scroll.passive="onScroll">
      <div v-if="queueTracks.length === 0" class="queue-view__empty">
        <div>[ 空队列 ]</div>
        <p>从搜索、歌手目录或歌单中播放歌曲后，这里会显示播放列表</p>
        <RouterLink class="queue-view__btn" to="/">[去搜索歌曲]</RouterLink>
      </div>

      <div v-else class="queue-view__table">
        <div class="queue-view__table-head">
          <span>#</span><span>标题</span><span>歌手</span><span>专辑</span><span>时长</span><span>操作</span>
        </div>

        <div class="queue-view__virtual" :style="{ height: `${queueTracks.length * ROW_HEIGHT}px` }">
          <div
            v-for="entry in visibleQueue"
            :key="`${entry.track.source}:${entry.track.id}`"
            class="queue-view__row"
            :class="{ 'queue-view__row--current': isCurrent(entry.track) }"
            :style="{ transform: `translateY(${entry.index * ROW_HEIGHT}px)` }"
          >
            <button class="queue-view__play-cell" type="button" :aria-label="`播放 ${entry.track.title}`" @click="playTrack(entry.track)">
              {{ isCurrent(entry.track) ? '>' : String(entry.index + 1).padStart(2, '0') }}
            </button>
            <button class="queue-view__track-name" type="button" @click="playTrack(entry.track)">{{ entry.track.title }}</button>
            <span>{{ entry.track.artist }}</span>
            <span>{{ entry.track.album }}</span>
            <span>{{ formatDuration(entry.track.duration) }}</span>
            <span class="queue-view__actions">
              <button type="button" :disabled="entry.index === 0" aria-label="上移" @click="moveTrack(entry.index, -1)">[↑]</button>
              <button type="button" :disabled="entry.index === queueTracks.length - 1" aria-label="下移" @click="moveTrack(entry.index, 1)">[↓]</button>
              <button type="button" :disabled="isCurrent(entry.track)" :aria-label="`从播放列表移除 ${entry.track.title}`" @click="removeTrack(entry.track)">[移除]</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Track } from '@/types'
import { usePlayerStore } from '@/stores/player-store'

const playerStore = usePlayerStore()
const ROW_HEIGHT = 46
const HEADER_HEIGHT = 38
const OVERSCAN = 6
const contentRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(600)
let resizeObserver: ResizeObserver | null = null
const queueTracks = computed(() => playerStore.playlist.length > 0
  ? playerStore.playlist
  : playerStore.currentTrack ? [playerStore.currentTrack] : [])
const currentIndex = computed(() => playerStore.currentTrack
  ? queueTracks.value.findIndex(track => sameTrack(track, playerStore.currentTrack!))
  : -1)
const visibleRange = computed(() => {
  const listScrollTop = Math.max(0, scrollTop.value - HEADER_HEIGHT)
  const start = Math.max(0, Math.floor(listScrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(
    queueTracks.value.length,
    Math.ceil((listScrollTop + viewportHeight.value) / ROW_HEIGHT) + OVERSCAN,
  )
  return { start, end }
})
const visibleQueue = computed(() => queueTracks.value
  .slice(visibleRange.value.start, visibleRange.value.end)
  .map((track, offset) => ({ track, index: visibleRange.value.start + offset })))

function onScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

onMounted(() => {
  if (!contentRef.value) return
  viewportHeight.value = contentRef.value.clientHeight
  resizeObserver = new ResizeObserver(entries => {
    viewportHeight.value = entries[0]?.contentRect.height || contentRef.value?.clientHeight || 600
  })
  resizeObserver.observe(contentRef.value)
})

onBeforeUnmount(() => resizeObserver?.disconnect())

function sameTrack(left: Track, right: Track): boolean {
  return left.id === right.id && left.source === right.source
}

function isCurrent(track: Track): boolean {
  return !!playerStore.currentTrack && sameTrack(track, playerStore.currentTrack)
}

async function playTrack(track: Track): Promise<void> {
  if (playerStore.playlist.length === 0) playerStore.setPlaylist(queueTracks.value)
  await playerStore.playTrack(track)
}

function removeTrack(track: Track): void {
  if (!isCurrent(track)) playerStore.setPlaylist(queueTracks.value.filter(item => !sameTrack(item, track)))
}

function moveTrack(index: number, offset: number): void {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= queueTracks.value.length) return
  const reordered = [...queueTracks.value]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, moved)
  playerStore.setPlaylist(reordered)
}

function clearUpcoming(): void {
  playerStore.setPlaylist(playerStore.currentTrack ? [playerStore.currentTrack] : [])
}

function formatDuration(duration: number): string {
  const seconds = Math.max(0, Math.floor(duration))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
</script>

<style lang="scss" scoped>
.queue-view {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;

  &__banner, &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-divider);
    background: rgb(10, 13, 10);
  }

  &__kicker, &__stats, &__toolbar { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
  &__kicker { color: var(--color-accent); }
  &__title { margin: 2px 0 0; font-size: var(--font-size-xl); }
  &__stats { display: flex; gap: 16px; }

  &__btn {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    &:hover:not(:disabled) { color: var(--color-text); border-color: var(--color-primary); }
  }

  &__content { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }

  &__empty {
    min-height: 100%;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--color-primary);
    text-align: center;
  }

  &__table { min-width: 760px; }

  &__virtual {
    position: relative;
    width: 100%;
  }

  &__table-head, &__row {
    display: grid;
    grid-template-columns: 52px minmax(130px, 1.3fr) minmax(100px, 0.9fr) minmax(110px, 1fr) 56px 152px;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
  }

  &__table-head {
    position: sticky;
    top: 0;
    z-index: 2;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-primary);
    background: rgb(8, 10, 8);
    font-size: var(--font-size-xs);
  }

  &__row {
    position: absolute;
    inset: 0 0 auto;
    width: 100%;
    height: 46px;
    min-height: 46px;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text-secondary);
    > span, > button { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    &:hover { background: rgb(17, 22, 18); }
    &--current { color: var(--color-text); background: rgb(14, 22, 16); box-shadow: inset 2px 0 0 var(--color-primary); }
  }

  &__play-cell { color: var(--color-primary); text-align: left; }
  &__track-name { color: var(--color-text); text-align: left; }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 5px;
    button { padding: 4px; color: var(--color-text-secondary); }
    button:hover:not(:disabled) { color: var(--color-primary); }
  }
}
</style>
