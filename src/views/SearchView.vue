<template>
  <div class="search-view">
    <section class="search-view__banner">
      <div>
        <div class="search-view__kicker">$ search</div>
        <h1 class="search-view__title">曲库</h1>
      </div>
      <div class="search-view__stats">
        <span>结果 {{ tracks.length }}</span>
        <span v-if="currentKeyword">"{{ currentKeyword }}"</span>
        <span v-else>idle</span>
      </div>
    </section>

    <section class="search-view__toolbar">
      <div class="search-view__toolbar-input">
        <SearchInput
          v-model="keyword"
          :suggestions="suggestions"
          :history="searchHistory"
          @submit="onSearch"
          @suggest="onSuggest"
          @clear="onClear"
        />
      </div>
    </section>

    <div
      ref="scrollContainerRef"
      class="search-view__content"
      @scroll="onScroll"
    >
      <div v-if="!hasSearched && !isLoading" class="search-view__status">
        <div class="search-view__status-box">[ 就绪 ]</div>
        <p>输入歌曲、歌手或专辑开始搜索</p>
      </div>

      <div v-else-if="isLoading && tracks.length === 0" class="search-view__status">
        <div class="search-view__status-box">[ 检索中 ]</div>
        <p>正在搜索音乐源...</p>
      </div>

      <div v-else-if="error && tracks.length === 0" class="search-view__status search-view__status--error">
        <div class="search-view__status-box">[ 错误 ]</div>
        <p>{{ error }}</p>
        <button class="search-view__btn" type="button" @click="retry">[重试]</button>
      </div>

      <div v-else-if="hasSearched && !isLoading && tracks.length === 0 && !error" class="search-view__status">
        <div class="search-view__status-box">[ 空 ]</div>
        <p>没有找到匹配歌曲</p>
      </div>

      <div v-else class="search-view__results">
        <div class="search-view__table-head">
          <span>></span>
          <span>标题</span>
          <span>歌手</span>
          <span>专辑</span>
          <span>时长</span>
          <span>操作</span>
        </div>

        <TrackList
          :tracks="tracks"
          @play="onPlayTrack"
          @toggle-favorite="onToggleFavorite"
        />

        <div v-if="isLoadingMore" class="search-view__footer-state">
          <span class="search-view__footer-pill">[ 加载更多 ]</span>
        </div>

        <div v-else-if="error && tracks.length > 0" class="search-view__footer-state search-view__footer-state--error">
          <span class="search-view__footer-pill">[ 加载失败 ]</span>
          <button class="search-view__btn" type="button" @click="loadMore">[重试]</button>
        </div>

        <div v-else-if="!hasMore && tracks.length > 0" class="search-view__footer-state">
          <span class="search-view__footer-pill">[ 到底了 ]</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Track } from '@/types'
import SearchInput from '@/components/SearchInput.vue'
import TrackList from '@/components/TrackList.vue'
import { SearchService } from '@/services/search-service'
import { QQMusicAPIAdapter } from '@/services/qq-music-adapter'
import { isQQMusicDirectAvailable, QQMusicDirectAdapter } from '@/services/qq-music-direct-adapter'
import { usePlayerStore } from '@/stores/player-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'

const loginStore = useQQMusicLoginStore()
const searchService = new SearchService(createQQAdapter())
const playerStore = usePlayerStore()
const favoritesStore = useFavoritesStore()

function createQQAdapter() {
  return loginStore.isLoggedIn && isQQMusicDirectAvailable()
    ? new QQMusicDirectAdapter()
    : new QQMusicAPIAdapter()
}

watch(
  () => loginStore.isLoggedIn,
  () => {
    searchService.setAdapter(createQQAdapter())
  },
)

const keyword = ref('')
const tracks = ref<Track[]>([])
const suggestions = ref<string[]>([])
const searchHistory = ref<string[]>([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const hasSearched = ref(false)
const hasMore = ref(false)
const error = ref<string | null>(null)
const currentPage = ref(1)
const currentKeyword = ref('')
const scrollContainerRef = ref<HTMLElement | null>(null)

searchHistory.value = searchService.getSearchHistory()

async function onSearch(searchKeyword: string): Promise<void> {
  if (!searchKeyword.trim()) return

  const trimmed = searchKeyword.trim()
  currentKeyword.value = trimmed
  currentPage.value = 1
  tracks.value = []
  hasSearched.value = true
  isLoading.value = true
  error.value = null
  hasMore.value = false

  searchService.addToHistory(trimmed)
  searchHistory.value = searchService.getSearchHistory()

  try {
    const result = await searchService.search(trimmed, 1)
    tracks.value = result.tracks
    hasMore.value = result.hasMore
    currentPage.value = 1
  } catch (err: any) {
    error.value = err?.message || '搜索失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (isLoadingMore.value || !hasMore.value || !currentKeyword.value) return

  isLoadingMore.value = true
  error.value = null
  const nextPage = currentPage.value + 1

  try {
    const result = await searchService.search(currentKeyword.value, nextPage)
    tracks.value = [...tracks.value, ...result.tracks]
    hasMore.value = result.hasMore
    currentPage.value = nextPage
  } catch (err: any) {
    error.value = err?.message || '加载更多失败'
  } finally {
    isLoadingMore.value = false
  }
}

function retry(): void {
  if (currentKeyword.value) {
    onSearch(currentKeyword.value)
  }
}

async function onSuggest(value: string): Promise<void> {
  if (!value.trim()) {
    suggestions.value = []
    return
  }

  try {
    suggestions.value = await searchService.getSuggestions(value.trim())
  } catch {
    suggestions.value = []
  }
}

function onClear(): void {
  keyword.value = ''
  suggestions.value = []
}

function onScroll(): void {
  if (!scrollContainerRef.value || !hasMore.value || isLoadingMore.value) return

  const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.value
  const threshold = 200

  if (scrollTop + clientHeight >= scrollHeight - threshold) {
    loadMore()
  }
}

async function onPlayTrack(track: Track): Promise<void> {
  playerStore.setPlaylist(tracks.value)
  await playerStore.playTrack(track)
}

async function onToggleFavorite(track: Track): Promise<void> {
  await favoritesStore.toggleFavorite(track)
}

onBeforeUnmount(() => {
  // Reserved for future cleanup.
})
</script>

<style lang="scss" scoped>
.search-view {
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
  &__toolbar-hint {
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

  &__toolbar-input {
    flex: 1;
    min-width: 0;
  }

  &__toolbar-hint {
    white-space: nowrap;
  }

  &__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: rgba(8, 10, 8, 0.38);
  }

  &__status {
    min-height: 100%;
    display: grid;
    place-items: center;
    gap: 10px;
    padding: 28px;
    color: var(--color-text-secondary);
    text-align: center;

    p {
      margin: 0;
    }

    &--error {
      color: var(--color-error);
    }
  }

  &__status-box,
  &__footer-pill {
    color: var(--color-primary);
  }

  &__results {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  &__table-head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: 18px minmax(120px, 1.2fr) minmax(100px, 0.9fr) minmax(100px, 1fr) 56px 156px;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-primary);
    background: rgba(8, 10, 8, 0.96);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__footer-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--color-divider);
    color: var(--color-text-secondary);

    &--error {
      color: var(--color-error);
    }
  }

  &__btn {
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
}
</style>
