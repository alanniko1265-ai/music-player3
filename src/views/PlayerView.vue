<template>
  <transition name="player-enter" appear>
    <div class="player-view">
      <BlurBackground :cover-url="currentTrack?.coverUrl" />

      <section class="player-view__stage">
        <div class="player-view__turntable">
          <div class="player-view__section-title">$ turntable</div>
          <div class="player-view__disc-wrap">
            <CoverPulseVisualizer
              :src="currentTrack?.coverUrl ?? ''"
              :alt="coverAlt"
              :size="420"
              :is-playing="playerStore.isPlaying"
              :current-time="playerStore.currentTime"
              :duration="playerStore.duration"
            />
          </div>
        </div>

        <div class="player-view__console">
          <div class="player-view__header">
            <div class="player-view__section-title">$ now playing</div>
            <h1 class="player-view__title">
              {{ currentTrack?.title ?? 'IDLE' }}
            </h1>
            <p class="player-view__artist">
              {{ currentTrack?.artist ?? '选择一首歌开始播放' }}
            </p>
          </div>

          <div class="player-view__stats">
            <div class="player-view__stat">
              <span class="player-view__stat-label">source</span>
              <span class="player-view__stat-value">{{ sourceLabel }}</span>
            </div>
            <div class="player-view__stat">
              <span class="player-view__stat-label">quality</span>
              <span class="player-view__stat-value">{{ qualityLabel }}</span>
            </div>
            <div class="player-view__stat">
              <span class="player-view__stat-label">state</span>
              <span
                class="player-view__stat-value player-view__stat-value--state"
                :class="`player-view__stat-value--${playbackStatus.tone}`"
                aria-live="polite"
              >
                {{ playbackStatus.label }}
              </span>
            </div>
          </div>

          <LyricsPanel
            class="player-view__lyrics"
            :lyrics="lyrics"
            :current-time="currentTime"
            :is-expanded="lyricsExpanded"
            @seek="handleSeek"
            @toggle-expand="lyricsExpanded = !lyricsExpanded"
          />
        </div>

        <div class="player-view__wave-panel">
          <AudioWaveform
            class="player-view__waveform"
            :audio="audioElement"
            :is-playing="playerStore.isPlaying"
            :bar-count="36"
          />
        </div>
      </section>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BlurBackground from '@/components/BlurBackground.vue'
import AudioWaveform from '@/components/AudioWaveform.vue'
import CoverPulseVisualizer from '@/components/CoverPulseVisualizer.vue'
import LyricsPanel from '@/components/LyricsPanel.vue'
import { LyricsService } from '@/services/lyrics-service'
import { QQMusicAPIAdapter } from '@/services/qq-music-adapter'
import { QQMusicDirectAdapter, isQQMusicDirectAvailable } from '@/services/qq-music-direct-adapter'
import { usePlayerStore } from '@/stores/player-store'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'
import { QUALITY_LABELS } from '@/types'
import type { LyricLine } from '@/types'

const playerStore = usePlayerStore()
const loginStore = useQQMusicLoginStore()

const lyrics = ref<LyricLine[]>([])
const lyricsExpanded = ref(true)
let lyricsService = new LyricsService(createQQAdapter())

const currentTrack = computed(() => playerStore.currentTrack)
const currentTime = computed(() => playerStore.currentTime)
const coverAlt = computed(() =>
  currentTrack.value
    ? `${currentTrack.value.title} - ${currentTrack.value.artist} 专辑封面`
    : '专辑封面',
)

const qualityLabel = computed(() => QUALITY_LABELS[playerStore.quality])
const sourceLabel = computed(() => {
  if (currentTrack.value?.source === 'netease') return 'WY 接口'
  return loginStore.isLoggedIn ? 'QQ 直连' : 'QQ 接口'
})
const audioElement = computed(() => (playerStore.initialized ? playerStore.getAudioElement() : null))
const playbackStatus = computed(() => {
  switch (playerStore.playbackActivity) {
    case 'loading':
      return { label: '加载中', tone: 'activity' }
    case 'buffering':
      return { label: '缓冲中', tone: 'activity' }
    case 'seeking':
      return { label: '定位中', tone: 'activity' }
  }

  if (playerStore.isPlaying) return { label: '播放中', tone: 'playing' }
  if (playerStore.errorMessage && currentTrack.value) return { label: '播放失败', tone: 'error' }
  if (currentTrack.value) return { label: '已暂停', tone: 'paused' }
  return { label: '待命', tone: 'idle' }
})

function createQQAdapter() {
  return loginStore.isLoggedIn && isQQMusicDirectAvailable()
    ? new QQMusicDirectAdapter()
    : new QQMusicAPIAdapter()
}

function handleSeek(time: number) {
  playerStore.seek(time)
}

