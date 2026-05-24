/**
 * FavoritesStore - 收藏状态管理（Pinia Store）
 * 使用 setup 语法包装 FavoritesManager 服务，提供响应式收藏状态
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Track } from '@/types'
import { FavoritesManager } from '@/services/favorites-manager'

export const useFavoritesStore = defineStore('favorites', () => {
  // 响应式状态：收藏曲目列表
  const favorites = ref<Track[]>([])

  // FavoritesManager 实例
  const favoritesManager = new FavoritesManager()

  // 初始化标记
  let initialized = false

  /**
   * 初始化 store：加载收藏数据
   */
  async function init(): Promise<void> {
    if (initialized) return
    await favoritesManager.init()
    favorites.value = await favoritesManager.getAllFavorites()
    initialized = true
  }

  /**
   * 切换收藏状态
   * 如果曲目已收藏则移除，否则添加
   * @param track 要切换收藏状态的曲目
   */
  async function toggleFavorite(track: Track): Promise<void> {
    await favoritesManager.toggleFavorite(track)
    favorites.value = await favoritesManager.getAllFavorites()
  }

  /**
   * 检查曲目是否已收藏
   * @param trackId 曲目 ID
   * @returns 是否已收藏
   */
  function isFavorite(trackId: string): boolean {
    return favoritesManager.isFavorite(trackId)
  }

  return {
    favorites,
    init,
    toggleFavorite,
    isFavorite,
  }
})
