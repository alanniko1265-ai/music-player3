/**
 * CredentialStore - QQ 音乐凭据安全存储模块
 * 基于独立的 electron-store 实例，启用加密存储
 * 与普通应用数据隔离，确保敏感凭据安全
 */

import type { AuthCookie, CredentialSchema } from '../src/types/qq-music-login'

/** 加密密钥（用于 electron-store 的 encryptionKey 选项） */
const ENCRYPTION_KEY = 'qqmusic-credential-encryption-key-v1'

/** 默认凭据存储数据 */
const DEFAULT_CREDENTIAL_DATA: CredentialSchema = {
  authCookie: null,
  lastRefreshTime: 0,
  expiryTime: 0,
}

export interface CredentialSaveOptions {
  expiryTime?: number
}

/**
 * QQ 音乐凭据存储服务
 * 提供加密的凭据持久化存储，与普通应用数据隔离
 */
export class CredentialStore {
  private store: any = null

  /**
   * 获取或初始化加密的 electron-store 实例
   */
  private async getStore(): Promise<any> {
    if (!this.store) {
      const Store = (await import('electron-store')).default
      this.store = new Store({
        name: 'qqmusic-credentials',
        encryptionKey: ENCRYPTION_KEY,
        defaults: DEFAULT_CREDENTIAL_DATA,
      })
    }
    return this.store
  }

  /**
   * 保存认证凭据
   * 存储 Cookie 并更新时间戳
   * @param cookies 认证 Cookie 对象
   */
  async saveCredentials(cookies: AuthCookie, options: CredentialSaveOptions = {}): Promise<void> {
    const store = await this.getStore()
    const now = Date.now()
    store.set('authCookie', cookies)
    store.set('lastRefreshTime', now)
    // 默认设置 7 天过期时间
    store.set('expiryTime', options.expiryTime ?? now + 7 * 24 * 60 * 60 * 1000)
  }

  /**
   * 加载已存储的认证凭据
   * @returns 存储的 AuthCookie 对象，如果不存在则返回 null
   */
  async loadCredentials(): Promise<AuthCookie | null> {
    const store = await this.getStore()
    const cookie = store.get('authCookie')
    return cookie ?? null
  }

  async getExpiryTime(): Promise<number> {
    const store = await this.getStore()
    return Number(store.get('expiryTime') ?? 0)
  }

  /**
   * 清除所有已存储的认证凭据
   */
  async clearCredentials(): Promise<void> {
    const store = await this.getStore()
    store.set('authCookie', null)
    store.set('lastRefreshTime', 0)
    store.set('expiryTime', 0)
  }

  /**
   * 验证凭据是否完整
   * 检查必需字段（qqmusic_key, qm_keyst, uin, login_type）是否存在且非空
   * @param cookies 待验证的 AuthCookie 对象
   * @returns 凭据是否完整有效
   */
  isCredentialComplete(cookies: AuthCookie): boolean {
    if (!cookies) {
      return false
    }

    // 检查 qqmusic_key 非空
    if (!cookies.qqmusic_key || cookies.qqmusic_key.trim() === '') {
      return false
    }

    // 检查 qm_keyst 非空
    if (!cookies.qm_keyst || cookies.qm_keyst.trim() === '') {
      return false
    }

    // 检查 uin 非空
    if (!cookies.uin || cookies.uin.trim() === '') {
      return false
    }

    // 检查 login_type 存在且为有效数字
    if (cookies.login_type === undefined || cookies.login_type === null) {
      return false
    }
    if (typeof cookies.login_type !== 'number' || isNaN(cookies.login_type)) {
      return false
    }

    return true
  }
}

/** 单例实例 */
export const credentialStore = new CredentialStore()
