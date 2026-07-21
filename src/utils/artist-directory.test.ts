import { describe, expect, it } from 'vitest'
import type { Track } from '@/types'
import {
  createArtistDirectories,
  splitArtistNames,
  trackIncludesArtist,
} from './artist-directory'

function createTrack(id: string, artist: string, coverUrl = ''): Track {
  return {
    id,
    title: `Track ${id}`,
    artist,
    album: 'Album',
    duration: 180,
    coverUrl,
    source: 'qq',
  }
}

describe('artist directory helpers', () => {
  it('splits collaboration artist labels', () => {
    expect(splitArtistNames('周杰伦 / 五月天')).toEqual(['周杰伦', '五月天'])
    expect(splitArtistNames('A & B')).toEqual(['A', 'B'])
  })

  it('matches an exact artist without matching a partial name', () => {
    const track = createTrack('1', '周杰伦 / 五月天')
    expect(trackIncludesArtist(track, '周杰伦')).toBe(true)
    expect(trackIncludesArtist(track, '周杰')).toBe(false)
  })

  it('groups artists and sorts the most frequent first', () => {
    const directories = createArtistDirectories([
      createTrack('1', '周杰伦', 'cover-1'),
      createTrack('2', '周杰伦 / 五月天'),
      createTrack('3', '林俊杰'),
    ])

    expect(directories.map(directory => directory.name)).toEqual([
      '周杰伦',
      '林俊杰',
      '五月天',
    ])
    expect(directories[0]).toMatchObject({ trackCount: 2, coverUrl: 'cover-1' })
  })
})
