<template>
  <div class="favorites-view">
    <section class="favorites-view__banner">
      <div>
        <div class="favorites-view__kicker">$ favorites</div>
        <h1 class="favorites-view__title">收藏</h1>
      </div>
      <div class="favorites-view__stats">
        <span>歌曲 {{ favorites.length }}</span>
      </div>
    </section>

    <section class="favorites-view__toolbar">
      <button
        v-if="favorites.length > 0"
        class="favorites-view__btn favorites-view__btn--primary"
        type="button"
        @click="onPlayAll"
      >
        [全部播放]
      </button>
    </section>

    <div class="favorites-view__content">
      <div v-if="favorites.length === 0" class="favorites-view__empty">
        <div class="favorites-view__empty-box">[ 空 ]</div>
        <p>还没有收藏歌曲</p>
      </div>

      <div v-else class="favorites-view__table">
        <div class="favorites-view__table-head">
          <span>#</span>
          <span>标题</span>
          <span>歌手</span>
          <span>专辑</span>
          <span>时长</span>
          <span>状态</span>
        </div>

        <div class="favorites-view__rows">
          <TrackList
            :tracks="favorites"
            @play="onPlayTrack"
            @toggle-favorite="onToggleFavorite"
          />
        </div>
      </div>
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

const favoritesStore = useFavoritesStore()
const playerStore = usePlayerStore()
const { favorites } = storeToRefs(favoritesStore)

onMounted(async () => {
  await favoritesStore.init()
})

async function onPlayAll(): Promise<void> {
  if (favorites.value.length === 0) return
  playerStore.setPlaylist(favorites.value)
  await playerStore.playTrack(favorites.value[0])
}

async function onPlayTrack(track: Track): Promise<void> {
  playerStore.setPlaylist(favorites.value)
  await playerStore.playTrack(track)
}

async function onToggleFavorite(track: Track): Promise<void> {
  await favoritesStore.toggleFavorite(track)
}
</script>

<style lang="scss" scoped>
.favorites-view {
  display: flex;
  flex-direction: column;
  flex: 1;
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
  }

  &__stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  &__btn {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.56);
    color: var(--color-text-secondary);

    &--primary {
      color: #071009;
      background: var(--color-primary);
      border-color: var(--color-primary);
    }
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
    min-height: 100%;
  }

  &__table-head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: 72px minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1fr) 90px 90px;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-primary);
    background: rgba(8, 10, 8, 0.96);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__rows {
    padding: 8px 0;
  }
}
</style>
