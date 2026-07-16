import { Tray, Menu, nativeImage, BrowserWindow, app, type NativeImage } from 'electron'
import { join } from 'path'

/**
 * TrayManager - 系统托盘管理器
 * 管理系统托盘图标、右键菜单和窗口最小化到托盘功能
 */

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null

/**
 * 创建系统托盘图标和菜单
 * @param window - 主窗口实例
 */
export function createTray(window: BrowserWindow): void {
  mainWindow = window

  const icon = createTrayIcon()
  tray = new Tray(icon)

  tray.setToolTip('音乐播放器')

  // Build the context menu
  updateContextMenu()

  // Double-click tray icon to show/restore window
  tray.on('double-click', () => {
    showWindow()
  })
}

/**
 * 更新托盘提示文字（显示当前播放曲目信息）
 * @param trackInfo - 当前播放曲目信息，如 "歌曲名 - 艺术家"
 */
export function updateTooltip(trackInfo: string): void {
  if (tray) {
    tray.setToolTip(trackInfo || '音乐播放器')
  }
}

/**
 * 销毁托盘图标
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/**
 * 显示/恢复主窗口
 */
function showWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  }
}

/**
 * 创建托盘图标
 * Uses the packaged tray asset and falls back to the full app icon.
 */
function createTrayIcon(): NativeImage {
  const iconDirectory = app.isPackaged
    ? process.resourcesPath
    : join(__dirname, '../public')
  const candidates = ['tray-icon.png', 'icon.png']

  for (const fileName of candidates) {
    try {
      const icon = nativeImage.createFromPath(join(iconDirectory, fileName))
      if (!icon.isEmpty()) {
        return icon
      }
    } catch {
      // Continue to the next bundled icon candidate.
    }
  }

  return createFallbackTrayIcon()
}

function createFallbackTrayIcon(): NativeImage {
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)

  const setPixel = (x: number, y: number, color: readonly [number, number, number, number]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = (y * size + x) * 4
    canvas[offset] = color[0]
    canvas[offset + 1] = color[1]
    canvas[offset + 2] = color[2]
    canvas[offset + 3] = color[3]
  }

  const center = 7.5
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center)
      if (distance <= 7) setPixel(x, y, [7, 16, 10, 255])
      if (distance >= 5.7 && distance <= 7) setPixel(x, y, [159, 247, 177, 255])
      if (distance >= 3.7 && distance <= 4.2) setPixel(x, y, [53, 91, 64, 255])
      if (distance <= 2.1) setPixel(x, y, [159, 247, 177, 255])
      if (distance <= 0.7) setPixel(x, y, [7, 16, 10, 255])
    }
  }

  const gold = [214, 189, 122, 255] as const
  for (const [x, y] of [[13, 3], [12, 4], [12, 5], [11, 6], [11, 7], [10, 8], [10, 9]] as const) {
    setPixel(x, y, gold)
  }
  setPixel(13, 2, [238, 246, 239, 255])

  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

/**
 * 构建并设置托盘右键菜单
 */
function updateContextMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '播放/暂停',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('tray:toggle-play')
        }
      }
    },
    {
      label: '下一首',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('tray:next-track')
        }
      }
    },
    { type: 'separator' },
    {
      label: '显示窗口',
      click: () => {
        showWindow()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // Destroy tray before quitting to avoid lingering icon
        destroyTray()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}
