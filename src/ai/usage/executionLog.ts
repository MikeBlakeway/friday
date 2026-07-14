import path from 'node:path'

import { appendTextFile, ensureDir, pathExists, readTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import type { AiUsageCostEstimate } from '../pricing/pricingModel.js'
import type { PrivacyLevel } from '../routing/modelRouting.js'
import type { AiRoute } from '../routing/modelRouting.js'
import type { DeveloperOutcomeEvent } from './outcomeLog.js'
import {
  BUDGET_OVERRIDE_SCHEMA_VERSION,
  type BudgetOverrideRecord,
} from '../budget/hostedPreflight.js'

export const EXECUTION_LOG_SCHEMA_VERSION = 1
export const FRIDAY_RUNTIME_DIR = 'runtime'
export const FRIDAY_EXECUTION_LOG_FILE = 'execution-log.jsonl'

export type DeveloperOutcomeStatus = 'accepted' | 'retried' | 'escalated' | 'rejected'
export type ExecutionResultStatus = 'succeeded' | 'failed' | 'blocked'

export interface ExecutionLogWorkflow {
  type: string
  artifact?: string
}

export interface ExecutionLogPrivacy {
  privacyLevel: PrivacyLevel
  blocked: boolean
  secretDetected: boolean
}

export interface ExecutionLogTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ExecutionLogCostEstimate extends Pick<
  AiUsageCostEstimate,
  | 'provider'
  | 'model'
  | 'currency'
  | 'estimatedInputTokens'
  | 'estimatedOutputTokens'
  | 'estimatedTotalTokens'
  | 'estimatedTotalCost'
  | 'advisory'
  | 'basis'
> {}

export interface DeveloperOutcome {
  status: DeveloperOutcomeStatus
  note?: string
}

export interface ExecutionLogRecord {
  schemaVersion: typeof EXECUTION_LOG_SCHEMA_VERSION
  id: string
  workflow: ExecutionLogWorkflow
  recommendedRoute: AiRoute
  chosenRoute: AiRoute
  provider: string
  model: string
  startedAt: string
  completedAt: string
  latencyMs: number
  usage: ExecutionLogTokenUsage
  costEstimate: ExecutionLogCostEstimate
  result: {
    status: ExecutionResultStatus
    stopReason?: string
    artifact?: string
    errorCode?: string
  }
  privacy: ExecutionLogPrivacy
  developerOutcome?: DeveloperOutcome
  budgetOverride?: BudgetOverrideRecord
}

export interface ExecutionLogSummary {
  totalRecords: number
  byWorkflow: Record<string, number>
  byProviderModel: Record<string, number>
  byResultStatus: Record<ExecutionResultStatus, number>
  tokenUsage: ExecutionLogTokenUsage
  advisoryCostByCurrency: Record<string, number>
  retried: number
  escalated: number
  developerOutcomes: Record<DeveloperOutcomeStatus, number>
}

export interface CreateExecutionLogRecordInput extends Omit<
  ExecutionLogRecord,
  'schemaVersion' | 'costEstimate' | 'developerOutcome'
> {
  costEstimate: AiUsageCostEstimate | ExecutionLogCostEstimate
  developerOutcome?: DeveloperOutcome
}

export function getExecutionLogPath(projectRoot: string): string {
  return path.join(projectRoot, FRIDAY_PROJECT_DIR, FRIDAY_RUNTIME_DIR, FRIDAY_EXECUTION_LOG_FILE)
}

function pickOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function createCostEstimateLog(
  costEstimate: AiUsageCostEstimate | ExecutionLogCostEstimate,
): ExecutionLogCostEstimate {
  return {
    provider: costEstimate.provider,
    model: costEstimate.model,
    currency: costEstimate.currency,
    estimatedInputTokens: costEstimate.estimatedInputTokens,
    estimatedOutputTokens: costEstimate.estimatedOutputTokens,
    estimatedTotalTokens: costEstimate.estimatedTotalTokens,
    estimatedTotalCost: costEstimate.estimatedTotalCost,
    advisory: costEstimate.advisory,
    basis: costEstimate.basis,
  }
}

function sanitizeDeveloperOutcome(
  outcome: ExecutionLogRecord['developerOutcome'],
): DeveloperOutcome | undefined {
  if (outcome === undefined) {
    return undefined
  }

  return {
    status: outcome.status,
    ...(outcome.note === undefined ? {} : { note: outcome.note }),
  }
}

function sanitizeBudgetOverride(
  override: ExecutionLogRecord['budgetOverride'],
): BudgetOverrideRecord | undefined {
  if (override === undefined) {
    return undefined
  }

  return {
    schemaVersion: BUDGET_OVERRIDE_SCHEMA_VERSION,
    reason: override.reason,
    recordedAt: override.recordedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createExecutionLogRecord(input: CreateExecutionLogRecordInput): ExecutionLogRecord {
  const workflowArtifact = pickOptionalString(input.workflow.artifact)
  const resultStopReason = pickOptionalString(input.result.stopReason)
  const resultArtifact = pickOptionalString(input.result.artifact)
  const resultErrorCode = pickOptionalString(input.result.errorCode)
  const developerOutcome = sanitizeDeveloperOutcome(input.developerOutcome)
  const budgetOverride = sanitizeBudgetOverride(input.budgetOverride)
  const record: ExecutionLogRecord = {
    schemaVersion: EXECUTION_LOG_SCHEMA_VERSION,
    id: input.id,
    workflow: {
      type: input.workflow.type,
    },
    recommendedRoute: input.recommendedRoute,
    chosenRoute: input.chosenRoute,
    provider: input.provider,
    model: input.model,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    latencyMs: input.latencyMs,
    usage: {
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      totalTokens: input.usage.totalTokens,
    },
    costEstimate: createCostEstimateLog(input.costEstimate),
    result: {
      status: input.result.status,
    },
    privacy: {
      privacyLevel: input.privacy.privacyLevel,
      blocked: input.privacy.blocked,
      secretDetected: input.privacy.secretDetected,
    },
  }

  if (workflowArtifact !== undefined) {
    record.workflow.artifact = workflowArtifact
  }

  if (resultStopReason !== undefined) {
    record.result.stopReason = resultStopReason
  }

  if (resultArtifact !== undefined) {
    record.result.artifact = resultArtifact
  }

  if (resultErrorCode !== undefined) {
    record.result.errorCode = resultErrorCode
  }

  if (developerOutcome !== undefined) {
    record.developerOutcome = developerOutcome
  }

  if (budgetOverride !== undefined) {
    record.budgetOverride = budgetOverride
  }

  return record
}

const WORKFLOW_TYPES = [
  'brainstorm',
  'plan',
  'spec',
  'design',
  'build',
  'review',
  'refactor',
  'test',
  'ship',
  'ask',
  'escalate',
] as const
const ROUTE_DECISIONS = [
  'no-ai-required',
  'use-local',
  'use-cheap-hosted',
  'use-strong-hosted',
  'use-premium',
  'blocked',
] as const
const ROUTE_PROVIDERS = ['none', 'local', 'deepseek', 'openai', 'anthropic'] as const
const ROUTE_MODEL_TIERS = ['none', 'local', 'cheap-hosted', 'strong-hosted', 'premium'] as const
const ROUTE_MODELS = [
  'none',
  'local-coder',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'gpt-5',
  'gpt-5.5',
  'claude-opus',
] as const
const PRIVACY_LEVELS = ['public', 'internal', 'private-repo', 'sensitive', 'secret'] as const
const RESULT_STATUSES = ['succeeded', 'failed', 'blocked'] as const
const DEVELOPER_OUTCOME_STATUSES = ['accepted', 'retried', 'escalated', 'rejected'] as const
const BUDGET_OVERRIDE_REASONS = ['warning-acknowledged', 'hard-limit'] as const
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function invalidField(lineNumber: number, fieldName: string): never {
  throw new Error(`Malformed execution log record at line ${lineNumber}: invalid ${fieldName}.`)
}

function assertRecord(
  value: unknown,
  fieldName: string,
  lineNumber: number,
): Record<string, unknown> {
  if (!isRecord(value)) {
    invalidField(lineNumber, fieldName)
  }

  return value
}

function assertNonEmptyString(value: unknown, fieldName: string, lineNumber: number): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalidField(lineNumber, fieldName)
  }
}

function assertOptionalNonEmptyString(value: unknown, fieldName: string, lineNumber: number): void {
  if (value !== undefined) {
    assertNonEmptyString(value, fieldName, lineNumber)
  }
}

function assertAllowedValue(
  value: unknown,
  fieldName: string,
  allowed: readonly string[],
  lineNumber: number,
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    invalidField(lineNumber, fieldName)
  }
}

