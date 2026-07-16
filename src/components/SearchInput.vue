<template>
  <div class="search-input" ref="containerRef">
    <div
      class="search-input__field"
      :class="{ 'search-input__field--keyboard-focus': isKeyboardFocused }"
    >
      <span class="search-input__prompt">$</span>
      <span class="search-input__command">find</span>
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
        @blur="onBlur"
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
        clear
      </button>
    </div>

    <div v-if="showDropdown" class="search-input__dropdown" role="listbox">
      <div v-if="suggestions.length > 0" class="search-input__section">
        <div class="search-input__section-title">联想</div>
        <div
          v-for="(item, index) in suggestions"
          :key="'suggestion-' + index"
          class="search-input__item"
          role="option"
          @click="selectItem(item)"
        >
          <span class="search-input__item-prefix">&gt;</span>
          <span class="search-input__item-text">{{ item }}</span>
        </div>
      </div>

      <div v-if="history.length > 0" class="search-input__section">
        <div class="search-input__section-title">历史</div>
        <div
          v-for="(item, index) in history"
          :key="'history-' + index"
          class="search-input__item"
          role="option"
          @click="selectItem(item)"
        >
          <span class="search-input__item-prefix">#</span>
          <span class="search-input__item-text">{{ item }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface SearchInputProps {
  modelValue: string
  suggestions?: string[]
  history?: string[]
  placeholder?: string
}

const props = withDefaults(defineProps<SearchInputProps>(), {
  suggestions: () => [],
  history: () => [],
  placeholder: '输入歌曲、歌手或专辑...',
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
const isKeyboardFocused = ref(false)
let lastInteractionWasKeyboard = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const showDropdown = computed(() => isFocused.value && (props.suggestions.length > 0 || props.history.length > 0))

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value
  emit('update:modelValue', value)

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
  isKeyboardFocused.value = lastInteractionWasKeyboard
}

function onBlur() {
  isKeyboardFocused.value = false
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

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    lastInteractionWasKeyboard = true
  }
}

function handleDocumentPointerDown() {
  lastInteractionWasKeyboard = false
  isKeyboardFocused.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleDocumentKeydown, true)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
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
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(7, 9, 7, 0.72);

    &:focus-within {
      border-color: var(--color-border);
      background: rgba(7, 9, 7, 0.72);
      box-shadow: none;
    }

    &--keyboard-focus {
      border-color: rgba(159, 247, 177, 0.42);
      box-shadow: inset 0 0 0 1px rgba(159, 247, 177, 0.08);
    }
  }

  &__prompt {
    color: var(--color-primary);
  }

  &__command {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  &__input {
    min-width: 0;
    color: var(--color-text);

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }

  &__clear {
    padding: 6px 10px;
    border-left: 1px solid var(--color-divider);
    color: var(--color-text-secondary);

    &:hover {
      color: var(--color-text);
      border-color: var(--color-primary);
    }
  }

  &__dropdown {
    position: absolute;
    top: calc(100% + var(--spacing-sm));
    left: 0;
    right: 0;
    z-index: var(--z-dropdown);
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: rgba(8, 10, 8, 0.98);
    box-shadow: var(--shadow-lg);
    padding: 8px 0;
  }

  &__section + &__section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--color-divider);
  }

  &__section-title {
    padding: 4px 14px 8px;
    color: var(--color-accent);
    font-size: var(--font-size-xs);
    letter-spacing: 0;
  }

  &__item {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 8px;
    padding: 8px 14px;
    cursor: pointer;

    &:hover {
      background: rgba(18, 24, 18, 0.72);
    }
  }

  &__item-prefix {
    color: var(--color-primary);
  }

  &__item-text {
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
