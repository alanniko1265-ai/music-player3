<template>
  <div class="search-input" ref="containerRef">
    <div class="search-input__field">
      <svg class="search-input__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        ref="inputRef"
        type="text"
        class="search-input__input"
        :value="modelValue"
        :placeholder="placeholder"
        @input="onInput"
        @keydown.enter="onSubmit"
        @keydown.escape="closeDropdown"
        @focus="onFocus"
        aria-label="搜索音乐"
        aria-autocomplete="list"
        :aria-expanded="showDropdown"
      />
      <button
        v-if="modelValue"
        class="search-input__clear"
        @click="onClear"
        aria-label="清空搜索"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div v-if="showDropdown" class="search-input__dropdown" role="listbox">
      <div v-if="suggestions.length > 0" class="search-input__section">
        <div class="search-input__section-title">热门搜索</div>
        <div
          v-for="(item, index) in suggestions"
          :key="'suggestion-' + index"
          class="search-input__item"
          role="option"
          @click="selectItem(item)"
        >
          <svg class="search-input__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span class="search-input__item-text">{{ item }}</span>
        </div>
      </div>
      <div v-if="history.length > 0" class="search-input__section">
        <div class="search-input__section-title">搜索历史</div>
        <div
          v-for="(item, index) in history"
          :key="'history-' + index"
          class="search-input__item"
          role="option"
          @click="selectItem(item)"
        >
          <svg class="search-input__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="search-input__item-text">{{ item }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface SearchInputProps {
  modelValue: string
  suggestions?: string[]
  history?: string[]
  placeholder?: string
}

const props = withDefaults(defineProps<SearchInputProps>(), {
  suggestions: () => [],
  history: () => [],
  placeholder: '搜索歌曲、艺术家、专辑...'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [value: string]
  clear: []
  suggest: [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const isFocused = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const showDropdown = computed(() => {
  return isFocused.value && (props.suggestions.length > 0 || props.history.length > 0)
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value
  emit('update:modelValue', value)

  // Debounce suggest event (300ms)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  if (value.trim()) {
    debounceTimer = setTimeout(() => {
      emit('suggest', value.trim())
    }, 300)
  }
}

function onSubmit() {
  if (props.modelValue.trim()) {
    emit('submit', props.modelValue.trim())
    closeDropdown()
  }
}

function onClear() {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

function onFocus() {
  isFocused.value = true
}

function closeDropdown() {
  isFocused.value = false
}

function selectItem(item: string) {
  emit('update:modelValue', item)
  emit('submit', item)
  closeDropdown()
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>

<style lang="scss" scoped>
.search-input {
  position: relative;
  width: 100%;

  &__field {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-base);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);

    &:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.2);
    }
  }

  &__icon {
    width: 18px;
    height: 18px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  &__input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-text);
    font-size: var(--font-size-base);
    font-family: var(--font-family);
    line-height: var(--line-height-base);

    &::placeholder {
      color: var(--color-text-disabled);
    }
  }

  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color var(--transition-fast), background var(--transition-fast);

    &:hover {
      color: var(--color-text);
      background: var(--color-surface-hover);
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  &__dropdown {
    position: absolute;
    top: calc(100% + var(--spacing-sm));
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-base);
    box-shadow: var(--shadow-lg);
    z-index: var(--z-dropdown);
    max-height: 320px;
    overflow-y: auto;
    padding: var(--spacing-sm) 0;
  }

  &__section {
    &:not(:first-child) {
      border-top: 1px solid var(--color-divider);
      margin-top: var(--spacing-sm);
      padding-top: var(--spacing-sm);
    }
  }

  &__section-title {
    padding: var(--spacing-xs) var(--spacing-base);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-base);
    cursor: pointer;
    transition: background var(--transition-fast);

    &:hover {
      background: var(--color-surface-hover);
    }
  }

  &__item-icon {
    width: 14px;
    height: 14px;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  &__item-text {
    font-size: var(--font-size-base);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
