<template>
  <div class="qq-user">
    <button
      v-if="loginStore.isLoggedIn && loginStore.userInfo"
      class="qq-user__profile"
      type="button"
      title="Logout QQ Music"
      @click="logout"
    >
      <span class="qq-user__prefix">qq</span>
      <span class="qq-user__name">{{ loginStore.userInfo.nickname }}</span>
      <span class="qq-user__status">logout</span>
    </button>

    <button
      v-else
      class="qq-user__login"
      type="button"
      :class="{ 'qq-user__login--expired': loginStore.isExpired }"
      @click="dialogOpen = true"
    >
      <span class="qq-user__prefix">qq</span>
      <span>{{ loginStore.isExpired ? 'session expired' : 'login required' }}</span>
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

async function logout(): Promise<void> {
  await loginStore.logout()
}
</script>

<style scoped lang="scss">
.qq-user {
  &__profile,
  &__login {
    width: 100%;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(8, 10, 8, 0.58);
    color: var(--color-text-secondary);
    text-align: left;

    &:hover {
      color: var(--color-text);
      border-color: var(--color-primary);
    }
  }

  &__login {
    grid-template-columns: 28px minmax(0, 1fr);
  }

  &__login--expired {
    color: var(--color-error);
  }

  &__prefix {
    color: var(--color-accent);
    text-transform: uppercase;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    font-size: var(--font-size-xs);
  }
}
</style>
