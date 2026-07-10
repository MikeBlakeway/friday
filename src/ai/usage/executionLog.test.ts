import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { AiUsageCostEstimate } from '../pricing/pricingModel.js'
import type { AiRoute } from '../routing/modelRouting.js'
import {
  appendExecutionLogRecord,
  createExecutionLogRecord,
  getExecutionLogPath,
  readExecutionLogRecords,
  summariseExecutionLog,
  summariseExecutionLogRecords,
  type ExecutionLogRecord,
} from './executionLog.js'

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

  it('summarises workflows, provider/models, retries, and escalations', () => {
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
      retried: 1,
      escalated: 1,
      developerOutcomes: {
        accepted: 0,
        retried: 1,
        escalated: 1,
        rejected: 0,
      },
    })
  })
})
