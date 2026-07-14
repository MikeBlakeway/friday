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

function assertObject(
  value: unknown,
  lineNumber: number,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Malformed execution log record at line ${lineNumber}: expected object.`)
  }
}

function assertSchemaVersion(record: Record<string, unknown>, lineNumber: number): void {
  if (record.schemaVersion !== EXECUTION_LOG_SCHEMA_VERSION) {
    throw new Error(
      `Malformed execution log record at line ${lineNumber}: unsupported schemaVersion.`,
    )
  }
}

function assertRequiredString(
  record: Record<string, unknown>,
  fieldName: string,
  lineNumber: number,
): void {
  if (typeof record[fieldName] !== 'string') {
    throw new Error(
      `Malformed execution log record at line ${lineNumber}: missing required fields.`,
    )
  }
}

function assertRequiredNumber(
  record: Record<string, unknown>,
  fieldName: string,
  lineNumber: number,
): void {
  if (typeof record[fieldName] !== 'number') {
    throw new Error(
      `Malformed execution log record at line ${lineNumber}: missing required fields.`,
    )
  }
}

function assertNestedRecord(
  record: Record<string, unknown>,
  fieldName: string,
  lineNumber: number,
): Record<string, unknown> {
  const value = record[fieldName]

  if (!isRecord(value)) {
    throw new Error(
      `Malformed execution log record at line ${lineNumber}: missing required fields.`,
    )
  }

  return value
}

function assertAllowedString(
  record: Record<string, unknown>,
  fieldName: string,
  allowed: readonly string[],
  lineNumber: number,
): void {
  if (typeof record[fieldName] !== 'string' || !allowed.includes(record[fieldName])) {
    throw new Error(`Malformed execution log record at line ${lineNumber}: invalid ${fieldName}.`)
  }
}

function assertExecutionLogRecord(
  value: unknown,
  lineNumber: number,
): asserts value is ExecutionLogRecord {
  assertObject(value, lineNumber)
  assertSchemaVersion(value, lineNumber)
  assertRequiredString(value, 'id', lineNumber)
  assertRequiredString(value, 'provider', lineNumber)
  assertRequiredString(value, 'model', lineNumber)
  assertRequiredString(value, 'startedAt', lineNumber)
  assertRequiredString(value, 'completedAt', lineNumber)
  assertRequiredNumber(value, 'latencyMs', lineNumber)
  assertRequiredString(assertNestedRecord(value, 'workflow', lineNumber), 'type', lineNumber)
  const usage = assertNestedRecord(value, 'usage', lineNumber)
  assertRequiredNumber(usage, 'inputTokens', lineNumber)
  assertRequiredNumber(usage, 'outputTokens', lineNumber)
  assertRequiredNumber(usage, 'totalTokens', lineNumber)
  const costEstimate = assertNestedRecord(value, 'costEstimate', lineNumber)
  assertRequiredString(costEstimate, 'currency', lineNumber)
  assertRequiredNumber(costEstimate, 'estimatedTotalCost', lineNumber)
  assertAllowedString(
    assertNestedRecord(value, 'result', lineNumber),
    'status',
    ['succeeded', 'failed', 'blocked'],
    lineNumber,
  )
  assertRequiredString(assertNestedRecord(value, 'privacy', lineNumber), 'privacyLevel', lineNumber)

  if (value.developerOutcome !== undefined) {
    assertAllowedString(
      assertNestedRecord(value, 'developerOutcome', lineNumber),
      'status',
      ['accepted', 'retried', 'escalated', 'rejected'],
      lineNumber,
    )
  }

  if (value.budgetOverride !== undefined) {
    const budgetOverride = assertNestedRecord(value, 'budgetOverride', lineNumber)
    if (budgetOverride.schemaVersion !== BUDGET_OVERRIDE_SCHEMA_VERSION) {
      throw new Error(
        `Malformed execution log record at line ${lineNumber}: invalid budgetOverride.`,
      )
    }
    assertAllowedString(
      budgetOverride,
      'reason',
      ['warning-acknowledged', 'hard-limit'],
      lineNumber,
    )
    assertRequiredString(budgetOverride, 'recordedAt', lineNumber)
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
