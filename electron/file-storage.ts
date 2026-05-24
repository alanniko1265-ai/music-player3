/**
 * FileStorageService - 本地数据持久化服务
 * 基于 electron-store 实现类型安全的数据存储
 * 支持 playlists、favorites、searchHistory、playbackState 的存储
 */

import type { Playlist, PlaybackState, Track, MusicSource } from '../src/types/index'

/** 存储数据结构定义 */
export interface StorageSchema {
  playlists: Playlist[]
  favorites: Track[]
  searchHistory: string[]
  playbackState: PlaybackState
  playerPlaylist: Track[]
  musicSource: MusicSource
}

/** 存储键名类型 */
export type StorageKey = keyof StorageSchema

/** 默认存储数据 */
const DEFAULT_DATA: StorageSchema = {
  playlists: [],
  favorites: [],
  searchHistory: [],
  playbackState: {
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 80,
    playMode: 'sequential' as any
  },
  playerPlaylist: [],
  musicSource: 'qq',
}

/**
 * 文件存储服务类
 * 提供类型安全的 save/load/remove 方法
 */
export class FileStorageService {
  private store: any = null

  /**
   * 获取或初始化 electron-store 实例
   */
  private async getStore(): Promise<any> {
    if (!this.store) {
      const Store = (await import('electron-store')).default
      this.store = new Store({
        name: 'music-player-data',
        defaults: DEFAULT_DATA
      })
    }
    return this.store
  }

  /**
   * 保存数据到本地存储
   * @param key 存储键名
   * @param data 要保存的数据
   */
  async save<K extends StorageKey>(key: K, data: StorageSchema[K]): Promise<void> {
    const store = await this.getStore()
    store.set(key, data)
  }

  /**
   * 从本地存储加载数据
   * @param key 存储键名
   * @returns 存储的数据，如果不存在则返回默认值
   */
  async load<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
    const store = await this.getStore()
    return store.get(key) ?? DEFAULT_DATA[key]
  }

  /**
   * 从本地存储删除数据（重置为默认值）
   * @param key 存储键名
   */
  async remove<K extends StorageKey>(key: K): Promise<void> {
    const store = await this.getStore()
    store.delete(key)
  }
}

/** 单例实例 */
export const fileStorageService = new FileStorageService()
