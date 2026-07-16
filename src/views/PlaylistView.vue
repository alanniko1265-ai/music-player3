<template>
  <div class="playlist-view">
    <section class="playlist-view__banner">
      <div>
        <div class="playlist-view__kicker">$ playlists</div>
        <h1 class="playlist-view__title">歌单</h1>
      </div>
      <div class="playlist-view__stats">
        <span>总数 {{ playlists.length }}</span>
      </div>
    </section>

    <section class="playlist-view__toolbar">
      <div class="playlist-view__toolbar-left">
        <button class="playlist-view__btn" type="button" @click="openImportDialog">[导入]</button>
        <button class="playlist-view__btn playlist-view__btn--primary" type="button" @click="showCreateDialog = true">[新建]</button>
      </div>
    </section>

    <div class="playlist-view__content">
      <div v-if="playlists.length === 0" class="playlist-view__empty">
        <div class="playlist-view__empty-box">[ 空 ]</div>
        <p>还没有歌单</p>
      </div>

      <div v-else class="playlist-view__table">
        <div class="playlist-view__table-head">
          <span>#</span>
          <span>名称</span>
          <span>曲目数</span>
          <span>更新时间</span>
          <span>操作</span>
        </div>

        <div
          v-for="(playlist, index) in playlists"
          :key="playlist.id"
          class="playlist-view__row"
          role="button"
          tabindex="0"
          @click="navigateToDetail(playlist.id)"
          @keydown.enter="navigateToDetail(playlist.id)"
        >
          <span class="playlist-view__cell playlist-view__cell--index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="playlist-view__cell playlist-view__cell--name">
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
            <span v-else>{{ playlist.name }}</span>
          </span>
          <span class="playlist-view__cell">{{ playlist.tracks.length }}</span>
          <span class="playlist-view__cell">{{ formatDate(playlist.updatedAt) }}</span>
          <span class="playlist-view__cell playlist-view__cell--actions" @click.stop>
            <button class="playlist-view__icon-btn" type="button" @click="startRename(playlist)">[e]</button>
            <button class="playlist-view__icon-btn playlist-view__icon-btn--danger" type="button" @click="requestDelete(playlist)">[d]</button>
          </span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showCreateDialog" class="playlist-view__overlay" @click.self="closeCreateDialog">
        <div class="playlist-view__dialog" role="dialog" aria-labelledby="create-dialog-title">
          <h2 id="create-dialog-title">新建歌单</h2>
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
            <button class="playlist-view__dialog-btn" type="button" @click="closeCreateDialog">取消</button>
            <button class="playlist-view__dialog-btn playlist-view__dialog-btn--primary" type="button" :disabled="!createName.trim()" @click="confirmCreate">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showImportDialog" class="playlist-view__overlay" @click.self="closeImportDialog">
        <div class="playlist-view__dialog playlist-view__dialog--wide" role="dialog" aria-labelledby="import-dialog-title">
          <h2 id="import-dialog-title">导入歌单</h2>
          <div class="playlist-view__source-tabs" role="tablist" aria-label="选择来源">
            <button class="playlist-view__source-tab" :class="{ 'playlist-view__source-tab--active': importSource === 'qq' }" type="button" role="tab" :aria-selected="importSource === 'qq'" @click="importSource = 'qq'">QQ</button>
            <button class="playlist-view__source-tab" :class="{ 'playlist-view__source-tab--active': importSource === 'netease' }" type="button" role="tab" :aria-selected="importSource === 'netease'" @click="importSource = 'netease'">网易</button>
          </div>
          <input
            ref="importInputRef"
            v-model="importInput"
            class="playlist-view__dialog-input"
            type="text"
            placeholder="粘贴歌单链接或 ID"
            :disabled="isImporting"
            @keydown.enter="confirmImport"
            @keydown.escape="closeImportDialog"
          />
          <p v-if="importError" class="playlist-view__dialog-error">{{ importError }}</p>
          <div class="playlist-view__dialog-actions">
            <button class="playlist-view__dialog-btn" type="button" :disabled="isImporting" @click="closeImportDialog">取消</button>
            <button class="playlist-view__dialog-btn playlist-view__dialog-btn--primary" type="button" :disabled="!canImport" @click="confirmImport">{{ isImporting ? '导入中...' : '导入' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showDeleteDialog" class="playlist-view__overlay" @click.self="closeDeleteDialog">
        <div class="playlist-view__dialog" role="alertdialog" aria-labelledby="delete-dialog-title">
          <h2 id="delete-dialog-title">删除歌单</h2>
          <p class="playlist-view__dialog-message">
            确定删除 <span class="playlist-view__dialog-highlight">{{ deletingPlaylist?.name }}</span> 吗？
          </p>
          <div class="playlist-view__dialog-actions">
            <button class="playlist-view__dialog-btn" type="button" @click="closeDeleteDialog">取消</button>
            <button class="playlist-view__dialog-btn playlist-view__dialog-btn--danger" type="button" @click="confirmDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Playlist } from '@/types'
import { usePlaylistStore } from '@/stores/playlist-store'
import { importPlaylistFromPlatform, type PlaylistImportSource } from '@/services/playlist-import-service'

const playlistStore = usePlaylistStore()
const router = useRouter()

const playlists = computed(() => playlistStore.playlists)

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

const showDeleteDialog = ref(false)
const deletingPlaylist = ref<Playlist | null>(null)

const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await playlistStore.init()
})

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
      throw new Error('没有可播放歌曲')
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

