import { describe, expect, it } from 'vitest'

import { classifyPromptPrivacy } from './classifyPromptPrivacy.js'

describe('classifyPromptPrivacy', () => {
  it('blocks secret content as secret', () => {
    const result = classifyPromptPrivacy({
      content: 'Use OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789',
    })

    expect(result.privacyLevel).toBe('secret')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Hosted model use must be blocked')
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'secret-detected', severity: 'high' }),
      ]),
    )
  })

  it('blocks secret file paths even without detected secret values', () => {
    const result = classifyPromptPrivacy({
      content: 'DATABASE_URL is configured elsewhere',
      filePath: '.env.local',
    })

    expect(result.privacyLevel).toBe('secret')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('File path is likely to contain secrets')
  })

  it('respects declared sensitive privacy', () => {
    const result = classifyPromptPrivacy({
      content: 'Generic implementation note',
      declaredPrivacyLevel: 'sensitive',
    })

    expect(result.privacyLevel).toBe('sensitive')
    expect(result.blocked).toBe(false)
  })

  it('does not downgrade declared private repo privacy', () => {
    const result = classifyPromptPrivacy({
      content: 'What is the difference between arrays and tuples?',
      declaredPrivacyLevel: 'private-repo',
    })

    expect(result.privacyLevel).toBe('private-repo')
    expect(result.blocked).toBe(false)
  })

  it('classifies customer and PII context as sensitive', () => {
    const result = classifyPromptPrivacy({
      content: 'Customer data includes PII, payroll details, and medical notes.',
    })

    expect(result.privacyLevel).toBe('sensitive')
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'personal-data', severity: 'high' }),
      ]),
    )
  })

  it('classifies code-like content as private repo context', () => {
    const result = classifyPromptPrivacy({
      content: 'export const route = () => ({ file: "src/app.ts", package: "package.json" })',
    })

    expect(result.privacyLevel).toBe('private-repo')
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'private-repo-context' }),
      ]),
    )
  })

  it('classifies project planning context as internal', () => {
    const result = classifyPromptPrivacy({
      content: 'Project roadmap planning for the next Friday milestone and release sequencing.',
    })

    expect(result.privacyLevel).toBe('internal')
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'internal-context' }),
      ]),
    )
  })

  it('classifies generic public technical questions as public', () => {
    const result = classifyPromptPrivacy({
      content: 'What is dependency injection in TypeScript?',
    })

    expect(result.privacyLevel).toBe('public')
    expect(result.blocked).toBe(false)
    expect(result.signals).toEqual([
      expect.objectContaining({ kind: 'public-context', severity: 'low' }),
    ])
  })

  it('lets stronger content signals beat weaker declared privacy', () => {
    const result = classifyPromptPrivacy({
      content: 'interface CustomerRecord { pii: string; payroll: string }',
      declaredPrivacyLevel: 'internal',
    })

    expect(result.privacyLevel).toBe('sensitive')
  })

  it('preserves declared secret privacy as blocked', () => {
    const result = classifyPromptPrivacy({
      content: 'Secret material stored outside this prompt',
      declaredPrivacyLevel: 'secret',
    })

    expect(result.privacyLevel).toBe('secret')
    expect(result.blocked).toBe(true)
  })

  it('returns useful signals and a non-empty reason', () => {
    const result = classifyPromptPrivacy({
      content: 'function run() { throw new Error("failed") }\n    at src/index.ts:10:2',
      filePath: 'src/index.ts',
    })

    expect(result.signals.length).toBeGreaterThan(0)
    expect(result.reason.length).toBeGreaterThan(10)
  })
})
