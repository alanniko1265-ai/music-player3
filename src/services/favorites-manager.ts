/**
 * FavoritesManager - 收藏管理服务
 * 负责管理用户收藏的曲目，支持收藏切换、查询和持久化存储
 */

import type { Track } from '@/types'
import { storageService } from './ipc-renderer'

const STORAGE_KEY = 'favorites'

/**
 * StorageService 接口，用于依赖注入和测试
 */
export interface StorageServiceInterface {
  save<T>(key: string, data: T): Promise<void>
  load<T>(key: string, defaultValue: T): Promise<T>
}

/**
 * FavoritesManager 类
 * 管理收藏曲目的添加、移除、查询和持久化
 */
export class FavoritesManager {
  private favorites: Track[] = []
  private initialized = false
  private storage: StorageServiceInterface

  constructor(storage?: StorageServiceInterface) {
    this.storage = storage ?? storageService
  }

  /**
   * 初始化：从本地存储加载收藏数据
   */
  async init(): Promise<void> {
    if (this.initialized) return
    this.favorites = await this.storage.load<Track[]>(STORAGE_KEY, [])
    this.initialized = true
  }

  /**
   * 切换收藏状态
   * 如果曲目已收藏则移除，否则添加
   * @param track 要切换收藏状态的曲目
   * @returns true 表示现在已收藏，false 表示已取消收藏
   */
  async toggleFavorite(track: Track): Promise<boolean> {
    await this.ensureInitialized()

    const index = this.favorites.findIndex(t => t.id === track.id)

    if (index !== -1) {
      // 已收藏，移除
      this.favorites.splice(index, 1)
      await this.persist()
      return false
    } else {
      // 未收藏，添加
      this.favorites.push(track)
      await this.persist()
      return true
    }
  }

  /**
   * 检查曲目是否已收藏
   * @param trackId 曲目 ID
   * @returns 是否已收藏
   */
  isFavorite(trackId: string): boolean {
    return this.favorites.some(t => t.id === trackId)
  }

  /**
   * 获取所有收藏的曲目
   * @returns 收藏曲目列表
   */
  async getAllFavorites(): Promise<Track[]> {
    await this.ensureInitialized()
    return [...this.favorites]
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init()
    }
  }

  /**
   * 持久化收藏数据到本地存储
   */
  private async persist(): Promise<void> {
    await this.storage.save(STORAGE_KEY, this.favorites)
  }
}
