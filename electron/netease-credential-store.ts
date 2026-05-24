export interface NeteaseUserInfo {
  userId: string
  nickname: string
  avatarUrl: string
}

export interface NeteaseCredentialData {
  cookie: string
  userInfo?: NeteaseUserInfo
  lastLoginTime: number
}

const ENCRYPTION_KEY = 'netease-credential-encryption-key-v1'

const DEFAULT_CREDENTIAL_DATA: NeteaseCredentialData = {
  cookie: '',
  userInfo: undefined,
  lastLoginTime: 0,
}

export class NeteaseCredentialStore {
  private store: any = null

  private async getStore(): Promise<any> {
    if (!this.store) {
      const Store = (await import('electron-store')).default
      this.store = new Store({
        name: 'netease-credentials',
        encryptionKey: ENCRYPTION_KEY,
        defaults: DEFAULT_CREDENTIAL_DATA,
      })
    }
    return this.store
  }

  async saveCredentials(cookie: string, userInfo?: NeteaseUserInfo): Promise<void> {
    const store = await this.getStore()
    store.set('cookie', cookie)
    store.set('userInfo', userInfo)
    store.set('lastLoginTime', Date.now())
  }

  async loadCookie(): Promise<string> {
    const store = await this.getStore()
    return String(store.get('cookie') || '')
  }

  async loadUserInfo(): Promise<NeteaseUserInfo | undefined> {
    const store = await this.getStore()
    return store.get('userInfo') || undefined
  }

  async clearCredentials(): Promise<void> {
    const store = await this.getStore()
    store.set('cookie', '')
    store.set('userInfo', undefined)
    store.set('lastLoginTime', 0)
  }
}

export const neteaseCredentialStore = new NeteaseCredentialStore()
