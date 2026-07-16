import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Electron modules - factory must not reference external variables
vi.mock('electron', () => {
  const mockTrayInstance = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn()
  }

  return {
    Tray: vi.fn().mockImplementation(() => mockTrayInstance),
    Menu: {
      buildFromTemplate: vi.fn().mockReturnValue({})
    },
    nativeImage: {
      createFromPath: vi.fn().mockReturnValue({
        isEmpty: () => true,
        resize: vi.fn().mockReturnValue({})
      }),
      createFromBuffer: vi.fn().mockReturnValue({})
    },
    BrowserWindow: vi.fn(),
    app: {
      isPackaged: false,
      quit: vi.fn()
    },
    __mockTrayInstance: mockTrayInstance
  }
})

vi.mock('path', () => ({
  join: vi.fn().mockReturnValue('/mock/path/icon.svg')
}))

import { Tray, Menu, nativeImage } from 'electron'
import { createTray, updateTooltip, destroyTray } from './tray-manager'

function getMockTrayInstance() {
  // Access the mock tray instance through the Tray constructor mock
  const TrayMock = Tray as unknown as ReturnType<typeof vi.fn>
  return TrayMock.mock.results[TrayMock.mock.results.length - 1]?.value
}

function getMockMenuBuildFromTemplate() {
  return (Menu.buildFromTemplate as ReturnType<typeof vi.fn>)
}

describe('TrayManager', () => {
  const mockWindow = {
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: vi.fn().mockReturnValue(false),
    webContents: {
      send: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    destroyTray()
  })

  describe('createTray', () => {
    it('uses the bundled tray asset when it is available', () => {
      const bundledIcon = { isEmpty: () => false }
      ;(nativeImage.createFromPath as ReturnType<typeof vi.fn>).mockReturnValueOnce(bundledIcon)

      createTray(mockWindow as any)

      expect(nativeImage.createFromPath).toHaveBeenCalled()
      expect(Tray).toHaveBeenCalledWith(bundledIcon)
    })

    it('creates a transparent vinyl fallback instead of a solid square', () => {
      createTray(mockWindow as any)

      const [canvas] = (nativeImage.createFromBuffer as ReturnType<typeof vi.fn>).mock.calls[0]
      const alphaValues = Array.from({ length: canvas.length / 4 }, (_, index) => canvas[index * 4 + 3])

      expect(alphaValues).toContain(0)
      expect(alphaValues).toContain(255)
    })

    it('should create a tray icon with default tooltip', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()

      expect(trayInstance.setToolTip).toHaveBeenCalledWith('音乐播放器')
    })

    it('should set up context menu', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()

      expect(getMockMenuBuildFromTemplate()).toHaveBeenCalled()
      expect(trayInstance.setContextMenu).toHaveBeenCalled()
    })

    it('should register double-click handler', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()

      expect(trayInstance.on).toHaveBeenCalledWith('double-click', expect.any(Function))
    })

    it('should show window on double-click', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()

      // Get the double-click handler
      const doubleClickCall = trayInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'double-click'
      )
      expect(doubleClickCall).toBeDefined()

      // Execute the handler
      doubleClickCall![1]()

      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
    })

    it('should restore minimized window on double-click', () => {
      mockWindow.isMinimized.mockReturnValue(true)
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()

      const doubleClickCall = trayInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'double-click'
      )
      doubleClickCall![1]()

      expect(mockWindow.restore).toHaveBeenCalled()
      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
    })

    it('should create context menu with correct items', () => {
      createTray(mockWindow as any)

      const templateArg = getMockMenuBuildFromTemplate().mock.calls[0][0]
      const labels = templateArg.map((item: any) => item.label || item.type)

      expect(labels).toContain('播放/暂停')
      expect(labels).toContain('下一首')
      expect(labels).toContain('显示窗口')
      expect(labels).toContain('退出')
    })

    it('should send tray:toggle-play when 播放/暂停 is clicked', () => {
      createTray(mockWindow as any)

      const templateArg = getMockMenuBuildFromTemplate().mock.calls[0][0]
      const playPauseItem = templateArg.find((item: any) => item.label === '播放/暂停')
      playPauseItem.click()

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tray:toggle-play')
    })

    it('should send tray:next-track when 下一首 is clicked', () => {
      createTray(mockWindow as any)

      const templateArg = getMockMenuBuildFromTemplate().mock.calls[0][0]
      const nextItem = templateArg.find((item: any) => item.label === '下一首')
      nextItem.click()

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('tray:next-track')
    })
  })

  describe('updateTooltip', () => {
    it('should update tooltip with track info', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()
      
      updateTooltip('测试歌曲 - 测试艺术家')

      expect(trayInstance.setToolTip).toHaveBeenCalledWith('测试歌曲 - 测试艺术家')
    })

    it('should fallback to default tooltip when trackInfo is empty', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()
      
      updateTooltip('')

      expect(trayInstance.setToolTip).toHaveBeenCalledWith('音乐播放器')
    })
  })

  describe('destroyTray', () => {
    it('should destroy the tray icon', () => {
      createTray(mockWindow as any)
      const trayInstance = getMockTrayInstance()
      
      destroyTray()

      expect(trayInstance.destroy).toHaveBeenCalled()
    })

    it('should handle destroy when tray is null', () => {
      // Should not throw when no tray exists
      expect(() => destroyTray()).not.toThrow()
    })
  })
})
