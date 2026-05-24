<template>
  <teleport to="body">
    <transition name="qq-login-fade">
      <div
        v-if="modelValue"
        class="qq-login"
        role="dialog"
        aria-modal="true"
        aria-label="QQ 音乐登录"
        @keydown.escape="close"
      >
        <button class="qq-login__backdrop" type="button" aria-label="关闭" @click="close" />

        <section class="qq-login__panel">
          <header class="qq-login__header">
            <div>
              <h2 class="qq-login__title">QQ 音乐登录</h2>
              <p class="qq-login__subtitle">{{ statusText }}</p>
            </div>
            <button class="qq-login__icon-btn" type="button" aria-label="关闭" @click="close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <!-- 登录方式切换 -->
          <nav class="qq-login__tabs" role="tablist">
            <button
              class="qq-login__tab"
              :class="{ 'qq-login__tab--active': activeTab === 'qq' }"
              role="tab"
              :aria-selected="activeTab === 'qq'"
              type="button"
              @click="switchTab('qq')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" class="qq-login__tab-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor" />
              </svg>
              QQ 登录
            </button>
            <button
              class="qq-login__tab"
              :class="{ 'qq-login__tab--active': activeTab === 'wechat' }"
              role="tab"
              :aria-selected="activeTab === 'wechat'"
              type="button"
              @click="switchTab('wechat')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" class="qq-login__tab-icon">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.3.3 0 0 0 .157-.066l1.848-1.1a.63.63 0 0 1 .58-.088c1.036.327 2.15.5 3.309.5h.253a5.6 5.6 0 0 1-.233-1.594c0-3.407 3.167-6.167 7.073-6.167h.253c-.406-3.55-3.998-6.03-7.616-6.03zM6.09 5.66c.576 0 1.044.468 1.044 1.044S6.666 7.75 6.09 7.75s-1.044-.468-1.044-1.044.468-1.045 1.044-1.045zm5.2 0c.577 0 1.045.468 1.045 1.044s-.468 1.045-1.044 1.045-1.044-.468-1.044-1.044.467-1.045 1.044-1.045zm5.668 4.357c-3.36 0-6.085 2.37-6.085 5.294 0 2.924 2.725 5.294 6.085 5.294.71 0 1.393-.103 2.035-.292a.5.5 0 0 1 .447.068l1.422.847a.23.23 0 0 0 .121.05.227.227 0 0 0 .223-.227c0-.055-.022-.11-.037-.163l-.3-1.14a.456.456 0 0 1 .164-.512C22.06 18.228 23.043 16.606 23.043 14.81c0-2.924-2.725-5.294-6.085-5.294v.5zm-2.494 2.893c.442 0 .8.358.8.8s-.358.8-.8.8-.8-.358-.8-.8.358-.8.8-.8zm4.988 0c.442 0 .8.358.8.8s-.358.8-.8.8-.8-.358-.8-.8.358-.8.8-.8z" fill="currentColor" />
              </svg>
              微信登录
            </button>
          </nav>

          <!-- 二维码区域 -->
          <div
            class="qq-login__qr-shell"
            :class="{
              'qq-login__qr-shell--expired': loginStore.isExpired,
              'qq-login__qr-shell--confirming': loginStore.isConfirming,
            }"
          >
            <!-- 加载中 -->
            <div v-if="loginStore.loading && !qrSrc" class="qq-login__placeholder">
              <span class="qq-login__spinner" aria-label="加载中" />
            </div>

            <!-- 二维码图片 -->
            <img v-else-if="qrSrc" class="qq-login__qr" :src="qrSrc" alt="QQ 音乐登录二维码" />

            <!-- 无二维码时的占位 -->
            <div v-else class="qq-login__placeholder">
              <span class="qq-login__spinner" aria-label="加载中" />
            </div>

            <!-- 已扫码确认遮罩 -->
            <div v-if="loginStore.isConfirming" class="qq-login__confirm-overlay" aria-live="polite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>请在手机上确认</span>
            </div>

            <!-- 过期遮罩 -->
            <div v-if="loginStore.isExpired" class="qq-login__expired-overlay" aria-live="polite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>二维码已过期</span>
              <button class="qq-login__refresh-btn" type="button" @click="beginLogin">点击刷新</button>
            </div>
          </div>

          <!-- 错误提示 -->
          <p v-if="loginStore.error" class="qq-login__error" role="alert">{{ loginStore.error }}</p>

          <!-- 底部操作 -->
          <footer class="qq-login__actions">
            <button class="qq-login__secondary" type="button" @click="close">取消</button>
            <button
              class="qq-login__primary"
              type="button"
              :disabled="loginStore.loading || loginStore.isConfirming"
              @click="beginLogin"
            >
              <span v-if="loginStore.loading" class="qq-login__btn-spinner" aria-hidden="true" />
              {{ loginStore.loading ? '加载中...' : (loginStore.isExpired || loginStore.error ? '刷新二维码' : '重新获取') }}
            </button>
          </footer>
        </section>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { LoginStatus } from '@/types/qq-music-login'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const loginStore = useQQMusicLoginStore()
