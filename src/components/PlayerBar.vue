<template>
  <div class="player-bar" role="region" aria-label="播放控制">
    <div class="player-bar__panel player-bar__panel--now">
      <button
        v-if="playerStore.currentTrack"
        class="player-bar__cover-button"
        type="button"
        :aria-label="`打开当前歌曲 ${playerStore.currentTrack.title}`"
        @click="openCurrentTrack"
      >
        <img
          class="player-bar__cover"
          :src="playerStore.currentTrack.coverUrl"
          :alt="`${playerStore.currentTrack.title} 封面`"
        />
      </button>
      <div v-else class="player-bar__cover player-bar__cover--empty" aria-hidden="true"></div>

      <div class="player-bar__text">
        <span class="player-bar__label">当前</span>
        <span class="player-bar__title">{{ playerStore.currentTrack?.title ?? '空闲' }}</span>
        <span class="player-bar__artist">{{ playerStore.currentTrack?.artist ?? '还没有选择歌曲' }}</span>
      </div>
    </div>

    <div class="player-bar__panel player-bar__panel--transport">
      <div class="player-bar__commands">
        <button
          class="player-bar__cmd"
          :disabled="!playerStore.currentTrack"
          aria-label="上一首"
          @click="playerStore.previous()"
        >
          prev
        </button>
        <button
          class="player-bar__cmd player-bar__cmd--primary"
          :disabled="!playerStore.currentTrack"
          :aria-label="playerStore.isPlaying ? '暂停' : '播放'"
          @click="togglePlay"
        >
          {{ playerStore.isPlaying ? 'pause' : 'play' }}
        </button>
        <button
          class="player-bar__cmd"
          :disabled="!playerStore.currentTrack"
          aria-label="下一首"
          @click="playerStore.next()"
        >
          next
        </button>
      </div>

      <div class="player-bar__progress-row">
        <span class="player-bar__time">{{ formatTime(playerStore.currentTime) }}</span>
        <div
          class="player-bar__progress"
          role="slider"
          aria-label="播放进度"
          :aria-valuemin="0"
          :aria-valuemax="playerStore.duration"
          :aria-valuenow="playerStore.currentTime"
          tabindex="0"
          @click="onProgressClick"
          @keydown="onProgressKeydown"
          @pointermove="onProgressPointerMove"
          @pointerleave="clearProgressPreview"
        >
          <div
            v-if="progressPreviewTime !== null"
            class="player-bar__progress-preview"
            :style="progressPreviewStyle"
            role="tooltip"
          >
            {{ formatTime(progressPreviewTime) }}
          </div>
          <div class="player-bar__progress-track">
            <div class="player-bar__progress-fill" :style="{ width: progressPercent + '%' }"></div>
            <div
              class="player-bar__progress-thumb"
              :style="{ left: progressPercent + '%' }"
              @mousedown.prevent="onProgressDragStart"
            ></div>
          </div>
        </div>
        <span class="player-bar__time">{{ formatTime(playerStore.duration) }}</span>
      </div>

    </div>

    <div class="player-bar__panel player-bar__panel--meta">
      <div class="player-bar__meta-row">
        <span class="player-bar__meta-label">mode</span>
        <button class="player-bar__meta-button" :aria-label="playModeLabel" @click="cyclePlayMode">
          {{ playModeCode }}
        </button>
      </div>

      <div class="player-bar__meta-row player-bar__meta-row--quality" ref="qualityRef">
        <span class="player-bar__meta-label">quality</span>
        <button
          class="player-bar__meta-button"
          :aria-label="`当前音质 ${qualityLabel}`"
          @click.stop="toggleQualityMenu"
        >
          {{ qualityLabel }}
        </button>
        <div
          v-if="showQualityMenu"
          class="player-bar__quality-menu"
          role="menu"
          aria-label="音质选择"
        >
          <button
            v-for="q in qualityOptions"
            :key="q.value"
            class="player-bar__quality-option"
            :class="{ 'player-bar__quality-option--active': q.value === playerStore.quality }"
            role="menuitem"
            @click="selectQuality(q.value)"
          >
            {{ q.label }}
          </button>
        </div>
      </div>

      <div class="player-bar__meta-row">
        <span class="player-bar__meta-label">vol</span>
        <button class="player-bar__meta-button" :aria-label="playerStore.volume === 0 ? '取消静音' : '静音'" @click="toggleMute">
          {{ playerStore.volume }}%
        </button>
      </div>

      <div
        class="player-bar__volume"
        role="slider"
        aria-label="音量"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="playerStore.volume"
        tabindex="0"
        @click="onVolumeClick"
        @keydown="onVolumeKeydown"
      >
        <div class="player-bar__volume-track">
          <div class="player-bar__volume-fill" :style="{ width: playerStore.volume + '%' }"></div>
          <div
            class="player-bar__volume-thumb"
            :style="{ left: playerStore.volume + '%' }"
            @mousedown.prevent="onVolumeDragStart"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player-store'
