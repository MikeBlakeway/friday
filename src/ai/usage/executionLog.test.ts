import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { AiUsageCostEstimate } from '../pricing/pricingModel.js'
import type { AiRoute } from '../routing/modelRouting.js'
import {
  AI_TASK_TYPES,
  MODEL_PROVIDERS,
  MODEL_TIERS,
  RECOMMENDED_MODELS,
  ROUTE_DECISIONS,
} from '../routing/modelRouting.js'
import {
  appendExecutionLogRecord,
  createExecutionLogRecord,
  EXECUTION_LOG_LATENCY_TOLERANCE_MS,
  getExecutionLogPath,
  readExecutionLogRecords,
  summariseExecutionLog,
  summariseExecutionLogRecords,
  type ExecutionLogRecord,
} from './executionLog.js'
import { createDeveloperOutcomeEvent } from './outcomeLog.js'

const tempDirs: string[] = []

const localRoute: AiRoute = {
  decision: 'use-local',
  provider: 'local',
  modelTier: 'local',
  model: 'local-coder',
  reason: 'Hosted models are disabled.',
  requiresApproval: false,
  blocked: false,
}

const premiumRoute: AiRoute = {
  decision: 'use-premium',
  provider: 'anthropic',
  modelTier: 'premium',
  model: 'claude-opus',
  reason: 'High-confidence escalation.',
  requiresApproval: true,
  blocked: false,
}

const costEstimate: AiUsageCostEstimate = {
  provider: 'local',
  model: 'local-coder',
  currency: 'USD',
  estimatedInputTokens: 10,
  estimatedOutputTokens: 20,
  estimatedTotalTokens: 30,
  estimatedInputCost: 0,
  estimatedOutputCost: 0,
  estimatedTotalCost: 0,
  advisory: true,
  basis: 'estimated-token-counts',
  warning: 'Cost estimates are advisory.',
}

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-usage-log-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

