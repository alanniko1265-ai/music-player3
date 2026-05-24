<template>
  <teleport to="body">
    <transition name="netease-login-fade">
      <div
        v-if="modelValue"
        class="netease-login"
        role="dialog"
        aria-modal="true"
        aria-label="网易云音乐登录"
        @keydown.escape="close"
      >
        <button class="netease-login__backdrop" type="button" aria-label="关闭" @click="close" />

        <section class="netease-login__panel">
          <header class="netease-login__header">
            <div>
              <h2 class="netease-login__title">网易云音乐登录</h2>
              <p class="netease-login__subtitle">{{ statusText }}</p>
            </div>
            <button class="netease-login__icon-btn" type="button" aria-label="关闭" @click="close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div
            class="netease-login__qr-shell"
            :class="{
              'netease-login__qr-shell--expired': loginStore.isExpired,
              'netease-login__qr-shell--confirming': loginStore.isConfirming,
            }"
          >
            <div v-if="loginStore.loading && !qrSrc" class="netease-login__placeholder">
              <span class="netease-login__spinner" aria-label="加载中" />
            </div>

            <img v-else-if="qrSrc" class="netease-login__qr" :src="qrSrc" alt="网易云音乐登录二维码" />

            <div v-else class="netease-login__placeholder">
              <div v-if="loginStore.error" class="netease-login__error-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>获取二维码失败</span>
                <button class="netease-login__refresh-btn" type="button" @click="beginLogin">重试</button>
              </div>
              <span v-else class="netease-login__spinner" aria-label="加载中" />
            </div>

            <div v-if="loginStore.isConfirming" class="netease-login__confirm-overlay" aria-live="polite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>请在手机上确认</span>
            </div>

            <div v-if="loginStore.isExpired" class="netease-login__expired-overlay" aria-live="polite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>二维码已过期</span>
              <button class="netease-login__refresh-btn" type="button" @click="beginLogin">刷新</button>
            </div>
          </div>

          <p v-if="loginStore.error" class="netease-login__error" role="alert">{{ loginStore.error }}</p>

          <footer class="netease-login__actions">
            <button class="netease-login__secondary" type="button" @click="close">取消</button>
            <button
              class="netease-login__primary"
              type="button"
              :disabled="loginStore.loading || loginStore.isConfirming"
              @click="beginLogin"
            >
              <span v-if="loginStore.loading" class="netease-login__btn-spinner" aria-hidden="true" />
              {{ loginStore.loading ? '加载中...' : (loginStore.isExpired || loginStore.error ? '刷新二维码' : '重新获取') }}
            </button>
          </footer>
        </section>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { LoginStatus } from '@/types/qq-music-login'
import { useNeteaseLoginStore } from '@/stores/netease-login-store'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const loginStore = useNeteaseLoginStore()
let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

const qrSrc = computed(() => {
  const value = loginStore.qrImageBase64
  if (!value) return ''
  if (value.startsWith('data:') || value.startsWith('http')) return value
  return `data:image/png;base64,${value}`
})

const statusText = computed(() => {
  switch (loginStore.status) {
    case LoginStatus.Scanning: return '使用网易云音乐 App 扫描二维码'
    case LoginStatus.Confirming: return '请在手机上确认登录'
    case LoginStatus.LoggedIn: return '登录成功'
    case LoginStatus.Expired: return '二维码已过期，请刷新'
    default: return '正在获取二维码...'
  }
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void beginLogin()
    } else {
      stopPolling()
    }
  },
)

watch(
  () => loginStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && props.modelValue) {
      stopPolling()
      setTimeout(() => emit('update:modelValue', false), 600)
    }
  },
)

watch(
  () => loginStore.isExpired,
  (expired) => {
    if (expired) stopPolling()
  },
)

async function beginLogin(): Promise<void> {
  stopPolling()
  loginStore.clearError()
  const result = await loginStore.startLogin()
  if (result.success) {
    startPolling()
  }
}

function startPolling(): void {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (polling) return
    polling = true
    try {
      const result = await loginStore.pollQRStatus()
      if (['confirmed', 'expired', 'error'].includes(result.status)) {
        stopPolling()
      }
    } finally {
      polling = false
    }
  }, 2000)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  polling = false
}

function close(): void {
  stopPolling()
  emit('update:modelValue', false)
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped lang="scss">
.netease-login {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: 24px;

  &__backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.62);
    cursor: default;
  }

  &__panel {
    position: relative;
    width: min(360px, 100%);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: var(--font-weight-semibold);
    line-height: 1.3;
    color: var(--color-text);
  }

  &__subtitle {
    margin: 6px 0 0;
    min-height: 18px;
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  &__icon-btn {
    width: 32px;
    height: 32px;
    display: inline-grid;
    place-items: center;
    border: 0;
    border-radius: 6px;
    color: var(--color-text-secondary);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
      color: var(--color-text);
      background: var(--color-surface-hover);
    }

    svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
  }

  &__qr-shell {
    position: relative;
    width: 220px;
    height: 220px;
    margin: 24px auto 18px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #ffffff;
    overflow: hidden;

    &--expired {
      opacity: 0.4;
    }

    &--confirming {
      opacity: 0.7;
    }
  }

  &__qr {
    width: 196px;
    height: 196px;
    display: block;
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
  }

  &__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(0, 0, 0, 0.12);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: netease-login-spin 0.8s linear infinite;
  }

  &__confirm-overlay,
  &__expired-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: #ffffff;
    font-size: 14px;
    border-radius: 10px;

    svg {
      width: 40px;
      height: 40px;
      stroke: var(--color-primary);
    }
  }

  &__expired-overlay svg {
    width: 32px;
    height: 32px;
    stroke: var(--color-warning);
  }

  &__refresh-btn {
    margin-top: 4px;
    padding: 6px 16px;
    background: var(--color-primary);
    color: #ffffff;
    border: 0;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
  }

  &__error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;

    svg {
      width: 32px;
      height: 32px;
      stroke: var(--color-error);
    }
  }

  &__error {
    margin: 0 0 14px;
    padding: 8px 12px;
    background: rgba(244, 67, 54, 0.1);
    border-radius: 6px;
    color: var(--color-error);
    font-size: 13px;
    text-align: center;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }

  &__primary,
  &__secondary {
    min-width: 88px;
    height: 36px;
    border-radius: 6px;
    border: 0;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  &__primary {
    color: #ffffff;
    background: var(--color-primary);

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__secondary {
    color: var(--color-text-secondary);
    background: var(--color-surface-hover);
  }

  &__btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: netease-login-spin 0.8s linear infinite;
  }
}

.netease-login-fade-enter-active,
.netease-login-fade-leave-active {
  transition: opacity 200ms ease;
}

.netease-login-fade-enter-from,
.netease-login-fade-leave-to {
  opacity: 0;
}

@keyframes netease-login-spin {
  to { transform: rotate(360deg); }
}
</style>
