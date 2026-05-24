<template>
  <div class="qq-user">
    <button
      v-if="loginStore.isLoggedIn && loginStore.userInfo"
      class="qq-user__profile"
      type="button"
      title="退出 QQ 音乐"
      @click="logout"
    >
      <img class="qq-user__avatar" :src="loginStore.userInfo.avatarUrl" alt="" />
      <span class="qq-user__name">{{ loginStore.userInfo.nickname }}</span>
      <svg class="qq-user__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>

    <button
      v-else
      class="qq-user__login"
      type="button"
      :class="{ 'qq-user__login--expired': loginStore.isExpired }"
      @click="dialogOpen = true"
    >
      <svg class="qq-user__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 12h6" />
        <path d="M12 9v6" />
        <rect x="3" y="3" width="18" height="18" rx="3" />
      </svg>
      <span>{{ loginStore.isExpired ? '重新登录' : 'QQ 音乐登录' }}</span>
    </button>

    <QQMusicLoginDialog v-model="dialogOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import QQMusicLoginDialog from '@/components/QQMusicLoginDialog.vue'
import { useQQMusicLoginStore } from '@/stores/qq-music-login-store'

const loginStore = useQQMusicLoginStore()
const dialogOpen = ref(false)

// initialize() 由 App.vue 的 useAppInit 统一调用，此处不重复调用

async function logout(): Promise<void> {
  await loginStore.logout()
}
</script>

<style scoped lang="scss">
.qq-user {
  padding: 0 var(--spacing-base);
  margin-top: 0;

  &__profile,
  &__login {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    padding: 8px 10px;
    text-align: left;
    transition: background var(--transition-fast), color var(--transition-fast);

    &:hover {
      background: var(--color-surface-hover);
    }
  }

  &__login {
    justify-content: center;
    color: var(--color-text-secondary);

    &--expired {
      color: var(--color-error);
    }
  }

  &__avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--color-background);
  }

  &__name {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  &__icon {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
</style>
