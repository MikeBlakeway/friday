import os from 'node:os'
import path from 'node:path'

import { pathExists, readTextFile } from '../../core/fileSystem.js'
import { FRIDAY_GLOBAL_DIR } from '../../core/globalMemory.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import type { ExecutionLogRecord } from '../usage/executionLog.js'

export const BUDGET_POLICY_SCHEMA_VERSION = 1
export const BUDGET_POLICY_RESULT_SCHEMA_VERSION = 1
export const FRIDAY_BUDGET_POLICY_FILE = 'budget-policy.json'

export type BudgetPeriod = 'calendar-month'
export type BudgetPolicySource = 'none' | 'global' | 'project' | 'global-and-project'
export type HostedBudgetStatus = 'unconfigured' | 'within' | 'warning' | 'blocked'

export interface HostedCostBudgetPolicy {
  warningThreshold?: number
  hardLimit?: number
  allowHardLimitOverride?: boolean
}

export interface BudgetPolicyConfiguration {
  schemaVersion: typeof BUDGET_POLICY_SCHEMA_VERSION
  period: BudgetPeriod
  currency: string
  aggregateHostedCost: HostedCostBudgetPolicy
}

export interface LoadedBudgetPolicies {
  global?: BudgetPolicyConfiguration
  project?: BudgetPolicyConfiguration
}

export interface EffectiveHostedBudgetPolicy {
  source: BudgetPolicySource
  period: BudgetPeriod
  currency: string
  warningThreshold?: number
  hardLimit?: number
  allowHardLimitOverride: boolean
}

export interface HostedBudgetPolicyResult {
  schemaVersion: typeof BUDGET_POLICY_RESULT_SCHEMA_VERSION
  source: BudgetPolicySource
  period: {
    type: BudgetPeriod
    startedAt: string
    endsAt: string
  }
  currency: string
  currentUsage: number
  estimatedRequestCost: number
  projectedUsage: number
  applicableLimit?: number
  remainingAllowance?: number
  overage?: number
  status: HostedBudgetStatus
  warningAcknowledgementRequired: boolean
  hardLimitOverrideAllowed: boolean
  reasons: string[]
}

export interface EvaluateHostedBudgetPolicyInput {
  records: ExecutionLogRecord[]
  policies: LoadedBudgetPolicies
  estimatedRequestCost: number
  currency: string
  now?: Date
}

export function getProjectBudgetPolicyPath(projectRoot: string): string {
  return path.join(projectRoot, FRIDAY_PROJECT_DIR, FRIDAY_BUDGET_POLICY_FILE)
}

