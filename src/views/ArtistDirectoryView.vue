<template>
  <div class="artist-view">
    <section class="artist-view__banner">
      <div>
        <div class="artist-view__breadcrumb">
          <button type="button" @click="goBack">搜索</button>
          <span>/</span>
          <span>歌手目录</span>
        </div>
        <h1 class="artist-view__title">{{ artistName }}</h1>
      </div>
      <div class="artist-view__stats">
        <span>已加载 {{ tracks.length }} 首</span>
        <span v-if="hasMore">还有更多</span>
      </div>
    </section>

    <section class="artist-view__toolbar">
      <div class="artist-view__toolbar-left">
        <button class="artist-view__btn" type="button" @click="goBack">[返回搜索]</button>
        <button class="artist-view__btn" type="button" :disabled="tracks.length === 0" @click="playAll">[播放全部]</button>
        <button
          class="artist-view__btn artist-view__btn--primary"
          type="button"
          :disabled="tracks.length === 0 || isSavingPlaylist"
          @click="saveAsPlaylist"
        >
          {{ isSavingPlaylist ? '[保存中...]' : '[保存为歌单]' }}
        </button>
      </div>
      <span v-if="notice" class="artist-view__notice">{{ notice }}</span>
    </section>

    <div ref="scrollContainerRef" class="artist-view__content" @scroll="onScroll">
      <div v-if="isLoading && tracks.length === 0" class="artist-view__status">
        <div class="artist-view__status-box">[ 检索中 ]</div>
        <p>正在打开 {{ artistName }} 的歌曲目录...</p>
      </div>

      <div v-else-if="error && tracks.length === 0" class="artist-view__status artist-view__status--error">
        <div class="artist-view__status-box">[ 错误 ]</div>
        <p>{{ error }}</p>
        <button class="artist-view__btn" type="button" @click="loadInitial">[重试]</button>
      </div>

      <div v-else-if="tracks.length === 0" class="artist-view__status">
        <div class="artist-view__status-box">[ 空目录 ]</div>
        <p>暂时没有找到 {{ artistName }} 的歌曲</p>
        <button v-if="hasMore" class="artist-view__btn" type="button" @click="loadMore">[继续查找]</button>
      </div>

      <div v-else class="artist-view__results">
        <div class="artist-view__table-head">
          <span>&gt;</span>
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

        <div v-if="isLoadingMore" class="artist-view__footer-state">[ 加载更多 ]</div>
        <div v-else-if="error" class="artist-view__footer-state artist-view__footer-state--error">
          <span>[ 加载失败 ]</span>
          <button class="artist-view__btn" type="button" @click="loadMore">[重试]</button>
        </div>
        <div v-else-if="hasMore" class="artist-view__footer-state">
          <button class="artist-view__btn" type="button" @click="loadMore">[加载更多]</button>
        </div>
        <div v-else class="artist-view__footer-state">[ 已显示当前来源中的全部匹配歌曲 ]</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Track } from '@/types'
import TrackList from '@/components/TrackList.vue'
import { SearchService } from '@/services/search-service'
import { QQMusicAPIAdapter } from '@/services/qq-music-adapter'
import { isQQMusicDirectAvailable, QQMusicDirectAdapter } from '@/services/qq-music-direct-adapter'
import { useFavoritesStore } from '@/stores/favorites-store'
import { usePlayerStore } from '@/stores/player-store'
import { usePlaylistStore } from '@/stores/playlist-store'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'
import { trackIncludesArtist } from '@/utils/artist-directory'

const route = useRoute()
const router = useRouter()
const loginStore = useQQMusicLoginStore()
const playerStore = usePlayerStore()
const favoritesStore = useFavoritesStore()
const playlistStore = usePlaylistStore()
const searchService = new SearchService(createQQAdapter())

const artistName = computed(() => String(route.params.artist || '').trim())
const tracks = ref<Track[]>([])
const currentPage = ref(1)
const hasMore = ref(false)
const isLoading = ref(false)
const isLoadingMore = ref(false)
const isSavingPlaylist = ref(false)
const error = ref<string | null>(null)
const notice = ref('')
const scrollContainerRef = ref<HTMLElement | null>(null)
let noticeTimer: ReturnType<typeof setTimeout> | null = null

