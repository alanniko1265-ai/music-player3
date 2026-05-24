<template>
  <div class="player-bar" role="region" aria-label="播放控制栏">
    <!-- Left: Track Info -->
    <div class="player-bar__track-info">
      <template v-if="playerStore.currentTrack">
        <button
          class="player-bar__cover-button"
          type="button"
          :aria-label="`打开正在播放：${playerStore.currentTrack.title}`"
          @click="openCurrentTrack"
        >
          <img
            class="player-bar__cover"
            :src="playerStore.currentTrack.coverUrl"
            :alt="`${playerStore.currentTrack.title} 封面`"
          />
        </button>
        <div class="player-bar__text">
          <span class="player-bar__title">{{ playerStore.currentTrack.title }}</span>
          <span class="player-bar__artist">{{ playerStore.currentTrack.artist }}</span>
        </div>
      </template>
      <template v-else>
        <div class="player-bar__cover player-bar__cover--empty" aria-hidden="true"></div>
        <div class="player-bar__text">
          <span class="player-bar__title player-bar__title--empty">未在播放</span>
        </div>
      </template>
    </div>

    <!-- Center: Controls + Progress -->
    <div class="player-bar__center">
      <div class="player-bar__controls">
        <button
          class="player-bar__btn"
          aria-label="上一首"
          :disabled="!playerStore.currentTrack"
          @click="playerStore.previous()"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        <button
          class="player-bar__btn player-bar__btn--play"
          :aria-label="playerStore.isPlaying ? '暂停' : '播放'"
          :disabled="!playerStore.currentTrack"
          @click="togglePlay"
        >
          <!-- Pause icon -->
          <svg v-if="playerStore.isPlaying" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          <!-- Play icon -->
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <button
          class="player-bar__btn"
          aria-label="下一首"
          :disabled="!playerStore.currentTrack"
          @click="playerStore.next()"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
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
        >
          <div class="player-bar__progress-track">
            <div
              class="player-bar__progress-fill"
              :style="{ width: progressPercent + '%' }"
            ></div>
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

    <!-- Right: Volume + Play Mode -->
    <div class="player-bar__right">
      <button
        class="player-bar__btn player-bar__btn--mode"
        :aria-label="playModeLabel"
        @click="cyclePlayMode"
      >
        <!-- Sequential -->
        <svg v-if="playerStore.playMode === PlayMode.Sequential" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
        </svg>
        <!-- Shuffle -->
        <svg v-else-if="playerStore.playMode === PlayMode.Shuffle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
        </svg>
        <!-- RepeatOne -->
        <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
        </svg>
      </button>

      <!-- 音质选择 -->
      <div class="player-bar__quality" ref="qualityRef">
        <button
          class="player-bar__btn player-bar__btn--quality"
          :aria-label="`当前音质：${qualityLabel}，点击切换`"
          @click.stop="toggleQualityMenu"
        >
          <span class="player-bar__quality-badge">{{ qualityBadge }}</span>
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

      <div class="player-bar__volume">
        <button
          class="player-bar__btn player-bar__btn--volume-icon"
          :aria-label="playerStore.volume === 0 ? '取消静音' : '静音'"
          @click="toggleMute"
        >
          <!-- Muted -->
          <svg v-if="playerStore.volume === 0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
          <!-- Low volume -->
          <svg v-else-if="playerStore.volume < 50" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
          </svg>
          <!-- High volume -->
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </button>
        <div
          class="player-bar__volume-slider"
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
            <div
              class="player-bar__volume-fill"
              :style="{ width: playerStore.volume + '%' }"
            ></div>
            <div
              class="player-bar__volume-thumb"
              :style="{ left: playerStore.volume + '%' }"
              @mousedown.prevent="onVolumeDragStart"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player-store'
import { PlayMode, AudioQuality, QUALITY_LABELS } from '@/types'

const playerStore = usePlayerStore()
const router = useRouter()

/** 上次静音前的音量 */
const volumeBeforeMute = ref(80)

// ===== Quality Selection =====
const showQualityMenu = ref(false)
const qualityRef = ref<HTMLElement | null>(null)

const qualityOptions = [
  { value: AudioQuality.Standard, label: '标准' },
  { value: AudioQuality.High, label: '高品质' },
  { value: AudioQuality.Lossless, label: '无损' },
  { value: AudioQuality.HiRes, label: 'Hi-Res' },
]

const qualityLabel = computed(() => QUALITY_LABELS[playerStore.quality])
const qualityBadge = computed(() => {
  switch (playerStore.quality) {
    case AudioQuality.Standard: return 'SD'
    case AudioQuality.High: return 'HQ'
    case AudioQuality.Lossless: return 'SQ'
    case AudioQuality.HiRes: return 'HR'
  }
})

function toggleQualityMenu() {
  showQualityMenu.value = !showQualityMenu.value
}

