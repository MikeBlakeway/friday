import { describe, expect, it } from 'vitest'

import type { ComposeAiRouteRecommendationInput } from './composeAiRouteRecommendation.js'
import { composeAiRouteRecommendation } from './composeAiRouteRecommendation.js'

function createInput(
  overrides: Partial<ComposeAiRouteRecommendationInput> = {},
): ComposeAiRouteRecommendationInput {
  return {
    taskType: 'ask',
    prompt: 'What is dependency injection in TypeScript?',
    complexity: 'medium',
    confidenceRequirement: 'standard',
    costPreference: 'balanced',
    allowHostedModels: true,
    allowPremiumModels: false,
    ...overrides,
  }
}

describe('composeAiRouteRecommendation', () => {
  it('blocks secret context without producing a hosted route', () => {
    const result = composeAiRouteRecommendation(
      createInput({
        prompt: 'Review this request with OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789',
      }),
    )

    expect(result.classification.privacyLevel).toBe('secret')
    expect(result.routeInput.privacyLevel).toBe('secret')
    expect(result.recommendation.route).toMatchObject({
      decision: 'blocked',
      provider: 'none',
      modelTier: 'none',
      blocked: true,
    })
    expect(result.recommendation.alternatives).toEqual([])
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Secrets detected. Hosted model use must be blocked until the content is removed or redacted.',
        'Secret context must never be sent to AI models.',
      ]),
    )
  })

  it('keeps sensitive context local with user-facing warnings', () => {
    const result = composeAiRouteRecommendation(
      createInput({
        prompt: 'Summarise customer data containing PII and payroll notes.',
        taskType: 'review',
      }),
    )

    expect(result.classification.privacyLevel).toBe('sensitive')
    expect(result.routeInput.privacyLevel).toBe('sensitive')
    expect(result.recommendation.route).toMatchObject({
      decision: 'use-local',
      provider: 'local',
      modelTier: 'local',
      blocked: false,
    })
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Sensitive content should avoid hosted models unless an explicit policy allows it.',
        'Sensitive context is being kept local.',
      ]),
    )
  })

  it('builds a route input from classified prompt metadata', () => {
    const result = composeAiRouteRecommendation(
      createInput({
        prompt: 'Project roadmap planning for the next release.',
        declaredPrivacyLevel: 'private-repo',
        filePath: 'docs/roadmap.md',
        taskType: 'plan',
        complexity: 'high',
        confidenceRequirement: 'high',
        costPreference: 'quality-first',
        allowPremiumModels: true,
      }),
    )

    expect(result.classification.privacyLevel).toBe('private-repo')
    expect(result.routeInput).toEqual({
      taskType: 'plan',
      privacyLevel: 'private-repo',
      complexity: 'high',
      confidenceRequirement: 'high',
      costPreference: 'quality-first',
      allowHostedModels: true,
      allowPremiumModels: true,
    })
    expect(result.recommendation.route.decision).toBe('use-premium')
  })
})
