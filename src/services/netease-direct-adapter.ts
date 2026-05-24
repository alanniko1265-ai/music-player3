/**
 * NetEase Cloud Music Direct Adapter
 * Calls the Electron main process via IPC, which uses NeteaseCloudMusicApi
 * No external HTTP server needed
 */

import type { SearchResult, Track, LyricLine } from '@/types/index'
import type { MusicAPIAdapter } from './music-api-adapter'

export function isNeteaseDirectAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.netease
}

export class NeteaseDirectAdapter implements MusicAPIAdapter {
  private get bridge() {
    if (!window.electronAPI?.netease) {
      throw new Error('Netease IPC bridge not available (requires Electron)')
    }
    return window.electronAPI.netease
  }

  async search(keyword: string, page: number, pageSize: number): Promise<SearchResult> {
    const res = await this.bridge.search(keyword, page, pageSize)
    if (!res.success) throw new Error(res.error || 'Search failed')

    const body = res.data as any
    const result = body.result || {}
    const songs = result.songs || []
    const tracks: Track[] = songs.map((s: any) => ({
      id: String(s.id),
      title: s.name || '未知歌曲',
      artist: s.ar?.map((a: any) => a.name).join(' / ') || '未知艺术家',
      album: s.al?.name || '未知专辑',
      duration: Math.round((s.dt || 0) / 1000),
      coverUrl: s.al?.picUrl || '',
      source: 'netease' as const,
    }))

    return {
      tracks,
      total: result.songCount || 0,
      page,
      pageSize,
      hasMore: ((page - 1) * pageSize + songs.length) < (result.songCount || 0),
    }
  }

  async getTrackUrl(trackId: string): Promise<string> {
    const res = await this.bridge.getTrackUrl(trackId)
    if (!res.success) throw new Error(res.error || 'Get track URL failed')

    const body = res.data as any
    const urlData = body.data?.[0]
    if (!urlData?.url) throw new Error('该歌曲暂时无法播放')
    return urlData.url
  }

  async getLyrics(trackId: string): Promise<LyricLine[]> {
    const res = await this.bridge.getLyrics(trackId)
    if (!res.success) throw new Error(res.error || 'Get lyrics failed')

    const body = res.data as any
    const lrc = body.lrc?.lyric || ''
    return this.parseLrc(lrc)
  }

  async getSearchSuggestions(keyword: string): Promise<string[]> {
    const res = await this.bridge.getSuggestions(keyword)
    if (!res.success) throw new Error(res.error || 'Get suggestions failed')

    const body = res.data as any
    const allMatch = body.result?.allMatch || []
    return allMatch.map((item: any) => item.keyword || item.name || '')
  }

  private parseLrc(lrcString: string): LyricLine[] {
    if (!lrcString) return []
    const lines = lrcString.split('\n')
    const lyrics: LyricLine[] = []
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

    for (const line of lines) {
      const timestamps: number[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = timeRegex.exec(line)) !== null) {
        const ms = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3])
        timestamps.push(parseInt(match[1]) * 60 + parseInt(match[2]) + ms / 1000)
        lastIndex = match.index + match[0].length
      }
      timeRegex.lastIndex = 0
      const text = line.slice(lastIndex).trim()
      if (timestamps.length > 0 && text) {
        for (const t of timestamps) lyrics.push({ time: t, text })
      }
    }
    lyrics.sort((a, b) => a.time - b.time)
    for (let i = 0; i < lyrics.length - 1; i++) {
      lyrics[i].duration = lyrics[i + 1].time - lyrics[i].time
    }
    return lyrics
  }
}