function assertBoolean(value: unknown, fieldName: string, lineNumber: number): void {
  if (typeof value !== 'boolean') {
    invalidField(lineNumber, fieldName)
  }
}

function assertFiniteNonNegativeNumber(
  value: unknown,
  fieldName: string,
  lineNumber: number,
  integer = false,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isInteger(value))
  ) {
    invalidField(lineNumber, fieldName)
  }
}

function assertIsoTimestamp(value: unknown, fieldName: string, lineNumber: number): void {
  if (
    typeof value !== 'string' ||
    !ISO_TIMESTAMP.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    invalidField(lineNumber, fieldName)
  }
}

function assertRoute(value: unknown, fieldName: string, lineNumber: number): void {
  const route = assertRecord(value, fieldName, lineNumber)
  assertAllowedValue(route.decision, `${fieldName}.decision`, ROUTE_DECISIONS, lineNumber)
  assertAllowedValue(route.provider, `${fieldName}.provider`, ROUTE_PROVIDERS, lineNumber)
  assertAllowedValue(route.modelTier, `${fieldName}.modelTier`, ROUTE_MODEL_TIERS, lineNumber)
  assertAllowedValue(route.model, `${fieldName}.model`, ROUTE_MODELS, lineNumber)
  assertNonEmptyString(route.reason, `${fieldName}.reason`, lineNumber)
  assertBoolean(route.requiresApproval, `${fieldName}.requiresApproval`, lineNumber)
  assertBoolean(route.blocked, `${fieldName}.blocked`, lineNumber)
}

