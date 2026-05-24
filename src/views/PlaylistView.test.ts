import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Playlist } from '@/types'

/**
 * PlaylistView logic tests
 * Tests the playlist page's core logic: listing playlists, creating,
 * deleting (with confirmation), renaming, navigation, and empty state.
 * Validates: Requirements 3.1, 3.4, 3.5, 3.6
 */

function createPlaylist(id: string, name: string, trackCount: number = 0): Playlist {
  return {
    id,
    name,
    tracks: Array.from({ length: trackCount }, (_, i) => ({
      id: `${id}-track-${i}`,
      title: `Track ${i}`,
      artist: `Artist ${i}`,
      album: `Album ${i}`,
      duration: 200,
      coverUrl: `https://example.com/cover-${i}.jpg`,
      source: 'netease' as const,
    })),
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  }
}

function createMockPlaylistStore() {
  let playlists: Playlist[] = []

  return {
    get playlists() { return playlists },
    set playlists(val: Playlist[]) { playlists = val },
    init: vi.fn(async () => {}),
    createPlaylist: vi.fn(async (name: string) => {
      const newPlaylist = createPlaylist(`new-${Date.now()}`, name)
      playlists = [...playlists, newPlaylist]
      return newPlaylist
    }),
    deletePlaylist: vi.fn(async (id: string) => {
      playlists = playlists.filter(p => p.id !== id)
    }),
    renamePlaylist: vi.fn(async (id: string, newName: string) => {
      playlists = playlists.map(p => p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p)
    }),
  }
}

function createMockRouter() {
  return {
    push: vi.fn(),
  }
}

/**
 * Simulates the PlaylistView's core reactive logic
 */
function usePlaylistViewLogic(deps: {
  playlistStore: ReturnType<typeof createMockPlaylistStore>
  router: ReturnType<typeof createMockRouter>
}) {
  const { playlistStore, router } = deps

  let showCreateDialog = false
  let createName = ''
  let showDeleteDialog = false
  let deletingPlaylist: Playlist | null = null
  let renamingId: string | null = null
  let renameValue = ''

  async function init(): Promise<void> {
    await playlistStore.init()
  }

  function openCreateDialog(): void {
    showCreateDialog = true
  }

  function closeCreateDialog(): void {
    showCreateDialog = false
    createName = ''
  }

  async function confirmCreate(name: string): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) return
    await playlistStore.createPlaylist(trimmed)
    closeCreateDialog()
  }

  function requestDelete(playlist: Playlist): void {
    deletingPlaylist = playlist
    showDeleteDialog = true
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingPlaylist) return
    await playlistStore.deletePlaylist(deletingPlaylist.id)
    closeDeleteDialog()
  }

  function closeDeleteDialog(): void {
    showDeleteDialog = false
    deletingPlaylist = null
  }

  function startRename(playlist: Playlist): void {
    renamingId = playlist.id
    renameValue = playlist.name
  }

  async function confirmRename(playlistId: string, newName: string): Promise<void> {
    const trimmed = newName.trim()
    if (trimmed && renamingId === playlistId) {
      await playlistStore.renamePlaylist(playlistId, trimmed)
    }
    cancelRename()
  }

  function cancelRename(): void {
    renamingId = null
    renameValue = ''
  }

  function navigateToDetail(playlistId: string): void {
    router.push({ name: 'playlist-detail', params: { id: playlistId } })
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    get playlists() { return playlistStore.playlists },
    get showCreateDialog() { return showCreateDialog },
    get createName() { return createName },
    set createName(v: string) { createName = v },
    get showDeleteDialog() { return showDeleteDialog },
    get deletingPlaylist() { return deletingPlaylist },
    get renamingId() { return renamingId },
    get renameValue() { return renameValue },
    set renameValue(v: string) { renameValue = v },
    init,
    openCreateDialog,
    closeCreateDialog,
    confirmCreate,
    requestDelete,
    confirmDelete,
    closeDeleteDialog,
    startRename,
    confirmRename,
    cancelRename,
    navigateToDetail,
    formatDate,
  }
}

