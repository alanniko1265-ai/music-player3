<template>
  <div class="favorites-view">
    <!-- 页面头部 -->
    <div class="favorites-view__header">
      <h1 class="favorites-view__title">收藏</h1>
      <button
        v-if="favorites.length > 0"
        class="favorites-view__play-all-btn"
        type="button"
        @click="onPlayAll"
      >
        <svg
          class="favorites-view__play-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        播放全部
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="favorites-view__content">
      <!-- 空状态 -->
      <div v-if="favorites.length === 0" class="favorites-view__empty">
        <svg
          class="favorites-view__empty-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <p class="favorites-view__empty-text">还没有收藏的歌曲</p>
        <p class="favorites-view__empty-hint">点击曲目旁的心形图标即可收藏</p>
      </div>

      <!-- 收藏列表 -->
      <TrackList
        v-else
        :tracks="favorites"
        @play="onPlayTrack"
        @toggle-favorite="onToggleFavorite"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import type { Track } from '@/types'
import TrackList from '@/components/TrackList.vue'
import { useFavoritesStore } from '@/stores/favorites-store'
import { usePlayerStore } from '@/stores/player-store'

// ========== Stores ==========
const favoritesStore = useFavoritesStore()
const playerStore = usePlayerStore()

// 使用 storeToRefs 保持响应式
const { favorites } = storeToRefs(favoritesStore)

// ========== Lifecycle ==========
onMounted(async () => {
  await favoritesStore.init()
})

// ========== Actions ==========

/**
 * 播放全部收藏曲目
 * 将收藏列表设为播放队列，从第一首开始播放
 */
async function onPlayAll(): Promise<void> {
  if (favorites.value.length === 0) return
  playerStore.setPlaylist(favorites.value)
  await playerStore.playTrack(favorites.value[0])
}

/**
 * 播放指定曲目
 * 将收藏列表设为播放队列，从选中曲目开始播放
 */
async function onPlayTrack(track: Track): Promise<void> {
  playerStore.setPlaylist(favorites.value)
  await playerStore.playTrack(track)
}

/**
 * 切换收藏状态（取消收藏）
 */
async function onToggleFavorite(track: Track): Promise<void> {
  await favoritesStore.toggleFavorite(track)
}
</script>

<style lang="scss" scoped>
.favorites-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    flex-shrink: 0;
  }

  &__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    margin: 0;
  }

  &__play-all-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-primary);
    color: var(--color-text);
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast);

    &:hover {
      background: var(--color-primary-hover);
      transform: scale(1.02);
    }

    &:active {
      background: var(--color-primary-active);
      transform: scale(0.98);
    }
  }

  &__play-icon {
    width: 18px;
    height: 18px;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__empty-icon {
    width: 64px;
    height: 64px;
    color: var(--color-accent);
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
}
</style>
