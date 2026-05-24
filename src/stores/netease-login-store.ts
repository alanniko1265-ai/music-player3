import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { LoginStatus, type UserInfo } from '@/types/qq-music-login'
import type { NeteaseLoginStatusInfo, NeteaseQRCodeResult, NeteaseQRPollResult } from '@/types/netease-login'

function hasNeteaseBridge(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.netease
}

export const useNeteaseLoginStore = defineStore('neteaseLogin', () => {
  const status = ref<LoginStatus>(LoginStatus.LoggedOut)
  const userInfo = ref<UserInfo | null>(null)
  const qrImageBase64 = ref<string | null>(null)
  const qrKey = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  let unsubscribeStatus: (() => void) | void

  const isLoggedIn = computed(() => status.value === LoginStatus.LoggedIn)
  const isConfirming = computed(() => status.value === LoginStatus.Confirming)
  const isExpired = computed(() => status.value === LoginStatus.Expired)

  function applyStatus(info: NeteaseLoginStatusInfo): void {
    status.value = info.status
    userInfo.value = info.userInfo ?? null
  }

  async function initialize(): Promise<void> {
    if (initialized.value || !hasNeteaseBridge()) {
      initialized.value = true
      return
    }

    unsubscribeStatus = window.electronAPI.netease.onStatusChanged((info) => {
      applyStatus(info)
      if (info.status === LoginStatus.LoggedIn) {
        qrImageBase64.value = null
        qrKey.value = null
      }
    })

    try {
      applyStatus(await window.electronAPI.netease.getStatus())
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load NetEase login status'
    } finally {
      initialized.value = true
    }
  }

  async function startLogin(): Promise<NeteaseQRCodeResult> {
    if (!hasNeteaseBridge()) {
      const result = { success: false, error: 'NetEase login is only available in Electron' }
      error.value = result.error
      return result
    }

    loading.value = true
    error.value = null

    try {
      const result = await window.electronAPI.netease.startLogin()
      if (result.success) {
        qrImageBase64.value = result.qrImageBase64 ?? null
        qrKey.value = result.key ?? null
        status.value = LoginStatus.Scanning
      } else {
        qrImageBase64.value = null
        qrKey.value = null
        error.value = result.error ?? 'Failed to start NetEase login'
      }
      return result
    } finally {
      loading.value = false
    }
  }

  async function pollQRStatus(targetKey = qrKey.value): Promise<NeteaseQRPollResult> {
    if (!hasNeteaseBridge() || !targetKey) {
      return { status: 'error', error: 'No active NetEase QR login session' }
    }

    const result = await window.electronAPI.netease.pollQRStatus(targetKey)
    switch (result.status) {
      case 'waiting':
        status.value = LoginStatus.Scanning
        break
      case 'scanned':
        status.value = LoginStatus.Confirming
        break
      case 'expired':
        status.value = LoginStatus.Expired
        break
      case 'confirmed':
        try {
          applyStatus(await window.electronAPI.netease.getStatus())
        } catch {
          status.value = LoginStatus.LoggedIn
        }
        qrImageBase64.value = null
        qrKey.value = null
        break
      case 'error':
        error.value = result.error ?? 'NetEase login failed'
        break
    }
    return result
  }

  async function logout(): Promise<void> {
    if (hasNeteaseBridge()) {
      await window.electronAPI.netease.logout()
    }
    applyStatus({ status: LoginStatus.LoggedOut })
    qrImageBase64.value = null
    qrKey.value = null
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
    qrKey,
    loading,
    error,
    initialized,
    isLoggedIn,
    isConfirming,
    isExpired,
    initialize,
    startLogin,
    pollQRStatus,
    logout,
    clearError,
    dispose,
  }
})