import { AudioQuality, PlayMode, QUALITY_LABELS } from '@/types'

const playerStore = usePlayerStore()
const router = useRouter()

const volumeBeforeMute = ref(80)
const showQualityMenu = ref(false)
const qualityRef = ref<HTMLElement | null>(null)
const progressPreviewTime = ref<number | null>(null)
const progressPreviewPercent = ref(0)

const qualityOptions = [
  { value: AudioQuality.Standard, label: '标准' },
  { value: AudioQuality.High, label: '高品' },
  { value: AudioQuality.Lossless, label: '无损' },
  { value: AudioQuality.HiRes, label: '高解析' },
]

const qualityLabel = computed(() => QUALITY_LABELS[playerStore.quality])

const progressPercent = computed(() => {
  if (playerStore.duration === 0) return 0
  return (playerStore.currentTime / playerStore.duration) * 100
})

const progressPreviewStyle = computed(() => ({
  left: `clamp(22px, ${progressPreviewPercent.value}%, calc(100% - 22px))`,
}))

const playModeLabel = computed(() => {
  switch (playerStore.playMode) {
    case PlayMode.Sequential:
      return '顺序播放'
    case PlayMode.Shuffle:
      return '随机播放'
    case PlayMode.RepeatOne:
      return '单曲循环'
    default:
      return '播放模式'
  }
})

const playModeCode = computed(() => {
  switch (playerStore.playMode) {
    case PlayMode.Sequential:
      return '顺序'
    case PlayMode.Shuffle:
      return '随机'
    case PlayMode.RepeatOne:
      return '单曲'
    default:
      return '--'
  }
})

function toggleQualityMenu() {
  showQualityMenu.value = !showQualityMenu.value
}

async function selectQuality(q: AudioQuality) {
  await playerStore.setQuality(q)
  showQualityMenu.value = false
}

function handleClickOutsideQuality(e: MouseEvent) {
  if (qualityRef.value && !qualityRef.value.contains(e.target as Node)) {
    showQualityMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutsideQuality)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutsideQuality)
})

function togglePlay() {
  if (playerStore.isPlaying) {
    playerStore.pause()
  } else {
    playerStore.resume()
  }
}

function openCurrentTrack(): void {
  if (playerStore.currentTrack) {
    router.push({ name: 'player' })
  }
}

function cyclePlayMode() {
  const modes = [PlayMode.Sequential, PlayMode.Shuffle, PlayMode.RepeatOne]
  const currentIndex = modes.indexOf(playerStore.playMode)
  playerStore.setPlayMode(modes[(currentIndex + 1) % modes.length])
}

