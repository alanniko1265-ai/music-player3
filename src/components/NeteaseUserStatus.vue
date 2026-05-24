<template>
  <div class="netease-user">
    <button
      v-if="loginStore.isLoggedIn && loginStore.userInfo"
      class="netease-user__profile"
      type="button"
      title="退出网易云音乐"
      @click="logout"
    >
      <img class="netease-user__avatar" :src="loginStore.userInfo.avatarUrl" alt="" />
      <span class="netease-user__name">{{ loginStore.userInfo.nickname }}</span>
      <svg class="netease-user__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>

    <button
      v-else
      class="netease-user__login"
      type="button"
      :class="{ 'netease-user__login--expired': loginStore.isExpired }"
      @click="dialogOpen = true"
    >
      <svg class="netease-user__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 12h6" />
        <path d="M12 9v6" />
        <rect x="3" y="3" width="18" height="18" rx="3" />
      </svg>
      <span>{{ loginStore.isExpired ? '重新登录' : '网易云登录' }}</span>
    </button>

    <NeteaseLoginDialog v-model="dialogOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import NeteaseLoginDialog from '@/components/NeteaseLoginDialog.vue'
import { useNeteaseLoginStore } from '@/stores/netease-login-store'

const loginStore = useNeteaseLoginStore()
const dialogOpen = ref(false)

async function logout(): Promise<void> {
  await loginStore.logout()
}
</script>

<style scoped lang="scss">
.netease-user {
  padding: 0 var(--spacing-base);
  margin-top: var(--spacing-sm);

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