function assertTokenUsage(value: unknown, fieldName: string, lineNumber: number): void {
  const usage = assertRecord(value, fieldName, lineNumber)
  const inputTokens = usage.inputTokens
  const outputTokens = usage.outputTokens
  const totalTokens = usage.totalTokens
  assertFiniteNonNegativeNumber(inputTokens, `${fieldName}.inputTokens`, lineNumber, true)
  assertFiniteNonNegativeNumber(outputTokens, `${fieldName}.outputTokens`, lineNumber, true)
  assertFiniteNonNegativeNumber(totalTokens, `${fieldName}.totalTokens`, lineNumber, true)

  if (totalTokens !== inputTokens + outputTokens) {
    invalidField(lineNumber, `${fieldName}.totalTokens`)
  }
}

function assertCostEstimate(value: unknown, lineNumber: number): void {
  const costEstimate = assertRecord(value, 'costEstimate', lineNumber)
  assertNonEmptyString(costEstimate.provider, 'costEstimate.provider', lineNumber)
  assertNonEmptyString(costEstimate.model, 'costEstimate.model', lineNumber)

  if (typeof costEstimate.currency !== 'string' || !/^[A-Z]{3}$/.test(costEstimate.currency)) {
    invalidField(lineNumber, 'costEstimate.currency')
  }

  const estimatedInputTokens = costEstimate.estimatedInputTokens
  const estimatedOutputTokens = costEstimate.estimatedOutputTokens
  const estimatedTotalTokens = costEstimate.estimatedTotalTokens
  assertFiniteNonNegativeNumber(
    estimatedInputTokens,
    'costEstimate.estimatedInputTokens',
    lineNumber,
    true,
  )
  assertFiniteNonNegativeNumber(
    estimatedOutputTokens,
    'costEstimate.estimatedOutputTokens',
    lineNumber,
    true,
  )
  assertFiniteNonNegativeNumber(
    estimatedTotalTokens,
    'costEstimate.estimatedTotalTokens',
    lineNumber,
    true,
  )
  assertFiniteNonNegativeNumber(
    costEstimate.estimatedTotalCost,
    'costEstimate.estimatedTotalCost',
    lineNumber,
  )
  assertBoolean(costEstimate.advisory, 'costEstimate.advisory', lineNumber)

  if (costEstimate.advisory !== true) {
    invalidField(lineNumber, 'costEstimate.advisory')
  }

  assertAllowedValue(
    costEstimate.basis,
    'costEstimate.basis',
    ['estimated-token-counts'],
    lineNumber,
  )

  if (estimatedTotalTokens !== estimatedInputTokens + estimatedOutputTokens) {
    invalidField(lineNumber, 'costEstimate.estimatedTotalTokens')
  }
}

