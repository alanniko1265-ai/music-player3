/**
 * IPC Renderer Service - 渲染进程 IPC 调用的类型安全封装
 * 提供对 window.electronAPI 的类型化访问
 */

import type { ElectronAPI } from '@/types/ipc'

export type { ElectronAPI }

/**
 * 检查是否在 Electron 环境中运行
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

/**
 * 存储服务 - 封装本地数据持久化操作
 */
export const storageService = {
  /**
   * 保存数据到本地存储
   * @param key 存储键名
   * @param data 要保存的数据
   */
  async save<T>(key: string, data: T): Promise<void> {
    if (isElectron()) {
      await window.electronAPI.saveData(key, data)
    } else {
      // 开发环境降级到 localStorage
      localStorage.setItem(key, JSON.stringify(data))
    }
  },

  /**
   * 从本地存储加载数据
   * @param key 存储键名
   * @param defaultValue 默认值（当数据不存在时返回）
   */
  async load<T>(key: string, defaultValue: T): Promise<T> {
    if (isElectron()) {
      const data = await window.electronAPI.loadData(key)
      return (data as T) ?? defaultValue
    } else {
      // 开发环境降级到 localStorage
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      try {
        return JSON.parse(raw) as T
      } catch {
        return defaultValue
      }
    }
  },

  /**
   * 从本地存储删除数据
   * @param key 存储键名
   */
  async remove(key: string): Promise<void> {
    if (isElectron()) {
      await window.electronAPI.removeData(key)
    } else {
      localStorage.removeItem(key)
    }
  }
}

/**
 * 窗口管理服务 - 封装窗口操作
 */
export const windowService = {
  /**
   * 最小化窗口到系统托盘
   */
  minimizeToTray(): void {
    if (isElectron()) {
      window.electronAPI.minimizeToTray()
    }
  },

  /**
   * 从托盘恢复窗口
   */
  restoreWindow(): void {
    if (isElectron()) {
      window.electronAPI.restoreWindow()
    }
  }
}

/**
 * 网络状态服务 - 封装网络状态监听
 */
export const networkService = {
  /**
   * 监听网络状态变化
   * @param callback 状态变化回调函数
   * @returns 取消订阅函数（仅 Electron 环境有效）
   */
  onStatusChanged(callback: (online: boolean) => void): (() => void) | undefined {
    if (isElectron()) {
      return window.electronAPI.onNetworkStatusChanged(callback) as (() => void) | undefined
    }
  }
}