export function getGlobalBudgetPolicyPath(homeDir = os.homedir()): string {
  return path.join(homeDir, FRIDAY_GLOBAL_DIR, FRIDAY_BUDGET_POLICY_FILE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertFiniteNonNegative(
  value: unknown,
  name: string,
  filePath: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid budget policy at ${filePath}: ${name} must be a non-negative finite number.`,
    )
  }
}

export function parseBudgetPolicyConfiguration(
  content: string,
  filePath: string,
): BudgetPolicyConfiguration {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error(`Invalid budget policy at ${filePath}: expected valid JSON.`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid budget policy at ${filePath}: expected an object.`)
  }

  if (parsed.schemaVersion !== BUDGET_POLICY_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported budget policy schemaVersion at ${filePath}. Use schemaVersion ${BUDGET_POLICY_SCHEMA_VERSION}.`,
    )
  }

  if (parsed.period !== 'calendar-month') {
    throw new Error(`Invalid budget policy at ${filePath}: period must be "calendar-month".`)
  }

  if (typeof parsed.currency !== 'string' || !/^[A-Z]{3}$/.test(parsed.currency)) {
    throw new Error(
      `Invalid budget policy at ${filePath}: currency must be a three-letter uppercase code.`,
    )
  }

  if (!isRecord(parsed.aggregateHostedCost)) {
    throw new Error(`Invalid budget policy at ${filePath}: aggregateHostedCost is required.`)
  }

  const budget = parsed.aggregateHostedCost
  const warningThreshold = budget.warningThreshold
  const hardLimit = budget.hardLimit

  if (warningThreshold === undefined && hardLimit === undefined) {
    throw new Error(
      `Invalid budget policy at ${filePath}: configure warningThreshold, hardLimit, or both.`,
    )
  }

  if (warningThreshold !== undefined) {
    assertFiniteNonNegative(warningThreshold, 'aggregateHostedCost.warningThreshold', filePath)
  }

  if (hardLimit !== undefined) {
    assertFiniteNonNegative(hardLimit, 'aggregateHostedCost.hardLimit', filePath)
  }

  if (warningThreshold !== undefined && hardLimit !== undefined && warningThreshold > hardLimit) {
    throw new Error(
      `Invalid budget policy at ${filePath}: warningThreshold cannot exceed hardLimit.`,
    )
  }

  if (
    budget.allowHardLimitOverride !== undefined &&
    typeof budget.allowHardLimitOverride !== 'boolean'
  ) {
    throw new Error(
      `Invalid budget policy at ${filePath}: aggregateHostedCost.allowHardLimitOverride must be a boolean.`,
    )
  }

  return {
    schemaVersion: BUDGET_POLICY_SCHEMA_VERSION,
    period: 'calendar-month',
    currency: parsed.currency,
    aggregateHostedCost: {
      ...(warningThreshold === undefined ? {} : { warningThreshold }),
      ...(hardLimit === undefined ? {} : { hardLimit }),
      ...(budget.allowHardLimitOverride === undefined
        ? {}
        : { allowHardLimitOverride: budget.allowHardLimitOverride }),
    },
  }
}

async function readBudgetPolicy(filePath: string): Promise<BudgetPolicyConfiguration | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined
  }

  return parseBudgetPolicyConfiguration(await readTextFile(filePath), filePath)
}

export async function loadBudgetPolicies(input: {
  projectRoot: string
  homeDir?: string
}): Promise<LoadedBudgetPolicies> {
  const [global, project] = await Promise.all([
    readBudgetPolicy(getGlobalBudgetPolicyPath(input.homeDir)),
    readBudgetPolicy(getProjectBudgetPolicyPath(input.projectRoot)),
  ])

  return {
    ...(global === undefined ? {} : { global }),
    ...(project === undefined ? {} : { project }),
  }
}

function lowerDefined(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right
  if (right === undefined) return left
  return Math.min(left, right)
}

export function resolveEffectiveHostedBudgetPolicy(
  policies: LoadedBudgetPolicies,
): EffectiveHostedBudgetPolicy | undefined {
  const configuredPolicies = [policies.global, policies.project].filter(
    (policy): policy is BudgetPolicyConfiguration => policy !== undefined,
  )

  if (configuredPolicies.length === 0) {
    return undefined
  }

  const [firstPolicy] = configuredPolicies

  if (firstPolicy === undefined) {
    return undefined
  }

  const currencies = new Set(configuredPolicies.map((policy) => policy.currency))
  if (currencies.size !== 1) {
    throw new Error(
      'Global and project budget policies must use the same currency; align the two policy files before hosted execution.',
    )
  }

  const periods = new Set(configuredPolicies.map((policy) => policy.period))
  if (periods.size !== 1) {
    throw new Error('Global and project budget policies must use the same reporting period.')
  }

  const globalBudget = policies.global?.aggregateHostedCost
  const projectBudget = policies.project?.aggregateHostedCost
  const hardLimit = lowerDefined(globalBudget?.hardLimit, projectBudget?.hardLimit)
  const configuredWarningThreshold = lowerDefined(
    globalBudget?.warningThreshold,
    projectBudget?.warningThreshold,
  )
  // Each policy is validated independently. When one layer supplies a lower hard
  // limit than another layer's warning threshold, use that stricter hard limit as
  // the warning ceiling rather than rejecting two otherwise valid policies.
  const warningThreshold =
    hardLimit === undefined
      ? configuredWarningThreshold
      : lowerDefined(configuredWarningThreshold, hardLimit)

  const hardLimitPolicies = configuredPolicies.filter(
    (policy) => policy.aggregateHostedCost.hardLimit !== undefined,
  )
  const allowHardLimitOverride =
    hardLimitPolicies.length > 0 &&
    hardLimitPolicies.every((policy) => policy.aggregateHostedCost.allowHardLimitOverride === true)

  return {
    source:
      policies.global !== undefined && policies.project !== undefined
        ? 'global-and-project'
        : policies.global !== undefined
          ? 'global'
          : 'project',
    period: firstPolicy.period,
    currency: firstPolicy.currency,
    ...(warningThreshold === undefined ? {} : { warningThreshold }),
    ...(hardLimit === undefined ? {} : { hardLimit }),
    allowHardLimitOverride,
  }
}

function getCalendarMonthPeriod(now: Date): { startedAt: Date; endsAt: Date } {
  const startedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { startedAt, endsAt }
}

function isHostedRecord(record: ExecutionLogRecord): boolean {
  return (
    record.result.status !== 'blocked' &&
    record.chosenRoute.provider !== 'local' &&
    record.chosenRoute.provider !== 'none'
  )
}

function roundCost(value: number): number {
  return Number(value.toFixed(12))
}

export function evaluateHostedBudgetPolicy(
  input: EvaluateHostedBudgetPolicyInput,
): HostedBudgetPolicyResult {
  if (!Number.isFinite(input.estimatedRequestCost) || input.estimatedRequestCost < 0) {
    throw new Error('estimatedRequestCost must be a non-negative finite number.')
  }

  const now = input.now ?? new Date()
  const period = getCalendarMonthPeriod(now)
  const policy = resolveEffectiveHostedBudgetPolicy(input.policies)

  if (policy !== undefined && input.currency !== policy.currency) {
    throw new Error(
      `Hosted request currency ${input.currency} does not match the configured budget currency ${policy.currency}.`,
    )
  }

  const currentUsage = roundCost(
    input.records
      .filter((record) => {
        const completedAt = Date.parse(record.completedAt)
        return (
          isHostedRecord(record) &&
          record.costEstimate.currency === input.currency &&
          completedAt >= period.startedAt.getTime() &&
          completedAt < period.endsAt.getTime()
        )
      })
      .reduce((total, record) => total + record.costEstimate.estimatedTotalCost, 0),
  )
  const projectedUsage = roundCost(currentUsage + input.estimatedRequestCost)
  const reasons: string[] = [
    'Hosted cost is advisory because it is derived from Friday pricing estimates, not provider billing records.',
  ]

  if (policy === undefined) {
    reasons.push(
      'No global or project budget policy is configured. Add budget-policy.json to ~/.friday or .friday before enabling hosted execution.',
    )
    return {
      schemaVersion: BUDGET_POLICY_RESULT_SCHEMA_VERSION,
      source: 'none',
      period: {
        type: 'calendar-month',
        startedAt: period.startedAt.toISOString(),
        endsAt: period.endsAt.toISOString(),
      },
      currency: input.currency,
      currentUsage,
      estimatedRequestCost: input.estimatedRequestCost,
      projectedUsage,
      status: 'unconfigured',
      warningAcknowledgementRequired: false,
      hardLimitOverrideAllowed: false,
      reasons,
    }
  }

  if (policy.hardLimit !== undefined && projectedUsage > policy.hardLimit) {
    reasons.push(
      `Projected hosted usage ${projectedUsage.toFixed(6)} ${policy.currency} exceeds the hard limit ${policy.hardLimit.toFixed(6)} ${policy.currency}.`,
    )
  } else if (policy.warningThreshold !== undefined && projectedUsage >= policy.warningThreshold) {
    reasons.push(
      `Projected hosted usage ${projectedUsage.toFixed(6)} ${policy.currency} reaches the warning threshold ${policy.warningThreshold.toFixed(6)} ${policy.currency}.`,
    )
  } else {
    reasons.push('Projected hosted usage is within the applicable aggregate budget policy.')
  }

  const status: HostedBudgetStatus =
    policy.hardLimit !== undefined && projectedUsage > policy.hardLimit
      ? 'blocked'
      : policy.warningThreshold !== undefined && projectedUsage >= policy.warningThreshold
        ? 'warning'
        : 'within'

  return {
    schemaVersion: BUDGET_POLICY_RESULT_SCHEMA_VERSION,
    source: policy.source,
    period: {
      type: policy.period,
      startedAt: period.startedAt.toISOString(),
      endsAt: period.endsAt.toISOString(),
    },
    currency: policy.currency,
    currentUsage,
    estimatedRequestCost: input.estimatedRequestCost,
    projectedUsage,
    ...(policy.hardLimit === undefined ? {} : { applicableLimit: policy.hardLimit }),
    ...(policy.hardLimit === undefined
      ? {}
      : {
          remainingAllowance: roundCost(Math.max(0, policy.hardLimit - projectedUsage)),
          ...(projectedUsage > policy.hardLimit
            ? { overage: roundCost(projectedUsage - policy.hardLimit) }
            : {}),
        }),
    status,
    warningAcknowledgementRequired: status === 'warning',
    hardLimitOverrideAllowed: status === 'blocked' && policy.allowHardLimitOverride,
    reasons,
  }
}