function createQQAdapter() {
  return loginStore.isLoggedIn && isQQMusicDirectAvailable()
    ? new QQMusicDirectAdapter()
    : new QQMusicAPIAdapter()
}

function appendMatchingTracks(incoming: Track[]): void {
  const knownIds = new Set(tracks.value.map(track => `${track.source}:${track.id}`))
  const matches = incoming.filter(track => {
    const key = `${track.source}:${track.id}`
    if (!trackIncludesArtist(track, artistName.value) || knownIds.has(key)) {
      return false
    }
    knownIds.add(key)
    return true
  })
  tracks.value = [...tracks.value, ...matches]
}

async function loadInitial(): Promise<void> {
  if (!artistName.value) return

  tracks.value = []
  currentPage.value = 1
  isLoading.value = true
  error.value = null

  try {
    const result = await searchService.search(artistName.value, 1)
    appendMatchingTracks(result.tracks)
    hasMore.value = result.hasMore
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '歌手目录加载失败'
    hasMore.value = false
  } finally {
    isLoading.value = false
  }
}

async function loadMore(): Promise<void> {
  if (!artistName.value || !hasMore.value || isLoadingMore.value) return

  isLoadingMore.value = true
  error.value = null
  const nextPage = currentPage.value + 1

  try {
    const result = await searchService.search(artistName.value, nextPage)
    appendMatchingTracks(result.tracks)
    currentPage.value = nextPage
    hasMore.value = result.hasMore
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '加载更多失败'
  } finally {
    isLoadingMore.value = false
  }
}

function onScroll(): void {
  if (!scrollContainerRef.value || !hasMore.value || isLoadingMore.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.value
  if (scrollTop + clientHeight >= scrollHeight - 200) {
    void loadMore()
  }
}

async function onPlayTrack(track: Track): Promise<void> {
  playerStore.setPlaylist(tracks.value)
  await playerStore.playTrack(track)
}

async function playAll(): Promise<void> {
  const firstTrack = tracks.value[0]
  if (!firstTrack) return
  await onPlayTrack(firstTrack)
}

async function onToggleFavorite(track: Track): Promise<void> {
  await favoritesStore.toggleFavorite(track)
}

async function saveAsPlaylist(): Promise<void> {
  if (tracks.value.length === 0 || isSavingPlaylist.value) return

  isSavingPlaylist.value = true
  try {
    const playlist = await playlistStore.createPlaylistWithTracks(
      `${artistName.value} 的歌曲`,
      tracks.value,
    )
    showNotice(`已创建歌单「${playlist.name}」`)
  } catch (saveError) {
    showNotice(saveError instanceof Error ? saveError.message : '歌单保存失败')
  } finally {
    isSavingPlaylist.value = false
  }
}

function showNotice(message: string): void {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 3000)
}

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'search' })
  }
}

watch(
  () => loginStore.isLoggedIn,
  () => {
    searchService.setAdapter(createQQAdapter())
    void loadInitial()
  },
)

watch(artistName, () => {
  void loadInitial()
})

onMounted(() => {
  void loadInitial()
})
</script>

<style lang="scss" scoped>
.artist-view {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;

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

  &__breadcrumb,
  &__stats,
  &__notice {
    display: flex;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  &__breadcrumb button {
    color: var(--color-accent);
  }

  &__title {
    margin: 2px 0 0;
    font-size: var(--font-size-xl);
  }

  &__toolbar-left {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  &__notice {
    color: var(--color-primary);
  }

  &__btn {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.56);
    color: var(--color-text-secondary);

    &:hover:not(:disabled) {
      color: var(--color-text);
      border-color: var(--color-primary);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    &--primary {
      color: #071009;
      border-color: var(--color-primary);
      background: var(--color-primary);
    }
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
    align-content: center;
    gap: 10px;
    padding: 28px;
    color: var(--color-text-secondary);
    text-align: center;

    p { margin: 0; }

    &--error { color: var(--color-error); }
  }

  &__status-box { color: var(--color-primary); }

  &__results {
    display: flex;
    min-height: 100%;
    flex-direction: column;
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
  }

  &__footer-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--color-divider);
    color: var(--color-text-secondary);

    &--error { color: var(--color-error); }
  }
}
</style>
