import { ipcMain, BrowserWindow } from 'electron'
import { fileStorageService, type StorageKey } from './file-storage'

/**
 * IPC Handler - 注册主进程 IPC 处理器
 * 处理来自渲染进程的存储操作和窗口管理请求
 */

/**
 * 注册所有 IPC 处理器
 */
export function registerIPCHandlers(): void {
  // 存储相关处理器 - 委托给 FileStorageService
  ipcMain.handle('storage:save', async (_event, key: string, data: unknown) => {
    await fileStorageService.save(key as StorageKey, data as any)
  })

  ipcMain.handle('storage:load', async (_event, key: string) => {
    return await fileStorageService.load(key as StorageKey)
  })

  ipcMain.handle('storage:remove', async (_event, key: string) => {
    await fileStorageService.remove(key as StorageKey)
  })

  // 窗口管理处理器
  ipcMain.on('window:minimize-to-tray', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.hide()
    }
  })

  ipcMain.on('window:restore', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.show()
      window.focus()
    }
  })
}
