import type { LyricLine, SearchResult, Track } from '@/types'
import { APIError, withRetry, type MusicAPIAdapter } from './music-api-adapter'

export function isQQMusicDirectAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.qqMusic
}

export class QQMusicDirectAdapter implements MusicAPIAdapter {
  async search(keyword: string, page: number = 1, pageSize: number = 20): Promise<SearchResult> {
    return withRetry(async () => {
      const response = await this.call('search', {
        key: keyword,
        page,
        pageSize,
        t: 0,
      })
      const data = this.asRecord(response.data)
      const list = Array.isArray(data.list) ? data.list : []
      const total = Number(data.total || 0)

      return {
        tracks: list.map(song => this.mapSongToTrack(this.asRecord(song))),
        total,
        page: Number(data.pageNo || page),
        pageSize: Number(data.pageSize || pageSize),
        hasMore: page * pageSize < total,
      }
    })
  }

  async getTrackUrl(trackId: string): Promise<string> {
    return withRetry(async () => {
      // trackId 格式：songmid 或 "songmid:strMediaMid"（用冒号分隔）
      const [songmid, strMediaMid] = trackId.split(':')
      const response = await this.call('song/url', {
        id: songmid,
        mediaId: strMediaMid || songmid,
      })
      const url = typeof response.data === 'string' ? response.data : ''
      if (!url) {
        throw new APIError('QQ Music did not return a playable URL', 404, 'qq')
      }
      return url
    })
  }

  async getLyrics(trackId: string): Promise<LyricLine[]> {
    return withRetry(async () => {
      // 只取 songmid 部分（冒号前）
      const songmid = trackId.split(':')[0]
      const response = await this.call('lyric', { songmid })
      const data = this.asRecord(response.data)
      return this.parseLrc(String(data.lyric || ''))
    })
  }

  async getSearchSuggestions(keyword: string): Promise<string[]> {
    return withRetry(async () => {
      const response = await this.call('search/quick', { key: keyword })
      const data = this.asRecord(response.data)
      const song = this.asRecord(data.song)
      const itemlist = Array.isArray(song.itemlist) ? song.itemlist : []
      return itemlist
        .map(item => {
          const record = this.asRecord(item)
          const name = String(record.name || '')
          const singer = String(record.singer || '')
          return singer ? `${name} - ${singer}` : name
        })
        .filter(Boolean)
        .slice(0, 10)
    })
  }

  private async call(endpoint: string, data: unknown) {
    if (!isQQMusicDirectAvailable()) {
      throw new APIError('QQ Music direct API is unavailable', 501, 'qq')
    }

    const response = await window.electronAPI.qqMusic.callApi(endpoint, data)
    if (!response.success) {
      throw new APIError(response.error || 'QQ Music API request failed', response.code || 500, 'qq')
    }
    return response
  }

  private mapSongToTrack(song: Record<string, unknown>): Track {
    // 兼容新版 musicu 接口（DoSearchForQQMusicDesktop）和旧版 CGI 接口的字段格式
    const singers = Array.isArray(song.singer)
      ? song.singer.map(item => String(this.asRecord(item).name || '')).filter(Boolean)
      : []

    // 专辑 mid：新接口在 album.mid，旧接口在 albummid
    const albumObj = this.asRecord(song.album)
    const albumMid = String(song.albummid || albumObj.mid || '')
    const albumName = String(song.albumname || albumObj.name || 'Unknown Album')

    // 歌曲 mid：新接口用 mid，旧接口用 songmid
    const songmid = String(song.mid || song.songmid || song.id || song.songid || '')

    // strMediaMid 用于构造播放文件名，新接口有此字段
    const strMediaMid = String(song.strMediaMid || song.media_mid || songmid)

    // 用 "songmid:strMediaMid" 格式存储 id，供 getTrackUrl 使用
    const trackId = strMediaMid && strMediaMid !== songmid
      ? `${songmid}:${strMediaMid}`
      : songmid

    return {
      id: trackId,
      title: String(song.name || song.songname || 'Unknown Track'),
      artist: singers.join(' / ') || String(song.singername || 'Unknown Artist'),
      album: albumName,
      duration: Number(song.interval || song.duration || 0),
      coverUrl: albumMid
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`
        : '',
      source: 'qq',
    }
  }

  private parseLrc(lrcString: string): LyricLine[] {
    if (!lrcString) {
      return []
    }

    const lines = lrcString.split('\n')
    const lyrics: LyricLine[] = []
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

    for (const line of lines) {
      const timestamps: number[] = []
      let match: RegExpExecArray | null
      let lastIndex = 0

      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = Number.parseInt(match[1], 10)
        const seconds = Number.parseInt(match[2], 10)
        const milliseconds = match[3].length === 2
          ? Number.parseInt(match[3], 10) * 10
          : Number.parseInt(match[3], 10)
        timestamps.push(minutes * 60 + seconds + milliseconds / 1000)
        lastIndex = match.index + match[0].length
      }

      timeRegex.lastIndex = 0
      const text = line.slice(lastIndex).trim()
      for (const time of timestamps) {
        if (text) {
          lyrics.push({ time, text })
        }
      }
    }

    lyrics.sort((a, b) => a.time - b.time)
    for (let i = 0; i < lyrics.length - 1; i += 1) {
      lyrics[i].duration = lyrics[i + 1].time - lyrics[i].time
    }
    return lyrics
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
  }
}
