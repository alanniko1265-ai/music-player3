import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { registerIPCHandlers } from './ipc-handler'
import { registerQQMusicIpcHandlers } from './qq-music-ipc-handler'
import { registerNeteaseIpcHandlers } from './netease-ipc-handler'
import { createTray, destroyTray } from './tray-manager'
import { networkMonitor } from './network-monitor'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    backgroundColor: '#0D0D0D',
    icon: app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // In development, load from Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIPCHandlers()
  const qqMusicLoginService = registerQQMusicIpcHandlers()
  registerNeteaseIpcHandlers()
  createWindow()

  // Create system tray after window is created
  if (mainWindow) {
    createTray(mainWindow)
  }
  networkMonitor.start()
  void qqMusicLoginService.validateSession()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  networkMonitor.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Set isQuitting flag so the close event handler allows the window to close
app.on('before-quit', () => {
  isQuitting = true
  destroyTray()
})

export { mainWindow }