function assertExecutionLogRecord(
  value: unknown,
  lineNumber: number,
): asserts value is ExecutionLogRecord {
  const record = assertRecord(value, 'record', lineNumber)

  if (record.schemaVersion !== EXECUTION_LOG_SCHEMA_VERSION) {
    throw new Error(
      `Malformed execution log record at line ${lineNumber}: unsupported schemaVersion; use schemaVersion ${EXECUTION_LOG_SCHEMA_VERSION}.`,
    )
  }

  assertNonEmptyString(record.id, 'id', lineNumber)
  const workflow = assertRecord(record.workflow, 'workflow', lineNumber)
  assertAllowedValue(workflow.type, 'workflow.type', WORKFLOW_TYPES, lineNumber)
  assertOptionalNonEmptyString(workflow.artifact, 'workflow.artifact', lineNumber)
  assertRoute(record.recommendedRoute, 'recommendedRoute', lineNumber)
  assertRoute(record.chosenRoute, 'chosenRoute', lineNumber)
  assertNonEmptyString(record.provider, 'provider', lineNumber)
  assertNonEmptyString(record.model, 'model', lineNumber)
  assertIsoTimestamp(record.startedAt, 'startedAt', lineNumber)
  assertIsoTimestamp(record.completedAt, 'completedAt', lineNumber)
  assertFiniteNonNegativeNumber(record.latencyMs, 'latencyMs', lineNumber)
  assertTokenUsage(record.usage, 'usage', lineNumber)
  assertCostEstimate(record.costEstimate, lineNumber)

  const result = assertRecord(record.result, 'result', lineNumber)
  assertAllowedValue(result.status, 'result.status', RESULT_STATUSES, lineNumber)
  assertOptionalNonEmptyString(result.stopReason, 'result.stopReason', lineNumber)
  assertOptionalNonEmptyString(result.artifact, 'result.artifact', lineNumber)
  assertOptionalNonEmptyString(result.errorCode, 'result.errorCode', lineNumber)

  const privacy = assertRecord(record.privacy, 'privacy', lineNumber)
  assertAllowedValue(privacy.privacyLevel, 'privacy.privacyLevel', PRIVACY_LEVELS, lineNumber)
  assertBoolean(privacy.blocked, 'privacy.blocked', lineNumber)
  assertBoolean(privacy.secretDetected, 'privacy.secretDetected', lineNumber)

  if (record.developerOutcome !== undefined) {
    const outcome = assertRecord(record.developerOutcome, 'developerOutcome', lineNumber)
    assertAllowedValue(
      outcome.status,
      'developerOutcome.status',
      DEVELOPER_OUTCOME_STATUSES,
      lineNumber,
    )
    assertOptionalNonEmptyString(outcome.note, 'developerOutcome.note', lineNumber)
  }

  if (record.budgetOverride !== undefined) {
    const budgetOverride = assertRecord(record.budgetOverride, 'budgetOverride', lineNumber)
    if (budgetOverride.schemaVersion !== BUDGET_OVERRIDE_SCHEMA_VERSION) {
      invalidField(lineNumber, 'budgetOverride.schemaVersion')
    }
    assertAllowedValue(
      budgetOverride.reason,
      'budgetOverride.reason',
      BUDGET_OVERRIDE_REASONS,
      lineNumber,
    )
    assertIsoTimestamp(budgetOverride.recordedAt, 'budgetOverride.recordedAt', lineNumber)
  }
}

