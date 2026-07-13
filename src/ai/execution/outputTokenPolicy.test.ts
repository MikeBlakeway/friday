import { describe, expect, it } from 'vitest'

import {
  assistantDisplayDefaults,
  formatAssistantResponseForDisplay,
  getDefaultMaxOutputTokens,
  workflowOutputTokenDefaults,
} from './outputTokenPolicy.js'

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

describe('assistant response display policy', () => {
  it('limits output by lines and characters with an explicit truncation result', () => {
    expect(
      formatAssistantResponseForDisplay('one\ntwo\nthree\nfour', {
        maxLines: 3,
        maxChars: 11,
      }),
    ).toEqual({
      content: 'one\ntwo\nthr',
      truncated: true,
      redactedSecretCount: 0,
      policy: { maxLines: 3, maxChars: 11 },
    })
  })

  it('redacts detected secrets before returning content for stdout', () => {
    const result = formatAssistantResponseForDisplay(
      'Use API_KEY=abc1234567890secret and sk-abc123456789xyzDEF456789.',
    )

    expect(result.content).toContain('[REDACTED BY FRIDAY]')
    expect(result.content).not.toContain('abc1234567890secret')
    expect(result.content).not.toContain('sk-abc123456789xyzDEF456789')
    expect(result.redactedSecretCount).toBe(2)
    expect(assistantDisplayDefaults.maxLines).toBeGreaterThan(0)
    expect(assistantDisplayDefaults.maxChars).toBeGreaterThan(0)
  })

  it('redacts incomplete private-key blocks through the end of displayed content', () => {
    const result = formatAssistantResponseForDisplay(
      'Before\n-----BEGIN OPENSSH PRIVATE KEY-----\nsuper-secret-key-material',
    )

    expect(result.content).toBe('Before\n[REDACTED BY FRIDAY]')
    expect(result.content).not.toContain('super-secret-key-material')
    expect(result.redactedSecretCount).toBe(1)
  })
})