describe('PlaylistView logic', () => {
  let playlistStore: ReturnType<typeof createMockPlaylistStore>
  let router: ReturnType<typeof createMockRouter>

  beforeEach(() => {
    playlistStore = createMockPlaylistStore()
    router = createMockRouter()
  })

  describe('initialization', () => {
    it('should call store init on mount', async () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.init()

      expect(playlistStore.init).toHaveBeenCalled()
    })

    it('should show empty state when no playlists exist', async () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.init()

      expect(view.playlists).toHaveLength(0)
    })

    it('should display playlists from store', async () => {
      playlistStore.playlists = [
        createPlaylist('1', '我的歌单', 5),
        createPlaylist('2', '运动音乐', 10),
      ]

      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.init()

      expect(view.playlists).toHaveLength(2)
      expect(view.playlists[0].name).toBe('我的歌单')
      expect(view.playlists[0].tracks).toHaveLength(5)
      expect(view.playlists[1].name).toBe('运动音乐')
    })
  })

  describe('create playlist (Requirement 3.1)', () => {
    it('should open create dialog', () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      view.openCreateDialog()

      expect(view.showCreateDialog).toBe(true)
    })

    it('should close create dialog and reset name', () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      view.openCreateDialog()
      view.createName = '新歌单'
      view.closeCreateDialog()

      expect(view.showCreateDialog).toBe(false)
      expect(view.createName).toBe('')
    })

    it('should create playlist with trimmed name', async () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.confirmCreate('  我的新歌单  ')

      expect(playlistStore.createPlaylist).toHaveBeenCalledWith('我的新歌单')
      expect(view.showCreateDialog).toBe(false)
    })

    it('should not create playlist with empty name', async () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.confirmCreate('   ')

      expect(playlistStore.createPlaylist).not.toHaveBeenCalled()
    })

    it('should add new playlist to list after creation', async () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.confirmCreate('新歌单')

      expect(view.playlists).toHaveLength(1)
      expect(view.playlists[0].name).toBe('新歌单')
    })
  })

  describe('delete playlist (Requirement 3.4)', () => {
    it('should open delete confirmation dialog', () => {
      const playlist = createPlaylist('1', '要删除的歌单')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.requestDelete(playlist)

      expect(view.showDeleteDialog).toBe(true)
      expect(view.deletingPlaylist).toBe(playlist)
    })

    it('should close delete dialog without deleting on cancel', () => {
      const playlist = createPlaylist('1', '歌单')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.requestDelete(playlist)
      view.closeDeleteDialog()

      expect(view.showDeleteDialog).toBe(false)
      expect(view.deletingPlaylist).toBeNull()
      expect(playlistStore.deletePlaylist).not.toHaveBeenCalled()
    })

    it('should delete playlist on confirm', async () => {
      const playlist = createPlaylist('1', '要删除的歌单')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.requestDelete(playlist)
      await view.confirmDelete()

      expect(playlistStore.deletePlaylist).toHaveBeenCalledWith('1')
      expect(view.showDeleteDialog).toBe(false)
      expect(view.playlists).toHaveLength(0)
    })

    it('should not delete if no playlist is selected', async () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      await view.confirmDelete()

      expect(playlistStore.deletePlaylist).not.toHaveBeenCalled()
    })
  })

  describe('rename playlist (Requirement 3.5)', () => {
    it('should enter rename mode with current name', () => {
      const playlist = createPlaylist('1', '原始名称')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.startRename(playlist)

      expect(view.renamingId).toBe('1')
      expect(view.renameValue).toBe('原始名称')
    })

    it('should rename playlist with trimmed new name', async () => {
      const playlist = createPlaylist('1', '原始名称')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.startRename(playlist)
      await view.confirmRename('1', '  新名称  ')

      expect(playlistStore.renamePlaylist).toHaveBeenCalledWith('1', '新名称')
      expect(view.renamingId).toBeNull()
    })

    it('should not rename with empty name', async () => {
      const playlist = createPlaylist('1', '原始名称')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.startRename(playlist)
      await view.confirmRename('1', '   ')

      expect(playlistStore.renamePlaylist).not.toHaveBeenCalled()
    })

    it('should cancel rename and reset state', () => {
      const playlist = createPlaylist('1', '原始名称')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.startRename(playlist)
      view.cancelRename()

      expect(view.renamingId).toBeNull()
      expect(view.renameValue).toBe('')
    })

    it('should not rename if renamingId does not match', async () => {
      const playlist = createPlaylist('1', '原始名称')
      playlistStore.playlists = [playlist]

      const view = usePlaylistViewLogic({ playlistStore, router })
      view.startRename(playlist)
      // Try to confirm rename for a different playlist id
      await view.confirmRename('2', '新名称')

      expect(playlistStore.renamePlaylist).not.toHaveBeenCalled()
    })
  })

  describe('navigation (Requirement 3.6)', () => {
    it('should navigate to playlist detail on click', () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      view.navigateToDetail('playlist-123')

      expect(router.push).toHaveBeenCalledWith({
        name: 'playlist-detail',
        params: { id: 'playlist-123' },
      })
    })
  })

  describe('formatDate helper', () => {
    it('should format timestamp to YYYY-MM-DD', () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      // 2024-01-15 in UTC
      const timestamp = new Date(2024, 0, 15).getTime()
      const result = view.formatDate(timestamp)

      expect(result).toBe('2024-01-15')
    })

    it('should pad single-digit month and day', () => {
      const view = usePlaylistViewLogic({ playlistStore, router })
      const timestamp = new Date(2024, 2, 5).getTime() // March 5
      const result = view.formatDate(timestamp)

      expect(result).toBe('2024-03-05')
    })
  })
})
