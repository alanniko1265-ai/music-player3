<template>
  <div class="search-view">
    <!-- 搜索栏 -->
    <div class="search-view__header">
      <SearchInput
        v-model="keyword"
        :suggestions="suggestions"
        :history="searchHistory"
        @submit="onSearch"
        @suggest="onSuggest"
        @clear="onClear"
      />
    </div>

    <!-- 搜索结果区域 -->
    <div
      ref="scrollContainerRef"
      class="search-view__content"
      @scroll="onScroll"
    >
      <!-- 初始空状态（未搜索） -->
      <div v-if="!hasSearched && !isLoading" class="search-view__initial">
        <svg class="search-view__initial-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <p class="search-view__initial-text">搜索你喜欢的音乐</p>
      </div>

      <!-- 加载中（首次搜索） -->
      <div v-else-if="isLoading && tracks.length === 0" class="search-view__loading">
        <div class="search-view__spinner" aria-label="加载中"></div>
        <p class="search-view__loading-text">搜索中...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error && tracks.length === 0" class="search-view__error">
        <svg class="search-view__error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="search-view__error-text">{{ error }}</p>
        <button class="search-view__retry-btn" @click="retry" type="button">
          重试
        </button>
      </div>

      <!-- 无结果状态 -->
      <div v-else-if="hasSearched && !isLoading && tracks.length === 0 && !error" class="search-view__empty">
        <svg class="search-view__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
        </svg>
        <p class="search-view__empty-text">未找到相关结果</p>
        <p class="search-view__empty-hint">试试其他关键词</p>
      </div>

      <!-- 搜索结果列表 -->
      <div v-else class="search-view__results">
        <TrackList
          :tracks="tracks"
          @play="onPlayTrack"
          @toggle-favorite="onToggleFavorite"
        />

        <!-- 加载更多指示器 -->
        <div v-if="isLoadingMore" class="search-view__load-more">
          <div class="search-view__spinner search-view__spinner--small" aria-label="加载更多"></div>
          <span class="search-view__load-more-text">加载更多...</span>
        </div>

        <!-- 底部错误（加载更多失败） -->
        <div v-else-if="error && tracks.length > 0" class="search-view__load-more-error">
          <p class="search-view__load-more-error-text">{{ error }}</p>
          <button class="search-view__retry-btn search-view__retry-btn--small" @click="loadMore" type="button">
            重试
          </button>
        </div>

        <!-- 没有更多结果 -->
        <div v-else-if="!hasMore && tracks.length > 0" class="search-view__no-more">
          <p class="search-view__no-more-text">已加载全部结果</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue'
import type { Track } from '@/types'
import SearchInput from '@/components/SearchInput.vue'
import TrackList from '@/components/TrackList.vue'
import { SearchService } from '@/services/search-service'
import { QQMusicAPIAdapter } from '@/services/qq-music-adapter'
import { isQQMusicDirectAvailable, QQMusicDirectAdapter } from '@/services/qq-music-direct-adapter'
import { usePlayerStore } from '@/stores/player-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'

// ========== Services & Stores ==========
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

// ========== Reactive State ==========
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

// ========== Initialize ==========
// Load search history on mount
searchHistory.value = searchService.getSearchHistory()

// ========== Search Logic ==========

/**
 * 执行搜索
 */
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

  // 添加到搜索历史
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

/**
 * 加载更多结果
 */
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
    error.value = err?.message || '加载更多失败，请稍后重试'
  } finally {
    isLoadingMore.value = false
  }
}

/**
 * 重试搜索
 */
function retry(): void {
  if (currentKeyword.value) {
    onSearch(currentKeyword.value)
  }
}

/**
 * 获取搜索建议
 */
async function onSuggest(value: string): Promise<void> {
  if (!value.trim()) {
    suggestions.value = []
    return
  }

  try {
    suggestions.value = await searchService.getSuggestions(value.trim())
  } catch {
    // 搜索建议失败静默处理
    suggestions.value = []
  }
}

/**
 * 清空搜索
 */
function onClear(): void {
  keyword.value = ''
  suggestions.value = []
}

// ========== Infinite Scroll ==========

/**
 * 滚动事件处理：检测是否接近底部，触发加载更多
 */
function onScroll(): void {
  if (!scrollContainerRef.value || !hasMore.value || isLoadingMore.value) return

  const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.value
  const threshold = 200 // 距离底部 200px 时触发加载

  if (scrollTop + clientHeight >= scrollHeight - threshold) {
    loadMore()
  }
}

// ========== Track Actions ==========

/**
 * 播放曲目
 */
async function onPlayTrack(track: Track): Promise<void> {
  // 将搜索结果设为播放队列
  playerStore.setPlaylist(tracks.value)
  await playerStore.playTrack(track)
}

/**
 * 切换收藏
 */
async function onToggleFavorite(track: Track): Promise<void> {
  await favoritesStore.toggleFavorite(track)
}

// ========== Cleanup ==========
onBeforeUnmount(() => {
  // 清理工作（如有需要）
})
</script>

<style lang="scss" scoped>
.search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  &__header {
    padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-base);
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
  }

  // 初始空状态
  &__initial {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__initial-icon {
    width: 64px;
    height: 64px;
    color: var(--color-text-secondary);
    opacity: 0.4;
    margin-bottom: var(--spacing-base);
  }

  &__initial-text {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin: 0;
  }

  // 加载状态
  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__loading-text {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    margin: var(--spacing-base) 0 0;
  }

  // 加载动画
  &__spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;

    &--small {
      width: 20px;
      height: 20px;
      border-width: 2px;
    }
  }

  // 错误状态
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__error-icon {
    width: 48px;
    height: 48px;
    color: var(--color-error);
    opacity: 0.8;
    margin-bottom: var(--spacing-base);
  }

  &__error-text {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-base);
    text-align: center;
  }

  // 重试按钮
  &__retry-btn {
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

    &--small {
      padding: var(--spacing-xs) var(--spacing-base);
      font-size: var(--font-size-sm);
    }
  }

  // 无结果状态
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

  // 搜索结果
  &__results {
    display: flex;
    flex-direction: column;
  }

  // 加载更多
  &__load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg) 0;
  }

  &__load-more-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  // 加载更多错误
  &__load-more-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-base) 0;
    gap: var(--spacing-sm);
  }

  &__load-more-error-text {
    font-size: var(--font-size-sm);
    color: var(--color-error);
    margin: 0;
  }

  // 没有更多
  &__no-more {
    display: flex;
    justify-content: center;
    padding: var(--spacing-lg) 0;
  }

  &__no-more-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-disabled);
    margin: 0;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
