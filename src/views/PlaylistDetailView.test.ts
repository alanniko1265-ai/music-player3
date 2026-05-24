import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Track, Playlist } from '@/types'

/**
 * PlaylistDetailView logic tests
 * Tests the playlist detail page's core logic: displaying tracks,
 * removing tracks, reordering via drag-and-drop, renaming, and play all.
 */

function createTrack(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    album: `Album ${id}`,
    duration: 240,
    coverUrl: `https://example.com/cover-${id}.jpg`,
    source: 'netease',
  }
}

function createPlaylist(id: string, trackCount: number): Playlist {
  const tracks: Track[] = []
  for (let i = 0; i < trackCount; i++) {
    tracks.push(createTrack(`${id}-${i}`))
  }
  return {
    id,
    name: `Playlist ${id}`,
    tracks,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function createMockPlaylistStore(playlists: Playlist[]) {
  return {
    playlists: [...playlists],
    renamePlaylist: vi.fn(async (id: string, newName: string) => {
      const p = playlists.find(pl => pl.id === id)
      if (p) p.name = newName
    }),
    removeTrack: vi.fn(async (playlistId: string, trackId: string) => {
      const p = playlists.find(pl => pl.id === playlistId)
      if (p) {
        p.tracks = p.tracks.filter(t => t.id !== trackId)
      }
    }),
    reorderTracks: vi.fn(async (playlistId: string, fromIndex: number, toIndex: number) => {
      const p = playlists.find(pl => pl.id === playlistId)
      if (p) {
        const [moved] = p.tracks.splice(fromIndex, 1)
        p.tracks.splice(toIndex, 0, moved)
      }
    }),
  }
}

function createMockPlayerStore() {
  return {
    setPlaylist: vi.fn(),
    playTrack: vi.fn(),
  }
}

/**
 * Simulates the PlaylistDetailView's core reactive logic
 */
function usePlaylistDetailLogic(deps: {
  playlistId: string
  playlistStore: ReturnType<typeof createMockPlaylistStore>
  playerStore: ReturnType<typeof createMockPlayerStore>
}) {
  const { playlistId, playlistStore, playerStore } = deps

  function getPlaylist(): Playlist | null {
    return playlistStore.playlists.find(p => p.id === playlistId) ?? null
  }

  let isEditingName = false
  let editingName = ''

  function startRename(): void {
    const playlist = getPlaylist()
    if (!playlist) return
    editingName = playlist.name
    isEditingName = true
  }

  async function confirmRename(): Promise<void> {
    const trimmed = editingName.trim()
    const playlist = getPlaylist()
    if (trimmed && playlist && trimmed !== playlist.name) {
      await playlistStore.renamePlaylist(playlistId, trimmed)
    }
    isEditingName = false
  }

  function cancelRename(): void {
    isEditingName = false
  }

  async function playAll(): Promise<void> {
    const playlist = getPlaylist()
    if (!playlist || playlist.tracks.length === 0) return
    playerStore.setPlaylist(playlist.tracks)
    await playerStore.playTrack(playlist.tracks[0])
  }

  async function playTrack(track: Track): Promise<void> {
    const playlist = getPlaylist()
    if (!playlist) return
    playerStore.setPlaylist(playlist.tracks)
    await playerStore.playTrack(track)
  }

  async function removeTrack(trackId: string): Promise<void> {
    await playlistStore.removeTrack(playlistId, trackId)
  }

  async function reorderTracks(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex !== toIndex) {
      await playlistStore.reorderTracks(playlistId, fromIndex, toIndex)
    }
  }

  function formatDuration(seconds: number): string {
    const totalSeconds = Math.floor(seconds)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return {
    get playlist() { return getPlaylist() },
    get isEditingName() { return isEditingName },
    get editingName() { return editingName },
    set editingName(v: string) { editingName = v },
    startRename,
    confirmRename,
    cancelRename,
    playAll,
    playTrack,
    removeTrack,
    reorderTracks,
    formatDuration,
  }
}

describe('PlaylistDetailView logic', () => {
  let playlistStore: ReturnType<typeof createMockPlaylistStore>
  let playerStore: ReturnType<typeof createMockPlayerStore>
  let testPlaylist: Playlist

  beforeEach(() => {
    testPlaylist = createPlaylist('pl-1', 5)
    playlistStore = createMockPlaylistStore([testPlaylist])
    playerStore = createMockPlayerStore()
  })

  describe('playlist display', () => {
    it('should find the playlist by ID', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      expect(view.playlist).not.toBeNull()
      expect(view.playlist!.name).toBe('Playlist pl-1')
      expect(view.playlist!.tracks).toHaveLength(5)
    })

    it('should return null for non-existent playlist', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'non-existent',
        playlistStore,
        playerStore,
      })

      expect(view.playlist).toBeNull()
    })

    it('should show empty state for playlist with no tracks', () => {
      const emptyPlaylist = createPlaylist('pl-empty', 0)
      playlistStore = createMockPlaylistStore([emptyPlaylist])

      const view = usePlaylistDetailLogic({
        playlistId: 'pl-empty',
        playlistStore,
        playerStore,
      })

      expect(view.playlist).not.toBeNull()
      expect(view.playlist!.tracks).toHaveLength(0)
    })
  })

  describe('rename playlist', () => {
    it('should start editing with current name', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      view.startRename()
      expect(view.isEditingName).toBe(true)
      expect(view.editingName).toBe('Playlist pl-1')
    })

    it('should confirm rename with new name', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      view.startRename()
      view.editingName = '我的歌单'
      await view.confirmRename()

      expect(playlistStore.renamePlaylist).toHaveBeenCalledWith('pl-1', '我的歌单')
      expect(view.isEditingName).toBe(false)
    })

    it('should not rename if name is unchanged', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      view.startRename()
      // Keep the same name
      await view.confirmRename()

      expect(playlistStore.renamePlaylist).not.toHaveBeenCalled()
      expect(view.isEditingName).toBe(false)
    })

    it('should not rename if name is empty/whitespace', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      view.startRename()
      view.editingName = '   '
      await view.confirmRename()

      expect(playlistStore.renamePlaylist).not.toHaveBeenCalled()
    })

    it('should cancel rename without saving', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      view.startRename()
      view.editingName = 'New Name'
      view.cancelRename()

      expect(view.isEditingName).toBe(false)
      expect(playlistStore.renamePlaylist).not.toHaveBeenCalled()
    })

    it('should not start rename for non-existent playlist', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'non-existent',
        playlistStore,
        playerStore,
      })

      view.startRename()
      expect(view.isEditingName).toBe(false)
    })
  })

  describe('play all', () => {
    it('should set playlist and play first track', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      await view.playAll()

      expect(playerStore.setPlaylist).toHaveBeenCalledWith(testPlaylist.tracks)
      expect(playerStore.playTrack).toHaveBeenCalledWith(testPlaylist.tracks[0])
    })

    it('should not play if playlist is empty', async () => {
      const emptyPlaylist = createPlaylist('pl-empty', 0)
      playlistStore = createMockPlaylistStore([emptyPlaylist])

      const view = usePlaylistDetailLogic({
        playlistId: 'pl-empty',
        playlistStore,
        playerStore,
      })

      await view.playAll()

      expect(playerStore.setPlaylist).not.toHaveBeenCalled()
      expect(playerStore.playTrack).not.toHaveBeenCalled()
    })

    it('should not play if playlist does not exist', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'non-existent',
        playlistStore,
        playerStore,
      })

      await view.playAll()

      expect(playerStore.setPlaylist).not.toHaveBeenCalled()
      expect(playerStore.playTrack).not.toHaveBeenCalled()
    })
  })

  describe('play single track', () => {
    it('should set playlist and play the selected track', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      const track = testPlaylist.tracks[2]
      await view.playTrack(track)

      expect(playerStore.setPlaylist).toHaveBeenCalledWith(testPlaylist.tracks)
      expect(playerStore.playTrack).toHaveBeenCalledWith(track)
    })
  })

  describe('remove track', () => {
    it('should remove a track from the playlist', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      const trackId = testPlaylist.tracks[1].id
      await view.removeTrack(trackId)

      expect(playlistStore.removeTrack).toHaveBeenCalledWith('pl-1', trackId)
    })
  })

  describe('reorder tracks', () => {
    it('should reorder tracks when indices differ', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      await view.reorderTracks(0, 3)

      expect(playlistStore.reorderTracks).toHaveBeenCalledWith('pl-1', 0, 3)
    })

    it('should not reorder when indices are the same', async () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      await view.reorderTracks(2, 2)

      expect(playlistStore.reorderTracks).not.toHaveBeenCalled()
    })
  })

  describe('format duration', () => {
    it('should format seconds to mm:ss', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      expect(view.formatDuration(0)).toBe('0:00')
      expect(view.formatDuration(59)).toBe('0:59')
      expect(view.formatDuration(60)).toBe('1:00')
      expect(view.formatDuration(125)).toBe('2:05')
      expect(view.formatDuration(3661)).toBe('61:01')
    })

    it('should handle fractional seconds', () => {
      const view = usePlaylistDetailLogic({
        playlistId: 'pl-1',
        playlistStore,
        playerStore,
      })

      expect(view.formatDuration(59.9)).toBe('0:59')
      expect(view.formatDuration(60.5)).toBe('1:00')
    })
  })
})
