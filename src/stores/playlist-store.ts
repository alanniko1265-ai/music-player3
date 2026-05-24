/**
 * PlaylistStore - 歌单状态管理（Pinia）
 * 封装 PlaylistManager 服务，提供响应式歌单状态和操作 actions
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Playlist, Track } from '../types'
import { playlistManager } from '../services/playlist-manager'

export const usePlaylistStore = defineStore('playlist', () => {
  /** 所有歌单列表 */
  const playlists = ref<Playlist[]>([])

  /**
   * 初始化：加载 PlaylistManager 并同步歌单数据到响应式状态
   */
  async function init(): Promise<void> {
    await playlistManager.init()
    playlists.value = playlistManager.getAllPlaylists()
  }

  /**
   * 创建新歌单
   * @param name 歌单名称
   * @returns 新创建的歌单
   */
  async function createPlaylist(name: string): Promise<Playlist> {
    const playlist = await playlistManager.createPlaylist(name)
    playlists.value = playlistManager.getAllPlaylists()
    return playlist
  }

  async function createPlaylistWithTracks(name: string, tracks: Track[]): Promise<Playlist> {
    const playlist = await playlistManager.createPlaylistWithTracks(name, tracks)
    playlists.value = playlistManager.getAllPlaylists()
    return playlist
  }

  /**
   * 删除歌单
   * @param id 歌单 ID
   */
  async function deletePlaylist(id: string): Promise<void> {
    await playlistManager.deletePlaylist(id)
    playlists.value = playlistManager.getAllPlaylists()
  }

  /**
   * 重命名歌单
   * @param id 歌单 ID
   * @param newName 新名称
   */
  async function renamePlaylist(id: string, newName: string): Promise<void> {
    await playlistManager.renamePlaylist(id, newName)
    playlists.value = playlistManager.getAllPlaylists()
  }

  /**
   * 向歌单添加曲目
   * @param playlistId 歌单 ID
   * @param track 要添加的曲目
   */
  async function addTrack(playlistId: string, track: Track): Promise<void> {
    await playlistManager.addTrack(playlistId, track)
    playlists.value = playlistManager.getAllPlaylists()
  }

  /**
   * 从歌单移除曲目
   * @param playlistId 歌单 ID
   * @param trackId 曲目 ID
   */
  async function removeTrack(playlistId: string, trackId: string): Promise<void> {
    await playlistManager.removeTrack(playlistId, trackId)
    playlists.value = playlistManager.getAllPlaylists()
  }

  /**
   * 重新排序歌单中的曲目
   * @param playlistId 歌单 ID
   * @param fromIndex 原始位置索引
   * @param toIndex 目标位置索引
   */
  async function reorderTracks(playlistId: string, fromIndex: number, toIndex: number): Promise<void> {
    await playlistManager.reorderTracks(playlistId, fromIndex, toIndex)
    playlists.value = playlistManager.getAllPlaylists()
  }

  return {
    playlists,
    init,
    createPlaylist,
    createPlaylistWithTracks,
    deletePlaylist,
    renamePlaylist,
    addTrack,
    removeTrack,
    reorderTracks,
  }
})
