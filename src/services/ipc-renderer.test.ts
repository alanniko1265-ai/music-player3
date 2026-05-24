/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { storageService, windowService, networkService } from './ipc-renderer'

describe('IPC Renderer Service', () => {
  describe('storageService (non-Electron fallback)', () => {
    beforeEach(() => {
      // Ensure electronAPI is not available (simulates browser/test environment)
      delete (window as any).electronAPI
      localStorage.clear()
    })

    it('should save and load data via localStorage fallback', async () => {
      const testData = { playlists: [{ id: '1', name: 'My Playlist' }] }
      await storageService.save('testKey', testData)

      const loaded = await storageService.load('testKey', null)
      expect(loaded).toEqual(testData)
    })

    it('should return defaultValue when key does not exist', async () => {
      const defaultValue = { items: [] }
      const loaded = await storageService.load('nonexistent', defaultValue)
      expect(loaded).toEqual(defaultValue)
    })

    it('should remove data from localStorage', async () => {
      await storageService.save('toRemove', { data: 'value' })
      await storageService.remove('toRemove')

      const loaded = await storageService.load('toRemove', null)
      expect(loaded).toBeNull()
    })

    it('should return defaultValue when stored data is invalid JSON', async () => {
      localStorage.setItem('badJson', 'not-valid-json{{{')
      const loaded = await storageService.load('badJson', 'fallback')
      expect(loaded).toBe('fallback')
    })
  })

  describe('storageService (Electron environment)', () => {
    const mockElectronAPI = {
      saveData: vi.fn().mockResolvedValue(undefined),
      loadData: vi.fn().mockResolvedValue(null),
      removeData: vi.fn().mockResolvedValue(undefined),
      minimizeToTray: vi.fn(),
      restoreWindow: vi.fn(),
      onNetworkStatusChanged: vi.fn()
    }

    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI
      vi.clearAllMocks()
    })

    afterEach(() => {
      delete (window as any).electronAPI
    })

    it('should call electronAPI.saveData', async () => {
      const data = { name: 'test' }
      await storageService.save('key', data)
      expect(mockElectronAPI.saveData).toHaveBeenCalledWith('key', data)
    })

    it('should call electronAPI.loadData and return result', async () => {
      const expected = { tracks: [] }
      mockElectronAPI.loadData.mockResolvedValue(expected)

      const result = await storageService.load('key', null)
      expect(mockElectronAPI.loadData).toHaveBeenCalledWith('key')
      expect(result).toEqual(expected)
    })

    it('should return defaultValue when electronAPI.loadData returns null/undefined', async () => {
      mockElectronAPI.loadData.mockResolvedValue(undefined)

      const result = await storageService.load('key', 'default')
      expect(result).toBe('default')
    })

    it('should call electronAPI.removeData', async () => {
      await storageService.remove('key')
      expect(mockElectronAPI.removeData).toHaveBeenCalledWith('key')
    })
  })

  describe('windowService', () => {
    const mockElectronAPI = {
      saveData: vi.fn(),
      loadData: vi.fn(),
      removeData: vi.fn(),
      minimizeToTray: vi.fn(),
      restoreWindow: vi.fn(),
      onNetworkStatusChanged: vi.fn()
    }

    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI
      vi.clearAllMocks()
    })

    afterEach(() => {
      delete (window as any).electronAPI
    })

    it('should call electronAPI.minimizeToTray', () => {
      windowService.minimizeToTray()
      expect(mockElectronAPI.minimizeToTray).toHaveBeenCalled()
    })

    it('should call electronAPI.restoreWindow', () => {
      windowService.restoreWindow()
      expect(mockElectronAPI.restoreWindow).toHaveBeenCalled()
    })

    it('should not throw when electronAPI is not available', () => {
      delete (window as any).electronAPI
      expect(() => windowService.minimizeToTray()).not.toThrow()
      expect(() => windowService.restoreWindow()).not.toThrow()
    })
  })

  describe('networkService', () => {
    const mockElectronAPI = {
      saveData: vi.fn(),
      loadData: vi.fn(),
      removeData: vi.fn(),
      minimizeToTray: vi.fn(),
      restoreWindow: vi.fn(),
      onNetworkStatusChanged: vi.fn()
    }

    beforeEach(() => {
      (window as any).electronAPI = mockElectronAPI
      vi.clearAllMocks()
    })

    afterEach(() => {
      delete (window as any).electronAPI
    })

    it('should register network status callback', () => {
      const callback = vi.fn()
      networkService.onStatusChanged(callback)
      expect(mockElectronAPI.onNetworkStatusChanged).toHaveBeenCalledWith(callback)
    })

    it('should not throw when electronAPI is not available', () => {
      delete (window as any).electronAPI
      expect(() => networkService.onStatusChanged(vi.fn())).not.toThrow()
    })
  })
})
