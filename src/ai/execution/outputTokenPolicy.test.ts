import { describe, expect, it } from 'vitest'

import { getDefaultMaxOutputTokens, workflowOutputTokenDefaults } from './outputTokenPolicy.js'

describe('workflow output token policy', () => {
  it('defines shared reasoning-aware defaults for plan, review, and other tasks', () => {
    expect(workflowOutputTokenDefaults).toEqual({
      plan: 4_000,
      review: 3_000,
      explicitTask: 2_000,
    })
    expect(getDefaultMaxOutputTokens('plan')).toBe(4_000)
    expect(getDefaultMaxOutputTokens('review')).toBe(3_000)
    expect(getDefaultMaxOutputTokens('build')).toBe(2_000)
  })
})
