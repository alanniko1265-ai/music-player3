<template>
  <transition name="player-enter" appear>
    <div class="player-view">
      <!-- Blur background based on current track cover -->
      <BlurBackground :cover-url="currentTrack?.coverUrl" />

      <div class="player-view__content">
        <!-- Large album cover -->
        <div class="player-view__cover-wrapper">
          <CoverArt
            :src="currentTrack?.coverUrl ?? ''"
            :alt="coverAlt"
            :size="300"
          />
        </div>

        <!-- Track info -->
        <div class="player-view__track-info">
          <h1 class="player-view__title">
            {{ currentTrack?.title ?? '未在播放' }}
          </h1>
          <p class="player-view__artist">
            {{ currentTrack?.artist ?? '选择一首歌曲开始播放' }}
          </p>
        </div>

        <!-- Lyrics panel -->
        <div class="player-view__lyrics">
          <LyricsPanel
            :lyrics="lyrics"
            :current-time="currentTime"
            :is-expanded="lyricsExpanded"
            @seek="handleSeek"
            @toggle-expand="lyricsExpanded = !lyricsExpanded"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BlurBackground from '../components/BlurBackground.vue'
import CoverArt from '../components/CoverArt.vue'
import LyricsPanel from '../components/LyricsPanel.vue'
import { usePlayerStore } from '../stores/player-store'
import { LyricsService } from '../services/lyrics-service'
import { QQMusicAPIAdapter } from '../services/qq-music-adapter'
import { isQQMusicDirectAvailable, QQMusicDirectAdapter } from '../services/qq-music-direct-adapter'
import { useQQMusicLoginStore } from '../stores/qq-music-login-store'
import type { LyricLine } from '../types/index'

const playerStore = usePlayerStore()
const loginStore = useQQMusicLoginStore()

// Lyrics state
const lyrics = ref<LyricLine[]>([])
const lyricsExpanded = ref(true)
let lyricsService = new LyricsService(createQQAdapter())

// Computed from store
const currentTrack = computed(() => playerStore.currentTrack)
const currentTime = computed(() => playerStore.currentTime)

function createQQAdapter() {
  return loginStore.isLoggedIn && isQQMusicDirectAvailable()
    ? new QQMusicDirectAdapter()
    : new QQMusicAPIAdapter()
}

const coverAlt = computed(() =>
  currentTrack.value
    ? `${currentTrack.value.title} - ${currentTrack.value.artist} 专辑封面`
    : '专辑封面'
)

/**
 * Handle seek event from LyricsPanel
 * Jumps playback to the specified time
 */
function handleSeek(time: number) {
  playerStore.seek(time)
}

/**
 * Fetch lyrics when the current track changes
 */
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
  { immediate: true }
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
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  padding: var(--spacing-xl, 32px) var(--spacing-base, 16px);
  overflow-y: auto;

  &__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 500px;
    gap: var(--spacing-lg, 24px);
  }

  &__cover-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  &__track-info {
    text-align: center;
    width: 100%;
  }

  &__title {
    margin: 0;
    font-size: var(--font-size-xl, 24px);
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text, #FFFFFF);
    line-height: var(--line-height-tight, 1.2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__artist {
    margin: var(--spacing-sm, 8px) 0 0;
    font-size: var(--font-size-md, 16px);
    color: var(--color-text-secondary, #B3B3B3);
    line-height: var(--line-height-base, 1.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__lyrics {
    width: 100%;
  }
}

/* Page entry transition: fade + slide up */
.player-enter-enter-active {
  transition:
    opacity var(--transition-slow, 350ms ease),
    transform var(--transition-slow, 350ms ease);
}

.player-enter-leave-active {
  transition:
    opacity var(--transition-base, 250ms ease),
    transform var(--transition-base, 250ms ease);
}

.player-enter-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.player-enter-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
