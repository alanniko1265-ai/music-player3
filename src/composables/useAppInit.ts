/**
 * useAppInit - 应用启动初始化 composable
 * 在应用启动时协调所有 store 的初始化和状态恢复：
 * - 初始化 PlayerStore（恢复播放状态：当前 Track、播放进度、音量、播放模式）
 * - 初始化 PlaylistStore（从本地存储加载歌单数据）
 * - 初始化 FavoritesStore（从本地存储加载收藏数据）
 * - 创建 PlaybackController 并注入 NeteaseAPIAdapter
 *
 * Validates: Requirements 7.3, 7.4
 */

import { ref, watch, type WatchStopHandle } from 'vue'
import { usePlayerStore } from '@/stores/player-store'
import { usePlaylistStore } from '@/stores/playlist-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'
import { useNeteaseLoginStore } from '@/stores/netease-login-store'
import { NeteaseAPIAdapter } from '@/services/music-api-adapter'
import { QQMusicAPIAdapter } from '@/services/qq-music-adapter'
import { isQQMusicDirectAvailable, QQMusicDirectAdapter } from '@/services/qq-music-direct-adapter'
import { isNeteaseDirectAvailable, NeteaseDirectAdapter } from '@/services/netease-direct-adapter'
import type { MusicAPIAdapter } from '@/services/music-api-adapter'
import type { MusicSource } from '@/types/index'

/**
 * 根据音乐源类型创建对应的 API 适配器
 */
export function createAdapter(source: MusicSource, preferDirect = false): MusicAPIAdapter {
  switch (source) {
    case 'qq':
      if (preferDirect && isQQMusicDirectAvailable()) {
        return new QQMusicDirectAdapter()
      }
      return new QQMusicAPIAdapter()
    case 'netease':
      if (isNeteaseDirectAvailable()) {
        return new NeteaseDirectAdapter()
      }
      return new NeteaseAPIAdapter()
  }
}

function getElectronAPI() {
  return typeof window === 'undefined' ? undefined : window.electronAPI
}

/** 初始化状态 */
export interface AppInitState {
  /** 是否正在初始化 */
  loading: boolean
  /** 是否初始化完成 */
  ready: boolean
  /** 初始化错误信息 */
  error: string | null
}

/**
 * 应用启动初始化 composable
 * 确保所有 store 在 UI 渲染前完成初始化和状态恢复
 * @param apiAdapter 可选的 MusicAPIAdapter 实例（用于测试注入），默认使用 NeteaseAPIAdapter
 */
export function useAppInit(apiAdapter?: MusicAPIAdapter) {
  const loading = ref(true)
  const ready = ref(false)
  const error = ref<string | null>(null)
  let stopAdapterWatch: WatchStopHandle | null = null
  const currentSource = ref<MusicSource>('qq')

  /**
   * 执行应用初始化
   * 初始化顺序：
   * 1. PlaylistStore（加载歌单数据）
   * 2. FavoritesStore（加载收藏数据）
   * 3. PlayerStore（恢复播放状态，依赖 API adapter）
   *
   * PlaylistStore 和 FavoritesStore 可并行初始化，
   * PlayerStore 需要 API adapter 所以独立初始化
   */
  async function initialize(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const playerStore = usePlayerStore()
      const playlistStore = usePlaylistStore()
      const favoritesStore = useFavoritesStore()
      const qqMusicLoginStore = useQQMusicLoginStore()
      const neteaseLoginStore = useNeteaseLoginStore()

      await Promise.all([
        qqMusicLoginStore.initialize(),
        neteaseLoginStore.initialize(),
      ])

      // 从本地存储读取用户偏好的音乐源
      const musicSource: MusicSource = (await getElectronAPI()?.loadData?.('musicSource') as MusicSource) || 'qq'
      currentSource.value = musicSource

      // 创建 API 适配器
      const adapter = apiAdapter || createAdapter(musicSource, qqMusicLoginStore.isLoggedIn)

      // 并行初始化 PlaylistStore 和 FavoritesStore（它们互相独立）
      await Promise.all([
        playlistStore.init(),
        favoritesStore.init(),
      ])

      // 初始化 PlayerStore（恢复播放状态：当前 Track、进度、音量、播放模式）
      await playerStore.initialize(adapter)

      if (!apiAdapter && !stopAdapterWatch) {
        stopAdapterWatch = watch(
          () => qqMusicLoginStore.isLoggedIn,
          (loggedIn) => {
            // 仅在 QQ 音乐模式下切换直连/外部 API 适配器
            if (musicSource === 'qq') {
              playerStore.setApiAdapter(createAdapter('qq', loggedIn))
            }
          },
        )
      }

      ready.value = true
    } catch (e) {
      const message = e instanceof Error ? e.message : '应用初始化失败'
      error.value = message
      console.error('App initialization failed:', e)
    } finally {
      loading.value = false
    }
  }

  /** 切换音乐源并持久化 */
  async function setMusicSource(source: MusicSource): Promise<void> {
    currentSource.value = source
    await getElectronAPI()?.saveData?.('musicSource', source)
    const playerStore = usePlayerStore()
    playerStore.setApiAdapter(createAdapter(source, source === 'qq' && useQQMusicLoginStore().isLoggedIn))
  }

  return {
    loading,
    ready,
    error,
    initialize,
    setMusicSource,
  }
}
