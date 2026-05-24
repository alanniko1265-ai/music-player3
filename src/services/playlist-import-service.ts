import type { MusicSource, Track } from '@/types'

export type PlaylistImportSource = Extract<MusicSource, 'qq' | 'netease'>

export interface ImportedPlaylist {
  name: string
  tracks: Track[]
  source: PlaylistImportSource
}

type UnknownRecord = Record<string, unknown>

export async function importPlaylistFromPlatform(
  source: PlaylistImportSource,
  input: string,
): Promise<ImportedPlaylist> {
  const playlistId = parsePlaylistId(source, input)
  if (source === 'qq') {
    return importQQPlaylist(playlistId)
  }
  return importNeteasePlaylist(playlistId)
}

export function parsePlaylistId(source: PlaylistImportSource, input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('请输入歌单链接或 ID')
  }

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed
  }

  const url = tryParseUrl(trimmed)
  if (!url) {
    const rawMatch = trimmed.match(/[A-Za-z0-9_-]+/)
    if (rawMatch) {
      return rawMatch[0]
    }
    throw new Error('没有识别到歌单 ID')
  }

  if (source === 'netease') {
    const id = url.searchParams.get('id') || new URLSearchParams(url.hash.split('?')[1] || '').get('id')
    if (id) {
      return id
    }
  }

  if (source === 'qq') {
    const idFromQuery = url.searchParams.get('id') || url.searchParams.get('disstid')
    if (idFromQuery) {
      return idFromQuery
    }

    const pathMatch = url.pathname.match(/(?:playlist|playsquare)\/([A-Za-z0-9_-]+)/)
    if (pathMatch?.[1]) {
      return pathMatch[1].replace(/\.html$/i, '')
    }
  }

  throw new Error('没有识别到歌单 ID')
}

async function importQQPlaylist(playlistId: string): Promise<ImportedPlaylist> {
  if (!window.electronAPI?.qqMusic) {
    throw new Error('QQ 音乐接口不可用')
  }

  const response = await window.electronAPI.qqMusic.callApi('songlist', { id: playlistId })
  if (!response.success) {
    throw new Error(response.error || 'QQ 音乐歌单导入失败')
  }

  const data = asRecord(response.data)
  const playlist = pickFirstRecord([
    data,
    asRecord(data.dirinfo),
    asRecord(data.diss),
  ])
  const songs = findFirstArray(data, [
    'songlist',
    'songList',
    'tracks',
    'list',
    'song',
  ])
  const tracks = songs.map((song) => mapQQSongToTrack(asRecord(song))).filter(isUsableTrack)
  return {
    name: String(data.dissname || data.name || playlist.dissname || playlist.title || `QQ 歌单 ${playlistId}`),
    tracks,
    source: 'qq',
  }
}

async function importNeteasePlaylist(playlistId: string): Promise<ImportedPlaylist> {
  if (!window.electronAPI?.netease?.getPlaylistDetail) {
    throw new Error('网易云音乐接口不可用')
  }

  const response = await window.electronAPI.netease.getPlaylistDetail(playlistId)
  if (!response.success) {
    throw new Error(response.error || '网易云歌单导入失败')
  }

  const data = asRecord(response.data)
  const detailBody = asRecord(data.detail)
  const tracksBody = asRecord(data.tracks)
  const playlist = asRecord(detailBody.playlist)
  const songs = findFirstArray(tracksBody, ['songs', 'tracks'])
    .concat(findFirstArray(playlist, ['tracks']))
  const tracks = dedupeTracks(songs.map((song) => mapNeteaseSongToTrack(asRecord(song))).filter(isUsableTrack))
  return {
    name: String(playlist.name || `网易云歌单 ${playlistId}`),
    tracks,
    source: 'netease',
  }
}

function tryParseUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    try {
      return new URL(`https://${input}`)
    } catch {
      return null
    }
  }
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function pickFirstRecord(records: UnknownRecord[]): UnknownRecord {
  return records.find((record) => Object.keys(record).length > 0) || {}
}

function findFirstArray(record: UnknownRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  for (const value of Object.values(record)) {
    const nested = asRecord(value)
    if (Object.keys(nested).length > 0) {
      const found = findFirstArray(nested, keys)
      if (found.length > 0) {
        return found
      }
    }
  }

  return []
}

function mapQQSongToTrack(song: UnknownRecord): Track {
  const album = asRecord(song.album)
  const singers = Array.isArray(song.singer)
    ? song.singer.map((item) => String(asRecord(item).name || '')).filter(Boolean)
    : []
  const songmid = String(song.mid || song.songmid || song.id || song.songid || '')
  const strMediaMid = String(song.strMediaMid || song.media_mid || song.fileMediaMid || songmid)
  const albumMid = String(song.albummid || album.mid || '')
  const trackId = strMediaMid && strMediaMid !== songmid ? `${songmid}:${strMediaMid}` : songmid

  return {
    id: trackId,
    title: String(song.name || song.songname || '未知歌曲'),
    artist: singers.join(' / ') || String(song.singername || '未知艺术家'),
    album: String(song.albumname || album.name || '未知专辑'),
    duration: Number(song.interval || song.duration || 0),
    coverUrl: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : '',
    source: 'qq',
  }
}

function mapNeteaseSongToTrack(song: UnknownRecord): Track {
  const album = asRecord(song.al)
  const fallbackAlbum = asRecord(song.album)
  const artists = Array.isArray(song.ar)
    ? song.ar
    : Array.isArray(song.artists)
      ? song.artists
      : []

  return {
    id: String(song.id || ''),
    title: String(song.name || '未知歌曲'),
    artist: artists.map((artist) => String(asRecord(artist).name || '')).filter(Boolean).join(' / ') || '未知艺术家',
    album: String(album.name || fallbackAlbum.name || '未知专辑'),
    duration: Math.round(Number(song.dt || song.duration || 0) / 1000),
    coverUrl: String(album.picUrl || fallbackAlbum.picUrl || ''),
    source: 'netease',
  }
}

function isUsableTrack(track: Track): boolean {
  return Boolean(track.id && track.title)
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>()
  return tracks.filter((track) => {
    if (seen.has(track.id)) {
      return false
    }
    seen.add(track.id)
    return true
  })
}
