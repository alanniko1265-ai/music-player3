import { BrowserWindow } from 'electron'

/**
 * NetworkMonitor - 网络连接状态监测模块
 * 监听网络连接状态变化，通过 IPC 通知渲染进程
 */
export class NetworkMonitor {
  private isOnline: boolean = true
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private readonly CHECK_INTERVAL_MS = 5000

  /**
   * 启动网络状态监测
   * 使用定时检测 + Electron 事件监听双重机制
   */
  start(): void {
    // 初始状态假设在线
    this.isOnline = true

    // 定时检测网络状态
    this.checkInterval = setInterval(() => {
      this.checkNetworkStatus()
    }, this.CHECK_INTERVAL_MS)
  }

  /**
   * 停止网络状态监测
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * 检测网络状态并在状态变化时通知渲染进程
   */
  private checkNetworkStatus(): void {
    const { net } = require('electron')
    const online = net.isOnline()

    if (online !== this.isOnline) {
      this.isOnline = online
      this.notifyRenderer(online)
    }
  }

  /**
   * 向所有渲染进程窗口发送网络状态变化事件
   */
  private notifyRenderer(online: boolean): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('network:status-changed', online)
      }
    }
  }

  /**
   * 获取当前网络状态
   */
  getStatus(): boolean {
    return this.isOnline
  }
}

/** 单例实例 */
export const networkMonitor = new NetworkMonitor()