async function startRename(playlist: Playlist): Promise<void> {
  renamingId.value = playlist.id
  renameValue.value = playlist.name
  await nextTick()
  const inputs = renameInputRef.value
  if (Array.isArray(inputs) && inputs.length > 0) {
    inputs[0].focus()
    inputs[0].select()
  } else if (inputs) {
    inputs.focus()
    inputs.select()
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

function navigateToDetail(playlistId: string): void {
  router.push({ name: 'playlist-detail', params: { id: playlistId } })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<style lang="scss" scoped>
.playlist-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 12px;

  &__banner,
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-divider);
    background: rgba(10, 13, 10, 0.44);
  }

  &__kicker,
  &__stats,
  &__toolbar-right {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  &__kicker {
    color: var(--color-accent);
    letter-spacing: 0;
  }

  &__title {
    margin: 2px 0 0;
    font-size: var(--font-size-xl);
  }

  &__stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  &__toolbar-left {
    display: flex;
    gap: 10px;
  }

  &__btn,
  &__icon-btn {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.56);
    color: var(--color-text-secondary);

    &:hover {
      color: var(--color-text);
      border-color: var(--color-primary);
    }
  }

  &__btn--primary {
    color: #071009;
    background: var(--color-primary);
    border-color: var(--color-primary);
  }

  &__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    background: rgba(8, 10, 8, 0.38);
  }

  &__empty {
    min-height: 100%;
    display: grid;
    place-items: center;
    gap: 10px;
    color: var(--color-text-secondary);
  }

  &__empty-box {
    color: var(--color-primary);
  }

  &__table {
    display: flex;
    flex-direction: column;
  }

  &__table-head,
  &__row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1.8fr) 120px 150px 120px;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
  }

  &__table-head {
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-primary);
    background: rgba(8, 10, 8, 0.96);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__row {
    border-bottom: 1px solid var(--color-divider);
    cursor: pointer;

    &:hover {
      background: rgba(18, 24, 18, 0.58);
    }
  }

  &__cell {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
  }

  &__cell--index,
  &__cell--actions {
    color: var(--color-primary);
  }

  &__cell--name {
    color: var(--color-text);
  }

  &__cell--actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  &__rename-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background: rgba(8, 15, 10, 0.92);
    color: var(--color-text);
  }

  &__icon-btn--danger {
    color: var(--color-error);
  }

  &__overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--color-overlay);
    z-index: var(--z-modal);
  }

  &__dialog {
    width: 380px;
    max-width: calc(100vw - 32px);
    padding: 18px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: rgba(13, 22, 16, 0.98);
    box-shadow: var(--shadow-xl);

    h2 {
      margin-bottom: 14px;
      font-size: 18px;
    }

    &--wide {
      width: 460px;
    }
  }

  &__source-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }

  &__source-tab {
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.5);
    color: var(--color-text-secondary);

    &--active {
      color: #071009;
      background: var(--color-primary);
      border-color: var(--color-primary);
    }
  }

  &__dialog-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(8, 15, 10, 0.92);
    color: var(--color-text);
    margin-bottom: 12px;
  }

  &__dialog-error {
    margin: -4px 0 12px;
    color: var(--color-error);
    font-size: var(--font-size-sm);
  }

  &__dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  &__dialog-btn {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(18, 24, 18, 0.56);
    color: var(--color-text-secondary);

    &--primary {
      color: #071009;
      background: var(--color-primary);
      border-color: var(--color-primary);
    }

    &--danger {
      color: var(--color-error);
    }
  }

  &__dialog-highlight {
    color: var(--color-primary);
  }
}
</style>
