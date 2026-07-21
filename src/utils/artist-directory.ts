import type { Track } from '@/types'

export interface ArtistDirectory {
  name: string
  trackCount: number
  coverUrl: string
}

const ARTIST_SEPARATOR = /\s*(?:\/|&|、|,|，| feat\.? | ft\.? )\s*/i

export function splitArtistNames(artist: string): string[] {
  return artist
    .split(ARTIST_SEPARATOR)
    .map(name => name.trim())
    .filter(Boolean)
}

export function trackIncludesArtist(track: Track, artistName: string): boolean {
  const normalizedTarget = artistName.trim().toLocaleLowerCase()
  return splitArtistNames(track.artist).some(
    name => name.toLocaleLowerCase() === normalizedTarget,
  )
}

export function createArtistDirectories(tracks: Track[]): ArtistDirectory[] {
  const directories = new Map<string, ArtistDirectory>()

  for (const track of tracks) {
    for (const artistName of splitArtistNames(track.artist)) {
      const key = artistName.toLocaleLowerCase()
      const existing = directories.get(key)

      if (existing) {
        existing.trackCount += 1
        if (!existing.coverUrl && track.coverUrl) {
          existing.coverUrl = track.coverUrl
        }
        continue
      }

      directories.set(key, {
        name: artistName,
        trackCount: 1,
        coverUrl: track.coverUrl,
      })
    }
  }

  return [...directories.values()].sort((left, right) => {
    if (right.trackCount !== left.trackCount) {
      return right.trackCount - left.trackCount
    }
    return left.name.localeCompare(right.name, 'zh-CN')
  })
}
