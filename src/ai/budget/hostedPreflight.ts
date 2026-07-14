import type { PrivacyClassificationResult } from '../privacy/privacyClassification.js'
import type { ExecutionLogRecord } from '../usage/executionLog.js'
import {
  evaluateHostedBudgetPolicy,
  type HostedBudgetPolicyResult,
  type LoadedBudgetPolicies,
} from './budgetPolicy.js'

export const BUDGET_OVERRIDE_SCHEMA_VERSION = 1

export interface BudgetOverrideRecord {
  schemaVersion: typeof BUDGET_OVERRIDE_SCHEMA_VERSION
  reason: 'warning-acknowledged' | 'hard-limit'
  recordedAt: string
}

export interface HostedExecutionBudgetPreflight {
  policy: HostedBudgetPolicyResult
  canProceed: boolean
  override?: BudgetOverrideRecord
  reasons: string[]
}

export function evaluateHostedExecutionBudgetPreflight(input: {
  records: ExecutionLogRecord[]
  policies: LoadedBudgetPolicies
  estimatedRequestCost: number
  currency: string
  classification: PrivacyClassificationResult
  acknowledgeWarning?: boolean
  overrideHardLimit?: boolean
  now?: Date
}): HostedExecutionBudgetPreflight {
  const policy = evaluateHostedBudgetPolicy({
    records: input.records,
    policies: input.policies,
    estimatedRequestCost: input.estimatedRequestCost,
    currency: input.currency,
    ...(input.now === undefined ? {} : { now: input.now }),
  })

  if (input.classification.blocked || input.classification.privacyLevel === 'secret') {
    return {
      policy,
      canProceed: false,
      reasons: [
        'Hosted execution remains blocked by privacy or secret-safety policy; a budget acknowledgement or override cannot weaken that block.',
      ],
    }
  }

  if (policy.source === 'none') {
    return {
      policy,
      canProceed: false,
      reasons: [
        'Hosted execution requires an explicit global or project budget policy before invocation.',
      ],
    }
  }

  if (policy.status === 'warning') {
    if (!input.acknowledgeWarning) {
      return {
        policy,
        canProceed: false,
        reasons: [
          'Hosted execution requires an explicit warning acknowledgement before invocation.',
        ],
      }
    }

    return {
      policy,
      canProceed: true,
      override: {
        schemaVersion: BUDGET_OVERRIDE_SCHEMA_VERSION,
        reason: 'warning-acknowledged',
        recordedAt: (input.now ?? new Date()).toISOString(),
      },
      reasons: ['Hosted budget warning was explicitly acknowledged before invocation.'],
    }
  }

  if (policy.status === 'blocked') {
    if (!input.overrideHardLimit || !policy.hardLimitOverrideAllowed) {
      return {
        policy,
        canProceed: false,
        reasons: [
          policy.hardLimitOverrideAllowed
            ? 'Hosted execution exceeds the hard limit and requires an explicit auditable override.'
            : 'Hosted execution exceeds the hard limit and policy does not permit an override.',
        ],
      }
    }

    return {
      policy,
      canProceed: true,
      override: {
        schemaVersion: BUDGET_OVERRIDE_SCHEMA_VERSION,
        reason: 'hard-limit',
        recordedAt: (input.now ?? new Date()).toISOString(),
      },
      reasons: [
        'Hosted hard-limit override was explicitly authorised and must be recorded locally.',
      ],
    }
  }

  return {
    policy,
    canProceed: true,
    reasons: ['Hosted budget policy permits this request.'],
  }
}