function selectQuality(q: AudioQuality) {
  playerStore.setQuality(q)
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

/** 播放进度百分比 */
const progressPercent = computed(() => {
  if (playerStore.duration === 0) return 0
  return (playerStore.currentTime / playerStore.duration) * 100
})

/** 播放模式标签 */
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

/** 切换播放/暂停 */
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

/** 循环切换播放模式 */
function cyclePlayMode() {
  const modes = [PlayMode.Sequential, PlayMode.Shuffle, PlayMode.RepeatOne]
  const currentIndex = modes.indexOf(playerStore.playMode)
  const nextIndex = (currentIndex + 1) % modes.length
  playerStore.setPlayMode(modes[nextIndex])
}

/** 切换静音 */
function toggleMute() {
  if (playerStore.volume === 0) {
    playerStore.setVolume(volumeBeforeMute.value || 80)
  } else {
    volumeBeforeMute.value = playerStore.volume
    playerStore.setVolume(0)
  }
}

/** 格式化时间为 mm:ss */
function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ===== Progress Bar Interaction =====

function onProgressClick(event: MouseEvent) {
  if (playerStore.duration === 0) return
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  playerStore.seek(percent * playerStore.duration)
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
  const step = playerStore.duration * 0.02 // 2% step
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    playerStore.seek(Math.min(playerStore.duration, playerStore.currentTime + step))
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    playerStore.seek(Math.max(0, playerStore.currentTime - step))
  }
}

// ===== Volume Slider Interaction =====

function onVolumeClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  playerStore.setVolume(Math.round(percent * 100))
}

function onVolumeDragStart(event: MouseEvent) {
  const volumeEl = (event.target as HTMLElement).closest('.player-bar__volume-slider') as HTMLElement
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
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-lg);
  background: rgba(13, 13, 13, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--color-border);
  z-index: var(--z-sticky);
  gap: var(--spacing-lg);

  // ===== Left: Track Info =====
  &__track-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    min-width: 200px;
    max-width: 260px;
    flex: 1;
  }

  &__cover {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    object-fit: cover;
    flex-shrink: 0;

    &--empty {
      background: var(--color-surface);
    }
  }

  &__cover-button {
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);

    &:hover {
      transform: scale(1.04);
      box-shadow: var(--shadow-sm);
    }

    &:active {
      transform: scale(0.96);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .player-bar__cover {
      display: block;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &--empty {
      color: var(--color-text-secondary);
    }
  }

  &__artist {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // ===== Center: Controls + Progress =====
  &__center {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 2;
    max-width: 600px;
    gap: var(--spacing-xs);
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    transition: color var(--transition-fast), transform var(--transition-spring);

    svg {
      width: 20px;
      height: 20px;
    }

    &:hover:not(:disabled) {
      color: var(--color-primary);
      transform: scale(1.1);
    }

    &:active:not(:disabled) {
      transform: scale(0.85);
    }

    &:disabled {
      color: var(--color-text-disabled);
      cursor: not-allowed;
    }

    &--play {
      width: 36px;
      height: 36px;
      background: var(--color-primary);
      color: var(--color-background);

      svg {
        width: 22px;
        height: 22px;
      }

      &:hover:not(:disabled) {
        background: var(--color-primary-hover);
        color: var(--color-background);
        transform: scale(1.08);
      }

      &:active:not(:disabled) {
        background: var(--color-primary-active);
        transform: scale(0.9);
      }

      &:disabled {
        background: var(--color-surface);
        color: var(--color-text-disabled);
      }
    }

    &--mode {
      color: var(--color-text-secondary);

      &:hover {
        color: var(--color-primary);
      }
    }

    &--volume-icon {
      width: 28px;
      height: 28px;
      color: var(--color-text-secondary);

      svg {
        width: 18px;
        height: 18px;
      }

      &:hover {
        color: var(--color-text);
      }
    }
  }

  // ===== Progress Bar =====
  &__progress-row {
    display: flex;
    align-items: center;
    width: 100%;
    gap: var(--spacing-sm);
  }

  &__time {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
    min-width: 36px;
    text-align: center;
    user-select: none;
  }

  &__progress {
    flex: 1;
    height: 16px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  &__progress-track {
    position: relative;
    width: 100%;
    height: 4px;
    background: var(--color-surface);
    border-radius: var(--radius-full);
    transition: height var(--transition-fast);

    .player-bar__progress:hover & {
      height: 6px;
    }
  }

  &__progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: width 0.1s linear;
  }

  &__progress-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: var(--color-text);
    border-radius: var(--radius-full);
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity var(--transition-fast);
    box-shadow: var(--shadow-sm);

    .player-bar__progress:hover & {
      opacity: 1;
    }
  }

  // ===== Right: Volume + Mode =====
  &__right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    min-width: 180px;
    justify-content: flex-end;
    flex: 1;
  }

  &__quality {
    position: relative;
  }

  &__quality-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 4px;
    border: 1px solid currentColor;
    border-radius: 3px;
    line-height: 1;
    white-space: nowrap;
  }

  &__btn--quality {
    color: var(--color-text-secondary);

    &:hover {
      color: var(--color-primary);
    }
  }

  &__quality-menu {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    padding: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    min-width: 80px;
    z-index: 10;
  }

  &__quality-option {
    display: block;
    width: 100%;
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background: var(--color-surface-hover);
    }

    &--active {
      color: var(--color-primary);
      font-weight: var(--font-weight-medium);
    }
  }

  &__volume {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  &__volume-slider {
    width: 90px;
    height: 16px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  &__volume-track {
    position: relative;
    width: 100%;
    height: 4px;
    background: var(--color-surface);
    border-radius: var(--radius-full);
  }

  &__volume-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
  }

  &__volume-thumb {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    background: var(--color-text);
    border-radius: var(--radius-full);
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity var(--transition-fast);
    box-shadow: var(--shadow-sm);

    .player-bar__volume-slider:hover & {
      opacity: 1;
    }
  }
}
</style>