function createRecord(overrides: Partial<ExecutionLogRecord> = {}): ExecutionLogRecord {
  return createExecutionLogRecord({
    id: 'exec-1',
    workflow: {
      type: 'plan',
      artifact: '.friday/output/plan-prompt.md',
    },
    recommendedRoute: premiumRoute,
    chosenRoute: localRoute,
    provider: 'mock-local',
    model: 'mock-coder',
    startedAt: '2026-07-10T10:20:30.000Z',
    completedAt: '2026-07-10T10:20:31.250Z',
    latencyMs: 1_250,
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
    costEstimate,
    result: {
      status: 'succeeded',
      stopReason: 'complete',
      artifact: '.friday/output/executions/plan-prompt.json',
    },
    privacy: {
      privacyLevel: 'internal',
      blocked: false,
      secretDetected: false,
    },
    ...overrides,
  })
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('execution log', () => {
  it('appends structured JSONL records and reads them back deterministically', async () => {
    const projectRoot = await createTempProject()
    const firstRecord = createRecord({ id: 'exec-1' })
    const secondRecord = createRecord({
      id: 'exec-2',
      workflow: {
        type: 'review',
      },
      developerOutcome: {
        status: 'accepted',
      },
    })

    await appendExecutionLogRecord(projectRoot, firstRecord)
    await appendExecutionLogRecord(projectRoot, secondRecord)

    await expect(readExecutionLogRecords(projectRoot)).resolves.toEqual([firstRecord, secondRecord])
    await expect(readFile(getExecutionLogPath(projectRoot), 'utf8')).resolves.toBe(
      `${JSON.stringify(firstRecord)}\n${JSON.stringify(secondRecord)}\n`,
    )
  })

  it('returns an empty history when no local log exists', async () => {
    const projectRoot = await createTempProject()

    await expect(readExecutionLogRecords(projectRoot)).resolves.toEqual([])
    await expect(summariseExecutionLog(projectRoot)).resolves.toMatchObject({
      totalRecords: 0,
      byWorkflow: {},
      byProviderModel: {},
    })
  })

  it('rejects malformed JSONL with line-specific errors', async () => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(logPath, `${JSON.stringify(createRecord())}\nnot-json\n`, 'utf8')

    await expect(readExecutionLogRecords(projectRoot)).rejects.toThrow(
      'Malformed execution log record at line 2: invalid JSON.',
    )
  })

  it('rejects malformed summary fields with line-specific errors', async () => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)
    const malformedRecord = {
      ...createRecord(),
      usage: {
        outputTokens: 20,
        totalTokens: 30,
      },
    }

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(logPath, `${JSON.stringify(malformedRecord)}\n`, 'utf8')

    await expect(readExecutionLogRecords(projectRoot)).rejects.toThrow(
      'Malformed execution log record at line 1: invalid usage.inputTokens.',
    )
  })

  it('accepts every canonical routing value in execution history', async () => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)
    const records = [
      ...AI_TASK_TYPES.map((type, index) =>
        createRecord({ id: `workflow-${index}`, workflow: { type } }),
      ),
      ...ROUTE_DECISIONS.map((decision, index) =>
        createRecord({
          id: `route-decision-${index}`,
          chosenRoute: { ...premiumRoute, decision },
        }),
      ),
      ...MODEL_PROVIDERS.map((provider, index) =>
        createRecord({
          id: `route-provider-${index}`,
          chosenRoute: { ...premiumRoute, provider },
        }),
      ),
      ...MODEL_TIERS.map((modelTier, index) =>
        createRecord({
          id: `route-model-tier-${index}`,
          chosenRoute: { ...premiumRoute, modelTier },
        }),
      ),
      ...RECOMMENDED_MODELS.map((model, index) =>
        createRecord({
          id: `route-model-${index}`,
          chosenRoute: { ...premiumRoute, model },
        }),
      ),
    ]

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(
      logPath,
      `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      'utf8',
    )

    await expect(readExecutionLogRecords(projectRoot)).resolves.toEqual(records)
  })

  it.each([
    [
      'workflow.type',
      (record: ExecutionLogRecord) => ({ ...record, workflow: { type: 'unknown-workflow' } }),
    ],
    ['recommendedRoute', (record: ExecutionLogRecord) => ({ ...record, recommendedRoute: null })],
    [
      'chosenRoute.provider',
      (record: ExecutionLogRecord) => ({
        ...record,
        chosenRoute: { ...record.chosenRoute, provider: 'unsupported' },
      }),
    ],
    [
      'chosenRoute.modelTier',
      (record: ExecutionLogRecord) => ({
        ...record,
        chosenRoute: { ...record.chosenRoute, modelTier: 'hosted' },
      }),
    ],
    ['startedAt', (record: ExecutionLogRecord) => ({ ...record, startedAt: 'not-a-timestamp' })],
    ['completedAt', (record: ExecutionLogRecord) => ({ ...record, completedAt: '2026-07-10' })],
    ['latencyMs', (record: ExecutionLogRecord) => ({ ...record, latencyMs: -1 })],
    ['provider', (record: ExecutionLogRecord) => ({ ...record, provider: '' })],
    ['model', (record: ExecutionLogRecord) => ({ ...record, model: '' })],
    [
      'usage.inputTokens',
      (record: ExecutionLogRecord) => ({
        ...record,
        usage: { ...record.usage, inputTokens: -1 },
      }),
    ],
    [
      'usage.outputTokens',
      (record: ExecutionLogRecord) => ({
        ...record,
        usage: { ...record.usage, outputTokens: 1.5 },
      }),
    ],
    [
      'usage.totalTokens',
      (record: ExecutionLogRecord) => ({
        ...record,
        usage: { ...record.usage, totalTokens: 31 },
      }),
    ],
    [
      'costEstimate.estimatedTotalTokens',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, estimatedTotalTokens: 31 },
      }),
    ],
    [
      'costEstimate.currency',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, currency: 'usd' },
      }),
    ],
    [
      'costEstimate.provider',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, provider: '' },
      }),
    ],
    [
      'costEstimate.estimatedInputTokens',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, estimatedInputTokens: -1 },
      }),
    ],
    [
      'costEstimate.estimatedTotalCost',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, estimatedTotalCost: -0.1 },
      }),
    ],
    [
      'costEstimate.advisory',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, advisory: false },
      }),
    ],
    [
      'costEstimate.basis',
      (record: ExecutionLogRecord) => ({
        ...record,
        costEstimate: { ...record.costEstimate, basis: 'actual-provider-bill' },
      }),
    ],
    [
      'privacy.privacyLevel',
      (record: ExecutionLogRecord) => ({
        ...record,
        privacy: { ...record.privacy, privacyLevel: 'confidential' },
      }),
    ],
    [
      'privacy.blocked',
      (record: ExecutionLogRecord) => ({
        ...record,
        privacy: { ...record.privacy, blocked: 'false' },
      }),
    ],
    [
      'result.status',
      (record: ExecutionLogRecord) => ({
        ...record,
        result: { ...record.result, status: 'partial' },
      }),
    ],
    [
      'result.errorCode',
      (record: ExecutionLogRecord) => ({
        ...record,
        result: { ...record.result, errorCode: 500 },
      }),
    ],
    [
      'developerOutcome.status',
      (record: ExecutionLogRecord) => ({
        ...record,
        developerOutcome: { status: 'maybe' },
      }),
    ],
    [
      'providerAttempt.workflowExecutionId',
      (record: ExecutionLogRecord) => ({
        ...record,
        providerAttempt: { workflowExecutionId: '', attempt: 1, adaptiveRetry: false },
      }),
    ],
    [
      'providerAttempt.attempt',
      (record: ExecutionLogRecord) => ({
        ...record,
        providerAttempt: { workflowExecutionId: 'workflow-1', attempt: 0, adaptiveRetry: false },
      }),
    ],
    [
      'providerAttempt.adaptiveRetry',
      (record: ExecutionLogRecord) => ({
        ...record,
        providerAttempt: { workflowExecutionId: 'workflow-1', attempt: 1, adaptiveRetry: 'no' },
      }),
    ],
    [
      'budgetOverride.recordedAt',
      (record: ExecutionLogRecord) => ({
        ...record,
        budgetOverride: {
          schemaVersion: 1,
          reason: 'hard-limit',
          recordedAt: 'not-a-timestamp',
        },
      }),
    ],
    [
      'budgetOverride.reason',
      (record: ExecutionLogRecord) => ({
        ...record,
        budgetOverride: {
          schemaVersion: 1,
          reason: 'automatic',
          recordedAt: '2026-07-14T10:00:00.000Z',
        },
      }),
    ],
  ])('rejects invalid %s with an exact line and field', async (fieldName, mutateRecord) => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)
    const malformedRecord = mutateRecord(createRecord())

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(logPath, `${JSON.stringify(malformedRecord)}\n`, 'utf8')

    await expect(readExecutionLogRecords(projectRoot)).rejects.toThrow(
      `Malformed execution log record at line 1: invalid ${fieldName}.`,
    )
  })

  it('rejects a non-finite JSON number before usage or budget evaluation', async () => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)
    const nonFiniteJson = JSON.stringify(createRecord()).replace(
      '"latencyMs":1250',
      '"latencyMs":1e999',
    )

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(logPath, `${nonFiniteJson}\n`, 'utf8')

    await expect(readExecutionLogRecords(projectRoot)).rejects.toThrow(
      'Malformed execution log record at line 1: invalid latencyMs.',
    )
  })

  it.each([
    [
      'completedAt',
      (record: ExecutionLogRecord) => ({
        ...record,
        completedAt: '2026-07-10T10:20:29.999Z',
      }),
    ],
    [
      'latencyMs',
      (record: ExecutionLogRecord) => ({
        ...record,
        latencyMs: 1_250 + EXECUTION_LOG_LATENCY_TOLERANCE_MS + 1,
      }),
    ],
  ])(
    'rejects temporally inconsistent %s with an exact line and field',
    async (fieldName, mutateRecord) => {
      const projectRoot = await createTempProject()
      const logPath = getExecutionLogPath(projectRoot)

      await mkdir(path.dirname(logPath), { recursive: true })
      await writeFile(logPath, `${JSON.stringify(mutateRecord(createRecord()))}\n`, 'utf8')

      await expect(readExecutionLogRecords(projectRoot)).rejects.toThrow(
        `Malformed execution log record at line 1: invalid ${fieldName}.`,
      )
    },
  )

  it('accepts latency within the documented timestamp-precision tolerance', async () => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)
    const record = createRecord({
      latencyMs: 1_250 + EXECUTION_LOG_LATENCY_TOLERANCE_MS,
    })

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(logPath, `${JSON.stringify(record)}\n`, 'utf8')

    await expect(readExecutionLogRecords(projectRoot)).resolves.toEqual([record])
  })

  it('documents schema-version migration through a specific repair error', async () => {
    const projectRoot = await createTempProject()
    const logPath = getExecutionLogPath(projectRoot)
    const legacyRecord = { ...createRecord(), schemaVersion: 0 }

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(logPath, `${JSON.stringify(legacyRecord)}\n`, 'utf8')

    await expect(readExecutionLogRecords(projectRoot)).rejects.toThrow(
      'Malformed execution log record at line 1: unsupported schemaVersion; use schemaVersion 1.',
    )
  })

  it('drops raw prompts, secret values, and non-schema fields before writing', async () => {
    const projectRoot = await createTempProject()
    const record = {
      ...createRecord({
        privacy: {
          privacyLevel: 'secret',
          blocked: true,
          secretDetected: true,
        },
      }),
      rawPrompt: 'Use OPENAI_API_KEY=sk-secret-value in the prompt.',
      detectedSecrets: ['OPENAI_API_KEY=sk-secret-value'],
    } as ExecutionLogRecord

    await appendExecutionLogRecord(projectRoot, record)

    const rawLog = await readFile(getExecutionLogPath(projectRoot), 'utf8')
    expect(rawLog).not.toContain('rawPrompt')
    expect(rawLog).not.toContain('detectedSecrets')
    expect(rawLog).not.toContain('sk-secret-value')
    await expect(readExecutionLogRecords(projectRoot)).resolves.toMatchObject([
      {
        privacy: {
          privacyLevel: 'secret',
          blocked: true,
          secretDetected: true,
        },
      },
    ])
  })

  it('records a structured budget override without storing prompt or secret content', async () => {
    const projectRoot = await createTempProject()
    const record = createRecord({
      budgetOverride: {
        schemaVersion: 1,
        reason: 'hard-limit',
        recordedAt: '2026-07-14T10:00:00.000Z',
      },
    })

    await appendExecutionLogRecord(projectRoot, record)

    await expect(readExecutionLogRecords(projectRoot)).resolves.toEqual([record])
    await expect(readFile(getExecutionLogPath(projectRoot), 'utf8')).resolves.not.toContain(
      'OPENAI_API_KEY',
    )
  })

  it('keeps existing records readable as one workflow run and one provider attempt', () => {
    const summary = summariseExecutionLogRecords([createRecord()])

    expect(summary.workflowRuns).toBe(1)
    expect(summary.providerAttempts).toBe(1)
    expect(summary.adaptiveRetries).toBe(0)
  })

  it('summarises workflow runs, provider attempts, adaptive retries, and developer outcomes', () => {
    const summary = summariseExecutionLogRecords([
      createRecord({
        id: 'exec-1',
        workflow: {
          type: 'plan',
        },
        provider: 'mock-local',
        model: 'mock-coder',
        developerOutcome: {
          status: 'retried',
        },
      }),
      createRecord({
        id: 'exec-2',
        workflow: {
          type: 'review',
        },
        provider: 'anthropic',
        model: 'claude-opus',
        chosenRoute: premiumRoute,
        result: {
          status: 'failed',
          errorCode: 'provider-error',
        },
        developerOutcome: {
          status: 'escalated',
        },
      }),
      createRecord({
        id: 'exec-3',
        workflow: {
          type: 'plan',
        },
        result: {
          status: 'blocked',
        },
      }),
    ])

    expect(summary).toEqual({
      totalRecords: 3,
      workflowRuns: 3,
      providerAttempts: 3,
      byWorkflow: {
        plan: 2,
        review: 1,
      },
      byProviderModel: {
        'mock-local/mock-coder': 2,
        'anthropic/claude-opus': 1,
      },
      byResultStatus: {
        succeeded: 1,
        failed: 1,
        blocked: 1,
      },
      tokenUsage: {
        inputTokens: 30,
        outputTokens: 60,
        totalTokens: 90,
      },
      advisoryCostByCurrency: {
        USD: 0,
      },
      adaptiveRetries: 0,
      developerOutcomes: {
        accepted: 0,
        retried: 1,
        escalated: 1,
        rejected: 0,
      },
    })
  })

  it('groups adaptive attempts under one workflow run without treating developer outcomes as retries', () => {
    const summary = summariseExecutionLogRecords([
      createRecord({
        id: 'attempt-1',
        result: { status: 'failed', errorCode: 'output-limit-exhausted' },
        providerAttempt: {
          workflowExecutionId: 'workflow-1',
          attempt: 1,
          adaptiveRetry: false,
        },
      }),
      createRecord({
        id: 'attempt-2',
        developerOutcome: { status: 'retried' },
        providerAttempt: {
          workflowExecutionId: 'workflow-1',
          attempt: 2,
          adaptiveRetry: true,
        },
      }),
    ])

    expect(summary.workflowRuns).toBe(1)
    expect(summary.providerAttempts).toBe(2)
    expect(summary.adaptiveRetries).toBe(1)
    expect(summary.developerOutcomes.retried).toBe(1)
  })

  it('counts only the latest append-only outcome for each execution', () => {
    const summary = summariseExecutionLogRecords(
      [createRecord({ id: 'exec-1' }), createRecord({ id: 'exec-2' })],
      [
        createDeveloperOutcomeEvent({
          id: 'outcome-1',
          executionId: 'exec-1',
          status: 'retried',
          recordedAt: '2026-07-14T09:00:00.000Z',
        }),
        createDeveloperOutcomeEvent({
          id: 'outcome-2',
          executionId: 'exec-1',
          status: 'accepted',
          recordedAt: '2026-07-14T09:05:00.000Z',
        }),
        createDeveloperOutcomeEvent({
          id: 'outcome-3',
          executionId: 'missing',
          status: 'rejected',
          recordedAt: '2026-07-14T09:10:00.000Z',
        }),
      ],
    )

    expect(summary.developerOutcomes).toEqual({
      accepted: 1,
      retried: 0,
      escalated: 0,
      rejected: 0,
    })
  })
})
