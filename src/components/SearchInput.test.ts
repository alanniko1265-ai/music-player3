import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref, computed } from 'vue'

/**
 * SearchInput component logic tests
 * Tests the reactive state management for search input, submit, clear,
 * dropdown visibility, debounce, and keyboard navigation.
 */

// Simulate the component's core logic (node environment without full Vue mount)
function useSearchInputLogic(options: {
  modelValue: string
  suggestions?: string[]
  history?: string[]
}) {
  const modelValue = ref(options.modelValue)
  const suggestions = ref(options.suggestions ?? [])
  const history = ref(options.history ?? [])
  const isFocused = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const emitted: Record<string, unknown[][]> = {
    'update:modelValue': [],
    submit: [],
    clear: [],
    suggest: [],
  }

  function emit(event: string, ...args: unknown[]) {
    if (!emitted[event]) emitted[event] = []
    emitted[event].push(args)
  }

  const showDropdown = computed(() => {
    return isFocused.value && (suggestions.value.length > 0 || history.value.length > 0)
  })

  function onInput(value: string) {
    modelValue.value = value
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
    if (modelValue.value.trim()) {
      emit('submit', modelValue.value.trim())
      isFocused.value = false
    }
  }

  function onClear() {
    modelValue.value = ''
    emit('update:modelValue', '')
    emit('clear')
  }

  function onFocus() {
    isFocused.value = true
  }

  function closeDropdown() {
    isFocused.value = false
  }

  function selectItem(item: string) {
    modelValue.value = item
    emit('update:modelValue', item)
    emit('submit', item)
    isFocused.value = false
  }

  function cleanup() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  }

  return {
    modelValue,
    suggestions,
    history,
    isFocused,
    showDropdown,
    emitted,
    onInput,
    onSubmit,
    onClear,
    onFocus,
    closeDropdown,
    selectItem,
    cleanup,
  }
}

describe('SearchInput component logic', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with given modelValue', () => {
    const { modelValue } = useSearchInputLogic({ modelValue: 'test' })
    expect(modelValue.value).toBe('test')
  })

  it('should emit update:modelValue on input', () => {
    const { onInput, emitted } = useSearchInputLogic({ modelValue: '' })
    onInput('hello')
    expect(emitted['update:modelValue']).toEqual([['hello']])
  })

  it('should emit submit with trimmed value on Enter', () => {
    const { onSubmit, emitted } = useSearchInputLogic({ modelValue: '  周杰伦  ' })
    onSubmit()
    expect(emitted['submit']).toEqual([['周杰伦']])
  })

  it('should not emit submit when modelValue is empty or whitespace', () => {
    const { onSubmit, emitted } = useSearchInputLogic({ modelValue: '   ' })
    onSubmit()
    expect(emitted['submit']).toEqual([])
  })

  it('should emit clear and reset modelValue on clear', () => {
    const { onClear, modelValue, emitted } = useSearchInputLogic({ modelValue: 'test' })
    onClear()
    expect(modelValue.value).toBe('')
    expect(emitted['update:modelValue']).toEqual([['']])
    expect(emitted['clear']).toEqual([[]])
  })

  it('should show dropdown when focused and has suggestions', () => {
    const { showDropdown, onFocus } = useSearchInputLogic({
      modelValue: '',
      suggestions: ['热门1', '热门2'],
    })
    expect(showDropdown.value).toBe(false)
    onFocus()
    expect(showDropdown.value).toBe(true)
  })

  it('should show dropdown when focused and has history', () => {
    const { showDropdown, onFocus } = useSearchInputLogic({
      modelValue: '',
      history: ['历史1'],
    })
    expect(showDropdown.value).toBe(false)
    onFocus()
    expect(showDropdown.value).toBe(true)
  })

  it('should not show dropdown when focused but no suggestions or history', () => {
    const { showDropdown, onFocus } = useSearchInputLogic({
      modelValue: '',
      suggestions: [],
      history: [],
    })
    onFocus()
    expect(showDropdown.value).toBe(false)
  })

  it('should close dropdown on Escape', () => {
    const { showDropdown, onFocus, closeDropdown } = useSearchInputLogic({
      modelValue: '',
      suggestions: ['test'],
    })
    onFocus()
    expect(showDropdown.value).toBe(true)
    closeDropdown()
    expect(showDropdown.value).toBe(false)
  })

  it('should close dropdown on submit', () => {
    const { showDropdown, onFocus, onSubmit } = useSearchInputLogic({
      modelValue: 'query',
      suggestions: ['test'],
    })
    onFocus()
    expect(showDropdown.value).toBe(true)
    onSubmit()
    expect(showDropdown.value).toBe(false)
  })

  it('should emit update:modelValue and submit when selecting an item', () => {
    const { selectItem, emitted, modelValue, showDropdown, onFocus } = useSearchInputLogic({
      modelValue: '',
      suggestions: ['周杰伦'],
    })
    onFocus()
    selectItem('周杰伦')
    expect(modelValue.value).toBe('周杰伦')
    expect(emitted['update:modelValue']).toEqual([['周杰伦']])
    expect(emitted['submit']).toEqual([['周杰伦']])
    expect(showDropdown.value).toBe(false)
  })

  it('should debounce suggest event by 300ms', () => {
    vi.useFakeTimers()
    const logic = useSearchInputLogic({ modelValue: '' })

    logic.onInput('周')
    expect(logic.emitted['suggest']).toEqual([])

    vi.advanceTimersByTime(100)
    logic.onInput('周杰')
    expect(logic.emitted['suggest']).toEqual([])

    vi.advanceTimersByTime(100)
    logic.onInput('周杰伦')
    expect(logic.emitted['suggest']).toEqual([])

    vi.advanceTimersByTime(300)
    expect(logic.emitted['suggest']).toEqual([['周杰伦']])

    logic.cleanup()
  })

  it('should not emit suggest for whitespace-only input', () => {
    vi.useFakeTimers()
    const logic = useSearchInputLogic({ modelValue: '' })

    logic.onInput('   ')
    vi.advanceTimersByTime(300)
    expect(logic.emitted['suggest']).toEqual([])

    logic.cleanup()
  })

  it('should cancel previous debounce timer on new input', () => {
    vi.useFakeTimers()
    const logic = useSearchInputLogic({ modelValue: '' })

    logic.onInput('a')
    vi.advanceTimersByTime(200)
    logic.onInput('ab')
    vi.advanceTimersByTime(200)
    logic.onInput('abc')
    vi.advanceTimersByTime(300)

    // Only the last input should trigger suggest
    expect(logic.emitted['suggest']).toEqual([['abc']])

    logic.cleanup()
  })
})
