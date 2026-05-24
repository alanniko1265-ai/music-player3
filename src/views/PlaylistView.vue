<template>
  <div class="playlist-view">
    <!-- 页面头部 -->
    <div class="playlist-view__header">
      <h1 class="playlist-view__title">歌单</h1>
      <div class="playlist-view__header-actions">
        <button
          class="playlist-view__import-btn"
          type="button"
          @click="openImportDialog"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          <span>导入歌单</span>
        </button>
        <button
          class="playlist-view__create-btn"
          type="button"
          @click="showCreateDialog = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建歌单</span>
        </button>
      </div>
    </div>

    <!-- 歌单列表 -->
    <div class="playlist-view__content">
      <!-- 空状态 -->
      <div v-if="playlists.length === 0" class="playlist-view__empty">
        <svg class="playlist-view__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <p class="playlist-view__empty-text">还没有歌单</p>
        <p class="playlist-view__empty-hint">点击上方按钮创建或导入你的第一个歌单</p>
      </div>

      <!-- 歌单卡片列表 -->
      <div v-else class="playlist-view__list">
        <div
          v-for="playlist in playlists"
          :key="playlist.id"
          class="playlist-view__card"
          role="button"
          tabindex="0"
          @click="navigateToDetail(playlist.id)"
          @keydown.enter="navigateToDetail(playlist.id)"
        >
          <!-- 歌单封面占位 -->
          <div class="playlist-view__card-cover">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>

          <!-- 歌单信息 -->
          <div class="playlist-view__card-info">
            <!-- 名称（可编辑） -->
            <div class="playlist-view__card-name-row">
              <input
                v-if="renamingId === playlist.id"
                ref="renameInputRef"
                v-model="renameValue"
                class="playlist-view__rename-input"
                type="text"
                maxlength="50"
                @blur="confirmRename(playlist.id)"
                @keydown.enter="confirmRename(playlist.id)"
                @keydown.escape="cancelRename"
                @click.stop
              />
              <span v-else class="playlist-view__card-name">{{ playlist.name }}</span>
            </div>

            <div class="playlist-view__card-meta">
              <span class="playlist-view__card-count">{{ playlist.tracks.length }} 首歌曲</span>
              <span class="playlist-view__card-date">{{ formatDate(playlist.updatedAt) }}</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="playlist-view__card-actions" @click.stop>
            <button
              class="playlist-view__action-btn"
              type="button"
              title="重命名"
              aria-label="重命名歌单"
              @click="startRename(playlist)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              class="playlist-view__action-btn playlist-view__action-btn--danger"
              type="button"
              title="删除"
              aria-label="删除歌单"
              @click="requestDelete(playlist)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建歌单弹窗 -->
    <Teleport to="body">
      <div
        v-if="showCreateDialog"
        class="playlist-view__overlay"
        @click.self="closeCreateDialog"
      >
        <div class="playlist-view__dialog" role="dialog" aria-labelledby="create-dialog-title">
          <h2 id="create-dialog-title" class="playlist-view__dialog-title">新建歌单</h2>
          <input
            ref="createInputRef"
            v-model="createName"
            class="playlist-view__dialog-input"
            type="text"
            placeholder="输入歌单名称"
            maxlength="50"
            @keydown.enter="confirmCreate"
            @keydown.escape="closeCreateDialog"
          />
          <div class="playlist-view__dialog-actions">
            <button
              class="playlist-view__dialog-btn playlist-view__dialog-btn--cancel"
              type="button"
              @click="closeCreateDialog"
            >
              取消
            </button>
            <button
              class="playlist-view__dialog-btn playlist-view__dialog-btn--confirm"
              type="button"
              :disabled="!createName.trim()"
              @click="confirmCreate"
            >
              创建
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 导入歌单弹窗 -->
    <Teleport to="body">
      <div
        v-if="showImportDialog"
        class="playlist-view__overlay"
        @click.self="closeImportDialog"
      >
        <div class="playlist-view__dialog playlist-view__dialog--wide" role="dialog" aria-labelledby="import-dialog-title">
          <h2 id="import-dialog-title" class="playlist-view__dialog-title">导入歌单</h2>
          <div class="playlist-view__source-tabs" role="tablist" aria-label="选择音乐平台">
            <button
              class="playlist-view__source-tab"
              :class="{ 'playlist-view__source-tab--active': importSource === 'qq' }"
              type="button"
              role="tab"
              :aria-selected="importSource === 'qq'"
              @click="importSource = 'qq'"
            >
              QQ 音乐
            </button>
            <button
              class="playlist-view__source-tab"
              :class="{ 'playlist-view__source-tab--active': importSource === 'netease' }"
              type="button"
              role="tab"
              :aria-selected="importSource === 'netease'"
              @click="importSource = 'netease'"
            >
              网易云音乐
            </button>
          </div>
          <input
            ref="importInputRef"
            v-model="importInput"
            class="playlist-view__dialog-input"
            type="text"
            placeholder="粘贴歌单链接或输入歌单 ID"
            :disabled="isImporting"
            @keydown.enter="confirmImport"
            @keydown.escape="closeImportDialog"
          />
          <p v-if="importError" class="playlist-view__dialog-error">{{ importError }}</p>
          <div class="playlist-view__dialog-actions">
            <button
              class="playlist-view__dialog-btn playlist-view__dialog-btn--cancel"
              type="button"
              :disabled="isImporting"
              @click="closeImportDialog"
            >
              取消
            </button>
            <button
              class="playlist-view__dialog-btn playlist-view__dialog-btn--confirm"
              type="button"
              :disabled="!canImport"
              @click="confirmImport"
            >
              {{ isImporting ? '导入中...' : '导入' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <div
        v-if="showDeleteDialog"
        class="playlist-view__overlay"
        @click.self="closeDeleteDialog"
      >
        <div class="playlist-view__dialog" role="alertdialog" aria-labelledby="delete-dialog-title">
          <h2 id="delete-dialog-title" class="playlist-view__dialog-title">删除歌单</h2>
          <p class="playlist-view__dialog-message">
            确定要删除歌单「{{ deletingPlaylist?.name }}」吗？此操作不可撤销。
          </p>
          <div class="playlist-view__dialog-actions">
            <button
              class="playlist-view__dialog-btn playlist-view__dialog-btn--cancel"
              type="button"
              @click="closeDeleteDialog"
            >
              取消
            </button>
            <button
              class="playlist-view__dialog-btn playlist-view__dialog-btn--danger"
              type="button"
              @click="confirmDelete"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Playlist } from '@/types'
import { usePlaylistStore } from '@/stores/playlist-store'
import {
  importPlaylistFromPlatform,
  type PlaylistImportSource,
} from '@/services/playlist-import-service'

// ========== Store & Router ==========
const playlistStore = usePlaylistStore()
const router = useRouter()

// ========== Reactive State ==========
const playlists = computed(() => playlistStore.playlists)

// 创建歌单弹窗
const showCreateDialog = ref(false)
const createName = ref('')
const createInputRef = ref<HTMLInputElement | null>(null)

const showImportDialog = ref(false)
const importSource = ref<PlaylistImportSource>('qq')
const importInput = ref('')
const importError = ref('')
const isImporting = ref(false)
const importInputRef = ref<HTMLInputElement | null>(null)
const canImport = computed(() => importInput.value.trim().length > 0 && !isImporting.value)

// 删除确认弹窗
const showDeleteDialog = ref(false)
const deletingPlaylist = ref<Playlist | null>(null)

// 重命名
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// ========== Lifecycle ==========
onMounted(async () => {
  await playlistStore.init()
})

// ========== Create Playlist ==========
watch(showCreateDialog, async (visible) => {
  if (visible) {
    await nextTick()
    createInputRef.value?.focus()
  }
})

watch(showImportDialog, async (visible) => {
  if (visible) {
    await nextTick()
    importInputRef.value?.focus()
  }
})

async function confirmCreate(): Promise<void> {
  const name = createName.value.trim()
  if (!name) return

  await playlistStore.createPlaylist(name)
  closeCreateDialog()
}

function closeCreateDialog(): void {
  showCreateDialog.value = false
  createName.value = ''
}

// ========== Import Playlist ==========
function openImportDialog(): void {
  showImportDialog.value = true
  importError.value = ''
}

function closeImportDialog(): void {
  if (isImporting.value) return
  showImportDialog.value = false
  importInput.value = ''
  importError.value = ''
}

async function confirmImport(): Promise<void> {
  if (!canImport.value) return

  isImporting.value = true
  importError.value = ''

  try {
    const imported = await importPlaylistFromPlatform(importSource.value, importInput.value)
    if (imported.tracks.length === 0) {
      throw new Error('这个歌单没有可导入的歌曲')
    }

    const playlist = await playlistStore.createPlaylistWithTracks(imported.name, imported.tracks)
    closeImportDialog()
    navigateToDetail(playlist.id)
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '导入失败'
  } finally {
    isImporting.value = false
  }
}

// ========== Delete Playlist ==========
function requestDelete(playlist: Playlist): void {
  deletingPlaylist.value = playlist
  showDeleteDialog.value = true
}

async function confirmDelete(): Promise<void> {
  if (!deletingPlaylist.value) return

  await playlistStore.deletePlaylist(deletingPlaylist.value.id)
  closeDeleteDialog()
}

function closeDeleteDialog(): void {
  showDeleteDialog.value = false
  deletingPlaylist.value = null
}

// ========== Rename Playlist ==========
async function startRename(playlist: Playlist): Promise<void> {
  renamingId.value = playlist.id
  renameValue.value = playlist.name
  await nextTick()
  // renameInputRef is an array due to v-for
  const inputs = renameInputRef.value
  if (Array.isArray(inputs) && inputs.length > 0) {
    inputs[0].focus()
    inputs[0].select()
  } else if (inputs) {
    (inputs as HTMLInputElement).focus()
    ;(inputs as HTMLInputElement).select()
  }
}

async function confirmRename(playlistId: string): Promise<void> {
  const newName = renameValue.value.trim()
  if (newName && renamingId.value === playlistId) {
    await playlistStore.renamePlaylist(playlistId, newName)
  }
  cancelRename()
}

function cancelRename(): void {
  renamingId.value = null
  renameValue.value = ''
}

// ========== Navigation ==========
function navigateToDetail(playlistId: string): void {
  router.push({ name: 'playlist-detail', params: { id: playlistId } })
}

// ========== Helpers ==========
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<style lang="scss" scoped>
.playlist-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  // 头部
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg);
    flex-shrink: 0;
  }

  &__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    margin: 0;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  &__create-btn,
  &__import-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-base);
    color: var(--color-text);
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast);

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: var(--color-primary-hover);
      transform: scale(1.02);
    }

    &:active {
      background: var(--color-primary-active);
      transform: scale(0.98);
    }
  }

  &__create-btn {
    background: var(--color-primary);
  }

  &__import-btn {
    background: var(--color-surface);
    border: 1px solid var(--color-border);

    &:hover {
      background: var(--color-surface-hover);
    }

    &:active {
      background: var(--color-surface-active);
    }
  }

  // 内容区域
  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
    scroll-behavior: smooth;
  }

  // 空状态
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl) var(--spacing-base);
    min-height: 300px;
  }

  &__empty-icon {
    width: 64px;
    height: 64px;
    color: var(--color-text-secondary);
    opacity: 0.4;
    margin-bottom: var(--spacing-base);
  }

  &__empty-text {
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
    margin: 0 0 var(--spacing-xs);
  }

  &__empty-hint {
    font-size: var(--font-size-sm);
    color: var(--color-text-disabled);
    margin: 0;
  }

  // 歌单列表
  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  // 歌单卡片
  &__card {
    display: flex;
    align-items: center;
    gap: var(--spacing-base);
    padding: var(--spacing-md) var(--spacing-base);
    background: var(--color-surface);
    border-radius: var(--radius-base);
    cursor: pointer;
    transition: background var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);

    &:hover {
      background: var(--color-surface-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-base);
    }

    &:active {
      transform: translateY(0) scale(0.995);
      box-shadow: var(--shadow-sm);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }

  // 歌单封面
  &__card-cover {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-active);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 24px;
      height: 24px;
      color: var(--color-text-secondary);
      opacity: 0.6;
    }
  }

  // 歌单信息
  &__card-info {
    flex: 1;
    min-width: 0;
  }

  &__card-name-row {
    margin-bottom: var(--spacing-xs);
  }

  &__card-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  &__rename-input {
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-background);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    outline: none;

    &:focus {
      box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.3);
    }
  }

  &__card-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  &__card-count {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  &__card-date {
    font-size: var(--font-size-sm);
    color: var(--color-text-disabled);
  }

  // 操作按钮
  &__card-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-shrink: 0;
  }

  &__action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: var(--color-surface-active);
      color: var(--color-text);
    }

    &:active {
      transform: scale(0.85);
    }

    &--danger:hover {
      background: rgba(244, 67, 54, 0.15);
      color: var(--color-error);
    }
  }

  // 弹窗遮罩
  &__overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    animation: fadeIn 0.2s ease;
  }

  // 弹窗
  &__dialog {
    width: 360px;
    max-width: 90vw;
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-xl);
    animation: scaleIn 0.2s ease;

    &--wide {
      width: 460px;
    }
  }

  &__dialog-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    margin: 0 0 var(--spacing-base);
  }

  &__dialog-message {
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    line-height: var(--line-height-base);
    margin: 0 0 var(--spacing-lg);
  }

  &__source-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-xs);
    padding: 4px;
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-base);
    margin-bottom: var(--spacing-base);
  }

  &__source-tab {
    height: 36px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);

    &:hover {
      color: var(--color-text);
    }

    &--active {
      background: var(--color-surface-hover);
      color: var(--color-text);
    }
  }

  &__dialog-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-background);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-base);
    color: var(--color-text);
    font-size: var(--font-size-base);
    outline: none;
    transition: border-color var(--transition-fast);
    margin-bottom: var(--spacing-lg);
    box-sizing: border-box;

    &::placeholder {
      color: var(--color-text-disabled);
    }

    &:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.2);
    }
  }

  &__dialog-error {
    margin: calc(-1 * var(--spacing-sm)) 0 var(--spacing-base);
    color: var(--color-error);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-base);
  }

  &__dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
  }

  &__dialog-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: none;
    border-radius: var(--radius-full);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background var(--transition-fast), opacity var(--transition-fast);

    &--cancel {
      background: transparent;
      color: var(--color-text-secondary);

      &:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
      }
    }

    &--confirm {
      background: var(--color-primary);
      color: var(--color-text);

      &:hover {
        background: var(--color-primary-hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    &--danger {
      background: var(--color-error);
      color: var(--color-text);

      &:hover {
        background: #e53935;
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
