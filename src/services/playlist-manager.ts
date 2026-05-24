/**
 * PlaylistManager - 歌单管理服务
 * 处理歌单的 CRUD 操作和曲目管理，所有变更持久化到本地存储
 */

import type { Playlist, Track } from '../types'
import { storageService } from './ipc-renderer'

const STORAGE_KEY = 'playlists'

/**
 * 生成唯一 ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback: 简单的随机 ID 生成
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 12)
}

/**
 * 歌单管理器
 */
export class PlaylistManager {
  private playlists: Playlist[] = []

  /**
   * 初始化：从本地存储加载歌单数据
   */
  async init(): Promise<void> {
    this.playlists = await storageService.load<Playlist[]>(STORAGE_KEY, [])
  }

  /**
   * 持久化当前歌单数据到本地存储
   */
  private async persist(): Promise<void> {
    await storageService.save(STORAGE_KEY, this.playlists)
  }

  /**
   * 创建新歌单
   * @param name 歌单名称
   * @returns 新创建的歌单
   */
  async createPlaylist(name: string): Promise<Playlist> {
    const now = Date.now()
    const playlist: Playlist = {
      id: generateId(),
      name,
      tracks: [],
      createdAt: now,
      updatedAt: now,
    }
    this.playlists.push(playlist)
    await this.persist()
    return playlist
  }

  async createPlaylistWithTracks(name: string, tracks: Track[]): Promise<Playlist> {
    const now = Date.now()
    const seenTrackIds = new Set<string>()
    const uniqueTracks = tracks.filter((track) => {
      if (seenTrackIds.has(track.id)) {
        return false
      }
      seenTrackIds.add(track.id)
      return true
    })
    const playlist: Playlist = {
      id: generateId(),
      name,
      tracks: uniqueTracks,
      createdAt: now,
      updatedAt: now,
    }
    this.playlists.push(playlist)
    await this.persist()
    return playlist
  }

  /**
   * 删除歌单
   * @param id 歌单 ID
   */
  async deletePlaylist(id: string): Promise<void> {
    const index = this.playlists.findIndex((p) => p.id === id)
    if (index === -1) {
      throw new Error(`Playlist not found: ${id}`)
    }
    this.playlists.splice(index, 1)
    await this.persist()
  }

  /**
   * 重命名歌单
   * @param id 歌单 ID
   * @param newName 新名称
   */
  async renamePlaylist(id: string, newName: string): Promise<void> {
    const playlist = this.playlists.find((p) => p.id === id)
    if (!playlist) {
      throw new Error(`Playlist not found: ${id}`)
    }
    playlist.name = newName
    playlist.updatedAt = Date.now()
    await this.persist()
  }

  /**
   * 向歌单添加曲目（避免重复）
   * @param playlistId 歌单 ID
   * @param track 要添加的曲目
   */
  async addTrack(playlistId: string, track: Track): Promise<void> {
    const playlist = this.playlists.find((p) => p.id === playlistId)
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`)
    }
    // 避免重复添加
    const exists = playlist.tracks.some((t) => t.id === track.id)
    if (exists) {
      return
    }
    playlist.tracks.push(track)
    playlist.updatedAt = Date.now()
    await this.persist()
  }

  /**
   * 从歌单移除曲目
   * @param playlistId 歌单 ID
   * @param trackId 曲目 ID
   */
  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    const playlist = this.playlists.find((p) => p.id === playlistId)
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`)
    }
    const index = playlist.tracks.findIndex((t) => t.id === trackId)
    if (index === -1) {
      throw new Error(`Track not found in playlist: ${trackId}`)
    }
    playlist.tracks.splice(index, 1)
    playlist.updatedAt = Date.now()
    await this.persist()
  }

  /**
   * 重新排序歌单中的曲目
   * @param playlistId 歌单 ID
   * @param fromIndex 原始位置索引
   * @param toIndex 目标位置索引
   */
  async reorderTracks(playlistId: string, fromIndex: number, toIndex: number): Promise<void> {
    const playlist = this.playlists.find((p) => p.id === playlistId)
    if (!playlist) {
      throw new Error(`Playlist not found: ${playlistId}`)
    }
    const { tracks } = playlist
    if (fromIndex < 0 || fromIndex >= tracks.length) {
      throw new Error(`Invalid fromIndex: ${fromIndex}`)
    }
    if (toIndex < 0 || toIndex >= tracks.length) {
      throw new Error(`Invalid toIndex: ${toIndex}`)
    }
    // 移除元素并插入到新位置
    const [moved] = tracks.splice(fromIndex, 1)
    tracks.splice(toIndex, 0, moved)
    playlist.updatedAt = Date.now()
    await this.persist()
  }

  /**
   * 获取单个歌单
   * @param id 歌单 ID
   * @returns 歌单对象
   */
  getPlaylist(id: string): Playlist | undefined {
    return this.playlists.find((p) => p.id === id)
  }

  /**
   * 获取所有歌单
   * @returns 歌单数组
   */
  getAllPlaylists(): Playlist[] {
    return this.playlists
  }
}

/** 单例实例 */
export const playlistManager = new PlaylistManager()
