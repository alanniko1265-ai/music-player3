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

  // Create a simple 16x16 music note icon using nativeImage
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
 * Uses the app icon from public folder, or creates a simple fallback icon
 */
function createTrayIcon(): NativeImage {
  // Try to load the app icon from public folder
  const iconPath = join(__dirname, '../public/vite.svg')
  try {
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      return icon.resize({ width: 16, height: 16 })
    }
  } catch {
    // Fall through to create a simple icon
  }

  // Create a simple 16x16 icon as fallback
  // This creates a small colored square as a placeholder tray icon
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4
    // Use the app's primary color (#1DB954 - green)
    canvas[offset] = 0x1d     // R
    canvas[offset + 1] = 0xb9 // G
    canvas[offset + 2] = 0x54 // B
    canvas[offset + 3] = 0xff // A
  }
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
