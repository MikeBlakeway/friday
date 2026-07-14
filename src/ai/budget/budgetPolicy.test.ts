import { describe, expect, it } from 'vitest'

import { classifyPromptPrivacy } from '../privacy/classifyPromptPrivacy.js'
import type { AiRoute } from '../routing/modelRouting.js'
import { createExecutionLogRecord, type ExecutionLogRecord } from '../usage/executionLog.js'
import {
  evaluateHostedBudgetPolicy,
  parseBudgetPolicyConfiguration,
  resolveEffectiveHostedBudgetPolicy,
  type BudgetPolicyConfiguration,
} from './budgetPolicy.js'
import { evaluateHostedExecutionBudgetPreflight } from './hostedPreflight.js'

const hostedRoute: AiRoute = {
  decision: 'use-strong-hosted',
  provider: 'deepseek',
  modelTier: 'strong-hosted',
  model: 'deepseek-v4-pro',
  reason: 'Hosted request approved for this preflight test.',
  requiresApproval: true,
  blocked: false,
}

const localRoute: AiRoute = {
  decision: 'use-local',
  provider: 'local',
  modelTier: 'local',
  model: 'local-coder',
  reason: 'Local execution.',
  requiresApproval: false,
  blocked: false,
}

function policy(overrides: Partial<BudgetPolicyConfiguration> = {}): BudgetPolicyConfiguration {
  return {
    schemaVersion: 1,
    period: 'calendar-month',
    currency: 'USD',
    aggregateHostedCost: {
      warningThreshold: 4,
      hardLimit: 5,
    },
    ...overrides,
  }
}

function record(overrides: Partial<ExecutionLogRecord> = {}): ExecutionLogRecord {
  return createExecutionLogRecord({
    id: 'hosted-exec',
    workflow: { type: 'plan' },
    recommendedRoute: hostedRoute,
    chosenRoute: hostedRoute,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    startedAt: '2026-07-10T10:00:00.000Z',
    completedAt: '2026-07-10T10:00:01.000Z',
    latencyMs: 1_000,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    costEstimate: {
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      currency: 'USD',
      estimatedInputTokens: 10,
      estimatedOutputTokens: 20,
      estimatedTotalTokens: 30,
      estimatedTotalCost: 3,
      advisory: true,
      basis: 'estimated-token-counts',
    },
    result: { status: 'succeeded' },
    privacy: { privacyLevel: 'public', blocked: false, secretDetected: false },
    ...overrides,
  })
}

