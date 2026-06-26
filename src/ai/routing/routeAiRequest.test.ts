import { describe, expect, it } from 'vitest'

import type { RouteAiRequestInput } from './modelRouting.js'
import { routeAiRequest } from './routeAiRequest.js'

function createInput(
  overrides: Partial<RouteAiRequestInput> = {},
): RouteAiRequestInput {
  return {
    taskType: 'ask',
    privacyLevel: 'public',
    complexity: 'medium',
    confidenceRequirement: 'standard',
    costPreference: 'balanced',
    allowHostedModels: true,
    allowPremiumModels: false,
    ...overrides,
  }
}

describe('routeAiRequest', () => {
  it('blocks secret context without alternatives', () => {
    const result = routeAiRequest(createInput({ privacyLevel: 'secret' }))

    expect(result.route).toMatchObject({
      decision: 'blocked',
      provider: 'none',
      modelTier: 'none',
      model: 'none',
      blocked: true,
      requiresApproval: false,
    })
    expect(result.warnings).toContain('Secret context must never be sent to AI models.')
    expect(result.alternatives).toEqual([])
  })

  it('uses a local model when hosted models are disabled', () => {
    const result = routeAiRequest(
      createInput({
        allowHostedModels: false,
        complexity: 'high',
        confidenceRequirement: 'high',
      }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-local',
      provider: 'local',
      modelTier: 'local',
      model: 'local-coder',
      blocked: false,
    })
    expect(result.warnings).toContain(
      'The local route may be insufficient for high-complexity or high-confidence work.',
    )
    expect(result.alternatives).toEqual([])
  })

  it('keeps sensitive context local', () => {
    const result = routeAiRequest(createInput({ privacyLevel: 'sensitive' }))

    expect(result.route).toMatchObject({
      decision: 'use-local',
      provider: 'local',
      modelTier: 'local',
      model: 'local-coder',
      requiresApproval: false,
      blocked: false,
    })
    expect(result.warnings).toContain('Sensitive context is being kept local.')
  })

  it('uses cheap hosted for low-complexity draft work', () => {
    const result = routeAiRequest(
      createInput({ complexity: 'low', confidenceRequirement: 'draft' }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-cheap-hosted',
      provider: 'deepseek',
      modelTier: 'cheap-hosted',
      model: 'deepseek-v4-flash',
    })
    expect(result.alternatives).toContainEqual(
      expect.objectContaining({ decision: 'use-strong-hosted' }),
    )
  })

  it('uses strong hosted for planning work', () => {
    const result = routeAiRequest(createInput({ taskType: 'plan' }))

    expect(result.route).toMatchObject({
      decision: 'use-strong-hosted',
      provider: 'deepseek',
      modelTier: 'strong-hosted',
      model: 'deepseek-v4-pro',
    })
  })

  it('uses strong hosted for review work', () => {
    const result = routeAiRequest(createInput({ taskType: 'review' }))

    expect(result.route).toMatchObject({
      decision: 'use-strong-hosted',
      provider: 'deepseek',
      modelTier: 'strong-hosted',
      model: 'deepseek-v4-pro',
    })
  })

  it('uses premium for high-complexity, high-confidence quality-first work when allowed', () => {
    const result = routeAiRequest(
      createInput({
        complexity: 'high',
        confidenceRequirement: 'high',
        costPreference: 'quality-first',
        allowPremiumModels: true,
      }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-premium',
      provider: 'anthropic',
      modelTier: 'premium',
      model: 'claude-opus',
      requiresApproval: true,
      blocked: false,
    })
  })

  it('uses strong hosted and warns when premium escalation is not allowed', () => {
    const result = routeAiRequest(
      createInput({
        complexity: 'high',
        confidenceRequirement: 'high',
        costPreference: 'quality-first',
      }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-strong-hosted',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    })
    expect(result.warnings).toContain(
      'Premium escalation would normally be considered but premium models are not allowed.',
    )
  })

  it('uses premium for an escalation task when premium models are allowed', () => {
    const result = routeAiRequest(
      createInput({ taskType: 'escalate', allowPremiumModels: true }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-premium',
      provider: 'anthropic',
      model: 'claude-opus',
      requiresApproval: true,
    })
  })

  it('uses strong hosted and warns when escalation is requested but premium is disabled', () => {
    const result = routeAiRequest(createInput({ taskType: 'escalate' }))

    expect(result.route).toMatchObject({
      decision: 'use-strong-hosted',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    })
    expect(result.warnings).toContain(
      'Escalation was requested but premium models are disabled.',
    )
  })

  it('uses cheap hosted for a safe minimise-cost fallback', () => {
    const result = routeAiRequest(
      createInput({ taskType: 'design', complexity: 'low', costPreference: 'minimise-cost' }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-cheap-hosted',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    })
  })

  it('uses strong hosted for a balanced medium-complexity ask', () => {
    const result = routeAiRequest(
      createInput({ taskType: 'ask', complexity: 'medium', costPreference: 'balanced' }),
    )

    expect(result.route).toMatchObject({
      decision: 'use-strong-hosted',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
    })
  })
})
