import { describe, it, expect } from 'vitest'

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(1 + 1).toBe(2)
  })

  it('should support TypeScript', () => {
    const greeting: string = 'Hello, Music Player!'
    expect(greeting).toContain('Music Player')
  })
})