let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

const activeTab = ref<'qq' | 'wechat'>('qq')

const qrSrc = computed(() => {
  const value = loginStore.qrImageBase64
  if (!value) return ''
  if (value.startsWith('data:') || value.startsWith('http')) return value
  return `data:image/png;base64,${value}`
})

const statusText = computed(() => {
  const isWechat = activeTab.value === 'wechat'
  switch (loginStore.status) {
    case LoginStatus.Scanning:   return isWechat ? '使用微信扫描二维码' : '使用手机 QQ 扫描二维码'
    case LoginStatus.Confirming: return '请在手机上点击确认登录'
    case LoginStatus.LoggedIn:   return '登录成功'
    case LoginStatus.Expired:    return '二维码已过期，请刷新'
    default:                     return '正在获取二维码...'
  }
})

// 对话框打开时自动开始登录流程
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

// 登录成功后自动关闭对话框
watch(
  () => loginStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && props.modelValue) {
      stopPolling()
      // 短暂延迟让用户看到成功状态
      setTimeout(() => emit('update:modelValue', false), 600)
    }
  },
)

// 二维码过期时停止轮询
watch(
  () => loginStore.isExpired,
  (expired) => {
    if (expired) stopPolling()
  },
)

function switchTab(tab: 'qq' | 'wechat'): void {
  if (tab === activeTab.value) return
  activeTab.value = tab
  void beginLogin()
}

async function beginLogin(): Promise<void> {
  stopPolling()
  loginStore.clearError()
  const result = await loginStore.startLogin(activeTab.value)
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

async function close(): Promise<void> {
  stopPolling()
  if (!loginStore.isLoggedIn) {
    await loginStore.cancelLogin()
  }
  emit('update:modelValue', false)
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped lang="scss">
.qq-login {
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
    font-size: 13px;
    color: var(--color-text-secondary);
    min-height: 18px;
    transition: color var(--transition-fast);
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

  // 登录方式切换 Tab
  &__tabs {
    display: flex;
    gap: 4px;
    margin-top: 16px;
    padding: 3px;
    background: var(--color-surface-hover);
    border-radius: 8px;
  }

  &__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    border: 0;
    border-radius: 6px;
    font-size: 13px;
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-fast);

    &:hover:not(&--active) {
      color: var(--color-text);
      background: rgba(255, 255, 255, 0.05);
    }

    &--active {
      color: var(--color-text);
      background: var(--color-surface);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }
  }

  &__tab-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  // 二维码容器
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
    transition: opacity var(--transition-base);

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
    animation: qq-login-spin 0.8s linear infinite;
  }

  // 扫码确认遮罩
  &__confirm-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.55);
    color: #ffffff;
    font-size: 14px;
    font-weight: var(--font-weight-medium);
    border-radius: 10px;

    svg {
      width: 40px;
      height: 40px;
      stroke: var(--color-primary);
    }
  }

  // 过期遮罩
  &__expired-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: #ffffff;
    font-size: 13px;
    border-radius: 10px;

    svg {
      width: 32px;
      height: 32px;
      stroke: var(--color-warning);
    }
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
    transition: background var(--transition-fast);

    &:hover {
      background: var(--color-primary-hover);
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
    transition: background var(--transition-fast), opacity var(--transition-fast);
  }

  &__primary {
    color: #ffffff;
    background: var(--color-primary);

    &:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &__secondary {
    color: var(--color-text-secondary);
    background: var(--color-surface-hover);

    &:hover {
      background: var(--color-surface-active);
      color: var(--color-text);
    }
  }

  &__btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: qq-login-spin 0.8s linear infinite;
    flex-shrink: 0;
  }
}

.qq-login-fade-enter-active,
.qq-login-fade-leave-active {
  transition: opacity 200ms ease;

  .qq-login__panel {
    transition: transform 200ms ease, opacity 200ms ease;
  }
}

.qq-login-fade-enter-from,
.qq-login-fade-leave-to {
  opacity: 0;

  .qq-login__panel {
    transform: scale(0.96);
    opacity: 0;
  }
}

@keyframes qq-login-spin {
  to { transform: rotate(360deg); }
}
</style>