watch(
  () => currentTrack.value?.id,
  async (newTrackId) => {
    if (!newTrackId) {
      lyrics.value = []
      return
    }

    try {
      lyrics.value = await lyricsService.fetchLyrics(newTrackId)
    } catch {
      lyrics.value = []
    }
  },
  { immediate: true },
)

watch(
  () => loginStore.isLoggedIn,
  async () => {
    lyricsService = new LyricsService(createQQAdapter())
    if (currentTrack.value?.id) {
      lyrics.value = await lyricsService.fetchLyrics(currentTrack.value.id)
    }
  },
)
</script>

<style scoped lang="scss">
.player-view {
  position: relative;
  flex: 1;
  min-height: 0;
  height: 100%;
  padding: 18px;
  overflow-y: auto;

  &__stage {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(340px, 0.9fr) minmax(500px, 1.1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 18px 30px;
    width: 100%;
    max-width: 1440px;
    height: 100%;
    min-height: 0;
    margin: 0 auto;
    align-items: center;
    overflow: hidden;
    padding: 22px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background:
      radial-gradient(circle at 30% 44%, rgba(159, 247, 177, 0.08), transparent 34%),
      rgba(8, 10, 8, 0.58);
  }

  &__section-title {
    color: var(--color-accent);
    font-size: var(--font-size-sm);
    letter-spacing: 0;
  }

  &__turntable,
  &__console {
    min-width: 0;
    min-height: 0;
  }

  &__turntable {
    display: grid;
    justify-items: center;
    gap: 16px;
    align-self: center;
  }

  &__disc-wrap {
    width: min(420px, 100%);
  }

  &__console {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 16px;
    align-self: stretch;
    overflow: hidden;
  }

  &__title {
    margin-top: 8px;
    font-size: 42px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__artist {
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);
    overflow-wrap: anywhere;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    padding: 12px 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__stat-label {
    color: var(--color-text-disabled);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__stat-value {
    color: var(--color-text-secondary);
    font-size: var(--font-size-base);

    &--state {
      transition: color var(--transition-fast), opacity var(--transition-fast);
    }

    &--activity {
      color: var(--color-warning);
      opacity: 0.84;
    }

    &--playing {
      color: var(--color-success);
      opacity: 0.82;
    }

    &--paused {
      color: var(--color-text-secondary);
    }

    &--error {
      color: var(--color-error);
      opacity: 0.9;
    }

    &--idle {
      color: var(--color-text-disabled);
    }
  }

  &__lyrics {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  &__wave-panel {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 2px 0 0;
  }

  &__waveform {
    width: min(72%, 720px);
    min-height: 42px;
    height: 42px;
  }
}

@media (max-width: 1399px) {
  .player-view {
    &__stage {
      grid-template-columns: minmax(260px, 0.82fr) minmax(400px, 1.18fr);
      gap: 16px 20px;
    }

    &__disc-wrap {
      width: min(360px, 100%);
    }

    &__title {
      font-size: 36px;
    }
  }
}

@media (max-width: 1100px) {
  .player-view {
    padding: 12px;

    &__stage {
      grid-template-columns: minmax(220px, 0.78fr) minmax(330px, 1.22fr);
      gap: 14px 18px;
      padding: 16px;
    }

    &__disc-wrap {
      width: min(280px, 100%);
    }

    &__console {
      gap: 12px;
    }

    &__title {
      font-size: 30px;
    }

    &__stats {
      gap: 10px;
      padding: 10px 0;
    }

    &__stat {
      gap: 5px;
    }

    &__waveform {
      min-height: 36px;
      height: 36px;
    }
  }
}

@media (max-width: 760px) {
  .player-view {
    &__stage {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
      height: auto;
      min-height: 100%;
      overflow: visible;
    }

    &__console {
      min-height: 420px;
    }

    &__stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    &__title,
    &__artist {
      text-align: center;
    }

    &__header {
      align-items: center;
    }

    &__wave-panel {
      grid-column: auto;
      min-height: 38px;
    }
  }
}

@media (max-height: 760px) {
  .player-view {
    padding: 10px;

    &__stage {
      gap: 12px 18px;
      padding: 14px;
    }

    &__turntable {
      gap: 8px;
    }

    &__disc-wrap {
      width: min(230px, 100%);
    }

    &__console {
      gap: 10px;
    }

    &__title {
      margin-top: 4px;
      font-size: 26px;
    }

    &__stats {
      padding: 7px 0;
    }

    &__stat {
      gap: 3px;
    }

    &__lyrics {
      max-height: 170px;
    }

    &__wave-panel {
      min-height: 32px;
      padding-top: 0;
    }

    &__waveform {
      width: min(76%, 620px);
      min-height: 30px;
      height: 30px;
    }
  }
}

.player-enter-enter-active,
.player-enter-leave-active {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.player-enter-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.player-enter-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
