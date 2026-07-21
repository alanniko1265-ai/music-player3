import type { Track } from '@/types'

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase()
}

export function filterPlaylistTracks(tracks: Track[], query: string): Track[] {
  const tokens = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return tracks

  return tracks.filter((track) => {
    const searchableText = normalizeSearchText(`${track.title}\n${track.artist}\n${track.album}`)
    return tokens.every((token) => searchableText.includes(token))
  })
}