describe('hosted budget policy', () => {
  it('validates a versioned policy and rejects legacy or unsafe configuration', () => {
    expect(
      parseBudgetPolicyConfiguration(
        JSON.stringify({
          schemaVersion: 1,
          period: 'calendar-month',
          currency: 'USD',
          aggregateHostedCost: { warningThreshold: 2, hardLimit: 3 },
        }),
        '/repo/.friday/budget-policy.json',
      ),
    ).toEqual(policy({ aggregateHostedCost: { warningThreshold: 2, hardLimit: 3 } }))

    expect(() => parseBudgetPolicyConfiguration('{}', '/repo/.friday/budget-policy.json')).toThrow(
      'Unsupported budget policy schemaVersion',
    )
    expect(() =>
      parseBudgetPolicyConfiguration(
        JSON.stringify({
          schemaVersion: 1,
          period: 'calendar-month',
          currency: 'USD',
          aggregateHostedCost: { warningThreshold: 5, hardLimit: 4 },
        }),
        '/repo/.friday/budget-policy.json',
      ),
    ).toThrow('warningThreshold cannot exceed hardLimit')
  })

  it('uses existing hosted execution history, ignores local execution, and scopes usage to the calendar month', () => {
    const result = evaluateHostedBudgetPolicy({
      records: [
        record(),
        record({
          id: 'local-exec',
          chosenRoute: localRoute,
          provider: 'lm-studio',
          model: 'local-coder',
          costEstimate: {
            ...record().costEstimate,
            provider: 'local',
            model: 'local-coder',
            estimatedTotalCost: 99,
          },
        }),
        record({ id: 'last-month', completedAt: '2026-06-30T23:59:59.000Z' }),
      ],
      policies: { project: policy() },
      estimatedRequestCost: 1.5,
      currency: 'USD',
      now: new Date('2026-07-14T12:00:00.000Z'),
    })

    expect(result).toMatchObject({
      schemaVersion: 1,
      source: 'project',
      currentUsage: 3,
      estimatedRequestCost: 1.5,
      projectedUsage: 4.5,
      applicableLimit: 5,
      remainingAllowance: 0.5,
      status: 'warning',
      warningAcknowledgementRequired: true,
    })
  })

  it('merges global and project limits toward the more restrictive policy', () => {
    const effective = resolveEffectiveHostedBudgetPolicy({
      global: policy({ aggregateHostedCost: { warningThreshold: 4, hardLimit: 10 } }),
      project: policy({ aggregateHostedCost: { warningThreshold: 2, hardLimit: 7 } }),
    })

    expect(effective).toMatchObject({
      source: 'global-and-project',
      warningThreshold: 2,
      hardLimit: 7,
      allowHardLimitOverride: false,
    })
  })

  it('requires explicit warning acknowledgement, records permitted hard-limit overrides, and never weakens privacy blocks', () => {
    const warning = evaluateHostedExecutionBudgetPreflight({
      records: [record()],
      policies: { project: policy() },
      estimatedRequestCost: 1.5,
      currency: 'USD',
      classification: classifyPromptPrivacy({ content: 'A safe public prompt.' }),
      now: new Date('2026-07-14T12:00:00.000Z'),
    })
    expect(warning.canProceed).toBe(false)
    expect(warning.reasons).toContain(
      'Hosted execution requires an explicit warning acknowledgement before invocation.',
    )

    const hardLimitOverride = evaluateHostedExecutionBudgetPreflight({
      records: [record()],
      policies: {
        project: policy({
          aggregateHostedCost: { warningThreshold: 4, hardLimit: 4, allowHardLimitOverride: true },
        }),
      },
      estimatedRequestCost: 1.5,
      currency: 'USD',
      classification: classifyPromptPrivacy({ content: 'A safe public prompt.' }),
      overrideHardLimit: true,
      now: new Date('2026-07-14T12:00:00.000Z'),
    })
    expect(hardLimitOverride).toMatchObject({
      canProceed: true,
      override: { schemaVersion: 1, reason: 'hard-limit' },
    })

    const privacyBlocked = evaluateHostedExecutionBudgetPreflight({
      records: [record()],
      policies: {
        project: policy({
          aggregateHostedCost: { warningThreshold: 4, hardLimit: 4, allowHardLimitOverride: true },
        }),
      },
      estimatedRequestCost: 1.5,
      currency: 'USD',
      classification: classifyPromptPrivacy({
        content: 'OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789',
      }),
      overrideHardLimit: true,
      now: new Date('2026-07-14T12:00:00.000Z'),
    })
    expect(privacyBlocked.canProceed).toBe(false)
    expect(privacyBlocked.reasons[0]).toContain('privacy or secret-safety policy')
  })

  it('fails hosted preflight safely when no budget policy is configured', () => {
    const preflight = evaluateHostedExecutionBudgetPreflight({
      records: [],
      policies: {},
      estimatedRequestCost: 0.25,
      currency: 'USD',
      classification: classifyPromptPrivacy({ content: 'A safe public prompt.' }),
      now: new Date('2026-07-14T12:00:00.000Z'),
    })

    expect(preflight.canProceed).toBe(false)
    expect(preflight.reasons).toContain(
      'Hosted execution requires an explicit global or project budget policy before invocation.',
    )
  })
})
