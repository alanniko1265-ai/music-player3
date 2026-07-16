<template>
  <div class="netease-user">
    <button
      v-if="loginStore.isLoggedIn && loginStore.userInfo"
      class="netease-user__profile"
      type="button"
      title="Logout Netease"
      @click="logout"
    >
      <span class="netease-user__prefix">wy</span>
      <span class="netease-user__name">{{ loginStore.userInfo.nickname }}</span>
      <span class="netease-user__status">logout</span>
    </button>

    <button
      v-else
      class="netease-user__login"
      type="button"
      :class="{ 'netease-user__login--expired': loginStore.isExpired }"
      @click="dialogOpen = true"
    >
      <span class="netease-user__prefix">wy</span>
      <span>{{ loginStore.isExpired ? 'session expired' : 'login required' }}</span>
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
