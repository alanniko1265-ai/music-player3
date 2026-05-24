<template>
  <Transition name="network-banner">
    <div v-if="!isOnline" class="network-banner" role="alert" aria-live="polite">
      <svg
        class="network-banner__icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span class="network-banner__text">网络连接已断开</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { networkService } from '../services/ipc-renderer'

const isOnline = ref(true)

/** 浏览器原生网络事件处理 */
function handleOnline() {
  isOnline.value = true
}

function handleOffline() {
  isOnline.value = false
}

/** Electron IPC 取消订阅函数 */
let unsubscribeElectron: (() => void) | undefined

onMounted(() => {
  // 初始状态
  isOnline.value = navigator.onLine

  // 监听浏览器原生网络事件（开发环境降级）
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // 监听 Electron IPC 网络状态事件，保存取消订阅函数
  unsubscribeElectron = networkService.onStatusChanged((online: boolean) => {
    isOnline.value = online
  })
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  // 清理 Electron IPC 监听器
  unsubscribeElectron?.()
})
</script>

<style lang="scss" scoped>
.network-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-base);
  background-color: var(--color-warning);
  color: #000000;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-base);

  &__icon {
    flex-shrink: 0;
  }

  &__text {
    white-space: nowrap;
  }
}

// Transition animations
.network-banner-enter-active,
.network-banner-leave-active {
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.network-banner-enter-from,
.network-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