export async function appendExecutionLogRecord(
  projectRoot: string,
  record: ExecutionLogRecord,
): Promise<void> {
  const logPath = getExecutionLogPath(projectRoot)

  await ensureDir(path.dirname(logPath))
  await appendTextFile(logPath, `${JSON.stringify(createExecutionLogRecord(record))}\n`)
}

export async function readExecutionLogRecords(projectRoot: string): Promise<ExecutionLogRecord[]> {
  const logPath = getExecutionLogPath(projectRoot)

  if (!(await pathExists(logPath))) {
    return []
  }

  const content = await readTextFile(logPath)
  const records: ExecutionLogRecord[] = []

  content.split('\n').forEach((line, index) => {
    if (line.trim().length === 0) {
      return
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`Malformed execution log record at line ${index + 1}: invalid JSON.`)
    }

    assertExecutionLogRecord(parsed, index + 1)
    records.push(parsed)
  })

  return records
}

function createEmptySummary(): ExecutionLogSummary {
  return {
    totalRecords: 0,
    byWorkflow: {},
    byProviderModel: {},
    byResultStatus: {
      succeeded: 0,
      failed: 0,
      blocked: 0,
    },
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    advisoryCostByCurrency: {},
    retried: 0,
    escalated: 0,
    developerOutcomes: {
      accepted: 0,
      retried: 0,
      escalated: 0,
      rejected: 0,
    },
  }
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1
}

export function summariseExecutionLogRecords(
  records: ExecutionLogRecord[],
  outcomeEvents: DeveloperOutcomeEvent[] = [],
): ExecutionLogSummary {
  const summary = createEmptySummary()
  const effectiveOutcomes = new Map<string, DeveloperOutcomeStatus>()

  records.forEach((record) => {
    if (record.developerOutcome !== undefined) {
      effectiveOutcomes.set(record.id, record.developerOutcome.status)
    }
  })

  outcomeEvents.forEach((event) => {
    effectiveOutcomes.set(event.executionId, event.status)
  })

  records.forEach((record) => {
    summary.totalRecords += 1
    increment(summary.byWorkflow, record.workflow.type)
    increment(summary.byProviderModel, `${record.provider}/${record.model}`)
    summary.byResultStatus[record.result.status] += 1
    summary.tokenUsage.inputTokens += record.usage.inputTokens
    summary.tokenUsage.outputTokens += record.usage.outputTokens
    summary.tokenUsage.totalTokens += record.usage.totalTokens
    summary.advisoryCostByCurrency[record.costEstimate.currency] =
      (summary.advisoryCostByCurrency[record.costEstimate.currency] ?? 0) +
      record.costEstimate.estimatedTotalCost
  })

  const countedExecutionIds = new Set<string>()

  records.forEach((record) => {
    if (countedExecutionIds.has(record.id)) {
      return
    }

    countedExecutionIds.add(record.id)
    const status = effectiveOutcomes.get(record.id)

    if (status === undefined) {
      return
    }

    summary.developerOutcomes[status] += 1

    if (status === 'retried') {
      summary.retried += 1
    }

    if (status === 'escalated') {
      summary.escalated += 1
    }
  })

  return summary
}

export async function summariseExecutionLog(projectRoot: string): Promise<ExecutionLogSummary> {
  return summariseExecutionLogRecords(await readExecutionLogRecords(projectRoot))
}
