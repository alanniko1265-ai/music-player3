import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  LoginStatus,
  type ApiResponse,
  type LoginStatusInfo,
  type QRCodeResult,
  type QRPollResult,
  type RefreshResult,
  type UserInfo,
} from '@/types/qq-music-login'

function hasQQMusicBridge(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.qqMusic
}

export const useQQMusicLoginStore = defineStore('qqMusicLogin', () => {
  const status = ref<LoginStatus>(LoginStatus.LoggedOut)
  const userInfo = ref<UserInfo | null>(null)
  const qrImageBase64 = ref<string | null>(null)
  const qrsig = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  let unsubscribeStatus: (() => void) | void

  const isLoggedIn = computed(() => status.value === LoginStatus.LoggedIn)
  const isScanning = computed(() => status.value === LoginStatus.Scanning)
  const isConfirming = computed(() => status.value === LoginStatus.Confirming)
  const isExpired = computed(() => status.value === LoginStatus.Expired)

  function applyStatus(info: LoginStatusInfo): void {
    status.value = info.status
    userInfo.value = info.userInfo ?? null
  }

  async function initialize(): Promise<void> {
    if (initialized.value || !hasQQMusicBridge()) {
      initialized.value = true
      return
    }

    unsubscribeStatus = window.electronAPI.qqMusic.onStatusChanged((info) => {
      applyStatus(info)
      if (info.status === LoginStatus.LoggedIn) {
        qrImageBase64.value = null
        qrsig.value = null
      }
    })

    try {
      applyStatus(await window.electronAPI.qqMusic.getStatus())
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load QQ Music login status'
    } finally {
      initialized.value = true
    }
  }

  const loginMethod = ref<'qq' | 'wechat'>('qq')

  async function startLogin(method: 'qq' | 'wechat' = loginMethod.value): Promise<QRCodeResult> {
    if (!hasQQMusicBridge()) {
      const result = { success: false, error: 'QQ Music login is only available in Electron' }
      error.value = result.error
      return result
    }

    loginMethod.value = method
    loading.value = true
    error.value = null

    try {
      const result = await window.electronAPI.qqMusic.startLogin(method)
      if (result.success) {
        qrImageBase64.value = result.qrImageBase64 ?? null
        qrsig.value = result.qrsig ?? null
        status.value = LoginStatus.Scanning
      } else {
        qrImageBase64.value = null
        qrsig.value = null
        error.value = result.error ?? 'Failed to start QQ Music login'
      }
      return result
    } finally {
      loading.value = false
    }
  }

  async function pollQRStatus(targetQrsig = qrsig.value): Promise<QRPollResult> {
    if (!hasQQMusicBridge() || !targetQrsig) {
      return { status: 'error', error: 'No active QR login session' }
    }

    const result = await window.electronAPI.qqMusic.pollQRStatus(targetQrsig)
    switch (result.status) {
      case 'waiting':
        status.value = LoginStatus.Scanning
        error.value = null
        break
      case 'scanned':
        status.value = LoginStatus.Confirming
        error.value = null
        break
      case 'expired':
        status.value = LoginStatus.Expired
        break
      case 'confirmed':
        // 主进程已通过 IPC push 了 LoggedIn 状态，直接同步一次确保最新
        try {
          applyStatus(await window.electronAPI.qqMusic.getStatus())
        } catch {
          // getStatus 失败时依赖 onStatusChanged 推送的状态
          status.value = LoginStatus.LoggedIn
        }
        qrImageBase64.value = null
        qrsig.value = null
        break
      case 'error':
        error.value = result.error ?? 'QQ Music login failed'
        break
    }
    return result
  }

  async function cancelLogin(): Promise<void> {
    if (hasQQMusicBridge()) {
      await window.electronAPI.qqMusic.cancelLogin()
    }
    qrImageBase64.value = null
    qrsig.value = null
  }

  async function logout(): Promise<void> {
    if (hasQQMusicBridge()) {
      await window.electronAPI.qqMusic.logout()
    }
    applyStatus({ status: LoginStatus.LoggedOut })
    qrImageBase64.value = null
    qrsig.value = null
  }

  async function refreshSession(): Promise<RefreshResult> {
    if (!hasQQMusicBridge()) {
      return { success: false, error: 'QQ Music login is only available in Electron' }
    }
    const result = await window.electronAPI.qqMusic.refreshSession()
    if (!result.success) {
      error.value = result.error ?? 'Failed to refresh QQ Music session'
    }
    return result
  }

  async function callApi(endpoint: string, data: unknown): Promise<ApiResponse> {
    if (!hasQQMusicBridge()) {
      return { success: false, error: 'QQ Music direct API is only available in Electron' }
    }
    const result = await window.electronAPI.qqMusic.callApi(endpoint, data)
    if (result.code === 301) {
      status.value = LoginStatus.Expired
    }
    return result
  }

  function clearError(): void {
    error.value = null
  }

  function dispose(): void {
    unsubscribeStatus?.()
    unsubscribeStatus = undefined
    initialized.value = false
  }

  return {
    status,
    userInfo,
    qrImageBase64,
    qrsig,
    loading,
    error,
    initialized,
    loginMethod,
    isLoggedIn,
    isScanning,
    isConfirming,
    isExpired,
    initialize,
    startLogin,
    pollQRStatus,
    cancelLogin,
    logout,
    refreshSession,
    callApi,
    clearError,
    dispose,
  }
})