function toggleMute() {
  if (playerStore.volume === 0) {
    playerStore.setVolume(volumeBeforeMute.value || 80)
  } else {
    volumeBeforeMute.value = playerStore.volume
    playerStore.setVolume(0)
  }
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds || 0)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function onProgressClick(event: MouseEvent) {
  if (playerStore.duration === 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  playerStore.seek(percent * playerStore.duration)
}

function onProgressPointerMove(event: PointerEvent) {
  if (playerStore.duration === 0) {
    clearProgressPreview()
    return
  }

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  progressPreviewPercent.value = percent * 100
  progressPreviewTime.value = percent * playerStore.duration
}

function clearProgressPreview() {
  progressPreviewTime.value = null
}

function onProgressDragStart(event: MouseEvent) {
  if (playerStore.duration === 0) return
  const progressEl = (event.target as HTMLElement).closest('.player-bar__progress') as HTMLElement
  if (!progressEl) return

  const onMouseMove = (e: MouseEvent) => {
    const rect = progressEl.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    playerStore.seek(percent * playerStore.duration)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onProgressKeydown(event: KeyboardEvent) {
  if (playerStore.duration === 0) return
  const step = playerStore.duration * 0.02
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    playerStore.seek(Math.min(playerStore.duration, playerStore.currentTime + step))
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    playerStore.seek(Math.max(0, playerStore.currentTime - step))
  }
}

function onVolumeClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  playerStore.setVolume(Math.round(percent * 100))
}

function onVolumeDragStart(event: MouseEvent) {
  const volumeEl = (event.target as HTMLElement).closest('.player-bar__volume') as HTMLElement
  if (!volumeEl) return

  const onMouseMove = (e: MouseEvent) => {
    const rect = volumeEl.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    playerStore.setVolume(Math.round(percent * 100))
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onVolumeKeydown(event: KeyboardEvent) {
  const step = 5
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    playerStore.setVolume(Math.min(100, playerStore.volume + step))
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    playerStore.setVolume(Math.max(0, playerStore.volume - step))
  }
}
</script>

<style scoped lang="scss">
.player-bar {
  position: relative;
  z-index: var(--z-sticky);
  display: grid;
  grid-template-columns: minmax(200px, 0.85fr) minmax(420px, 1.5fr) minmax(300px, 1fr);
  gap: 0;
  align-items: stretch;
  padding: 0;
  border-top: 1px solid var(--color-border);
  background: rgba(8, 10, 8, 0.98);

  &__panel {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 8px 12px;
    border-right: 1px solid var(--color-divider);
    background: transparent;
  }

  &__panel--transport {
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }

  &__panel--meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: center;
    gap: 6px 8px;
    padding: 8px 10px;
  }

  &__cover,
  &__cover-button {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  &__cover {
    border: 1px solid var(--color-divider);
    object-fit: cover;

    &--empty {
      background: rgba(18, 24, 18, 0.5);
    }
  }

  &__cover-button {
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);

    &:hover {
      border-color: var(--color-primary);
    }
  }

  &__text {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  &__label {
    color: var(--color-accent);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__title {
    color: var(--color-text);
    font-size: var(--font-size-base);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__artist {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__commands {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__cmd {
    min-width: 68px;
    padding: 6px 9px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.48);
    color: var(--color-text-secondary);
    transition: border-color var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);

    &:hover:not(:disabled) {
      color: var(--color-text);
      border-color: var(--color-primary);
    }

    &:disabled {
      opacity: 0.45;
    }

    &--primary {
      color: var(--color-primary);
      background: rgba(159, 247, 177, 0.1);
      border-color: var(--color-primary);
    }
  }

  &__progress-row {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 48px;
    gap: 8px;
    width: 100%;
    align-items: center;
  }

  &__time {
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  &__progress {
    position: relative;
    display: flex;
    align-items: center;
    height: 18px;
    cursor: pointer;
  }

  &__progress-preview {
    position: absolute;
    bottom: calc(50% + 9px);
    z-index: 2;
    min-width: 42px;
    padding: 2px 5px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(8, 10, 8, 0.98);
    color: var(--color-text-secondary);
    font-size: 10px;
    line-height: 1.2;
    text-align: center;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    transform: translateX(-50%);
  }

  &__progress-track,
  &__volume-track {
    position: relative;
    width: 100%;
    height: 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.58);
  }

  &__progress-fill,
  &__volume-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--color-primary);
    border-radius: inherit;
  }

  &__progress-thumb,
  &__volume-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-text);
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  &__progress:hover &__progress-thumb,
  &__volume:hover &__volume-thumb {
    opacity: 1;
  }

  &__meta-row {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__meta-label {
    color: var(--color-text-disabled);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__meta-button {
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.48);
    color: var(--color-text);
    text-align: left;

    &:hover {
      border-color: var(--color-primary);
    }
  }

  &__meta-row--quality {
    z-index: var(--z-dropdown);
  }

  &__quality-menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    min-width: 132px;
    padding: 4px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(8, 10, 8, 0.98);
    box-shadow: var(--shadow-lg);
  }

  &__quality-option {
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    text-align: left;
    color: var(--color-text-secondary);

    &:hover {
      background: rgba(18, 24, 18, 0.72);
      color: var(--color-text);
    }

    &--active {
      color: var(--color-primary);
    }
  }

  &__volume {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    height: 14px;
    cursor: pointer;
  }
}

@media (max-width: 1100px) {
  .player-bar {
    grid-template-columns: minmax(170px, 0.8fr) minmax(340px, 1.35fr) minmax(270px, 1fr);

    &__panel {
      padding: 7px 9px;
    }

    &__panel--meta {
      padding: 7px 8px;
    }

    &__label,
    &__meta-label,
    &__time {
      font-size: 10px;
    }

    &__cover,
    &__cover-button {
      width: 42px;
      height: 42px;
    }

    &__title {
      font-size: var(--font-size-sm);
    }

    &__artist {
      font-size: var(--font-size-xs);
    }

    &__cmd {
      min-width: 60px;
      padding: 6px 8px;
    }
  }
}

@media (max-width: 820px) {
  .player-bar {
    grid-template-columns: 1fr;

    &__panel {
      padding: 10px 12px;
    }

    &__panel--transport {
      grid-column: auto;
    }

    &__panel--meta {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    &__commands {
      flex-wrap: wrap;
      justify-content: center;
    }

    &__panel--now {
      display: none;
    }
  }
}

@media (max-width: 640px) {
  .player-bar {
    &__panel--now {
      align-items: flex-start;
    }

    &__progress-row {
      grid-template-columns: 40px minmax(0, 1fr) 40px;
      gap: 8px;
    }

    &__cmd {
      min-width: 0;
      flex: 1 1 88px;
    }
  }
}

@media (max-height: 860px) {
  .player-bar {
    padding: 0;
    gap: 0;

    &__panel {
      padding: 10px 12px;
    }

    &__cover,
    &__cover-button {
      width: 44px;
      height: 44px;
    }

    &__label,
    &__meta-label,
    &__time {
      font-size: 10px;
    }

    &__title {
      font-size: var(--font-size-sm);
    }

    &__artist {
      font-size: var(--font-size-xs);
    }

    &__commands {
      gap: 8px;
    }

    &__cmd {
      padding: 7px 10px;
    }

  }
}
</style>
