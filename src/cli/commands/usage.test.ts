import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  appendExecutionLogRecord,
  createExecutionLogRecord,
  type ExecutionLogRecord,
} from '../../ai/usage/executionLog.js'
import type { AiRoute } from '../../ai/routing/modelRouting.js'
import {
  appendDeveloperOutcomeEvent,
  createDeveloperOutcomeEvent,
} from '../../ai/usage/outcomeLog.js'
import { runUsageCommand } from './usage.js'

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

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-usage-command-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

function createRecord(overrides: Partial<ExecutionLogRecord> = {}): ExecutionLogRecord {
  return createExecutionLogRecord({
    id: 'exec-1',
    workflow: { type: 'plan' },
    recommendedRoute: localRoute,
    chosenRoute: localRoute,
    provider: 'lm-studio',
    model: 'local-coder',
    startedAt: '2026-07-12T10:00:00.000Z',
    completedAt: '2026-07-12T10:00:01.000Z',
    latencyMs: 1_000,
    usage: {
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
    },
    costEstimate: {
      provider: 'lm-studio',
      model: 'local-coder',
      currency: 'USD',
      estimatedInputTokens: 100,
      estimatedOutputTokens: 25,
      estimatedTotalTokens: 125,
      estimatedTotalCost: 0,
      advisory: true,
      basis: 'estimated-token-counts',
    },
    result: { status: 'succeeded' },
    privacy: {
      privacyLevel: 'internal',
      blocked: false,
      secretDetected: false,
    },
    ...overrides,
  })
}

async function captureUsageOutput(options: {
  projectRoot: string
  args?: string[]
  now?: Date
  homeDir?: string
}): Promise<string> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

  try {
    await runUsageCommand({
      projectRoot: options.projectRoot,
      args: options.args ?? [],
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
    })
    return log.mock.calls.map((call) => call.join(' ')).join('\n')
  } finally {
    log.mockRestore()
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('runUsageCommand', () => {
  it('prints a clear empty state when no execution log exists', async () => {
    const projectRoot = await createTempProject()

    await expect(captureUsageOutput({ projectRoot })).resolves.toContain(
      'No local execution history found.',
    )
  })

  it('distinguishes provider attempts and adaptive retries from developer retry outcomes', async () => {
    const projectRoot = await createTempProject()

    await appendExecutionLogRecord(projectRoot, createRecord())
    await appendExecutionLogRecord(
      projectRoot,
      createRecord({
        id: 'exec-2',
        workflow: { type: 'review' },
        provider: 'anthropic',
        model: 'claude-opus',
        usage: {
          inputTokens: 200,
          outputTokens: 50,
          totalTokens: 250,
        },
        costEstimate: {
          ...createRecord().costEstimate,
          provider: 'anthropic',
          model: 'claude-opus',
          estimatedTotalCost: 0.125,
        },
        result: { status: 'failed', errorCode: 'provider-error' },
        developerOutcome: {
          status: 'retried',
          note: 'PRIVATE-SNIPPET-that-must-not-be-displayed',
        },
      }),
    )
    await appendDeveloperOutcomeEvent(
      projectRoot,
      createDeveloperOutcomeEvent({
        id: 'outcome-1',
        executionId: 'exec-1',
        status: 'accepted',
        recordedAt: '2026-07-14T10:00:00.000Z',
      }),
    )

    const output = await captureUsageOutput({ projectRoot })

    expect(output).toContain('Workflow runs: 2')
    expect(output).toContain('Provider attempts: 2')
    expect(output).toContain('Successful attempts: 1')
    expect(output).toContain('Failed attempts: 1')
    expect(output).toContain('Recorded input tokens: 300')
    expect(output).toContain('Recorded output tokens: 75')
    expect(output).toContain('Recorded total tokens: 375')
    expect(output).toContain('Advisory total cost: 0.125000 USD')
    expect(output).toContain('Adaptive provider retries: 0')
    expect(output).toContain(
      'Developer-recorded outcomes:\n  accepted: 1\n  escalated: 0\n  rejected: 0\n  retried: 1',
    )
    expect(output).toContain('Provider attempts by workflow:\n  plan: 1\n  review: 1')
    expect(output).toContain('Provider attempts by provider/model:')
    expect(output).toContain('  anthropic/claude-opus: 1')
    expect(output).not.toContain('provider-error')
    expect(output).not.toContain('PRIVATE-SNIPPET')
  })

  it('filters history by duration using completion timestamps', async () => {
    const projectRoot = await createTempProject()
    const now = new Date('2026-07-13T12:00:00.000Z')

    await appendExecutionLogRecord(
      projectRoot,
      createRecord({
        id: 'old',
        startedAt: '2026-07-11T11:59:59.000Z',
        completedAt: '2026-07-11T12:00:00.000Z',
      }),
    )
    await appendExecutionLogRecord(
      projectRoot,
      createRecord({
        id: 'recent',
        startedAt: '2026-07-13T10:59:59.000Z',
        completedAt: '2026-07-13T11:00:00.000Z',
      }),
    )

    const output = await captureUsageOutput({ projectRoot, args: ['--since', '24h'], now })

    expect(output).toContain('Since: 2026-07-12T12:00:00.000Z')
    expect(output).toContain('Workflow runs: 1')
    expect(output).toContain('Provider attempts: 1')
    expect(output).toContain('Recorded total tokens: 125')
  })

  it('supports ISO dates and validates invalid time filters', async () => {
    const projectRoot = await createTempProject()

    await appendExecutionLogRecord(projectRoot, createRecord())

    await expect(
      captureUsageOutput({ projectRoot, args: ['--since', '2026-07-12'] }),
    ).resolves.toContain('Provider attempts: 1')
    await expect(
      runUsageCommand({ projectRoot, args: ['--since', 'yesterday-ish'] }),
    ).rejects.toThrow('Invalid --since value')
  })

  it('limits grouping output to the requested workflow or model dimension', async () => {
    const projectRoot = await createTempProject()
    await appendExecutionLogRecord(projectRoot, createRecord())

    const workflowOutput = await captureUsageOutput({
      projectRoot,
      args: ['--group-by', 'workflow'],
    })
    const modelOutput = await captureUsageOutput({
      projectRoot,
      args: ['--group-by', 'model'],
    })

    expect(workflowOutput).toContain('Provider attempts by workflow:')
    expect(workflowOutput).not.toContain('Provider attempts by provider/model:')
    expect(modelOutput).toContain('Provider attempts by provider/model:')
    expect(modelOutput).not.toContain('Provider attempts by workflow:')
    await expect(
      runUsageCommand({ projectRoot, args: ['--group-by', 'provider'] }),
    ).rejects.toThrow('--group-by must be "workflow" or "model".')
  })

  it('preserves line-specific errors for malformed history', async () => {
    const projectRoot = await createTempProject()
    await appendExecutionLogRecord(projectRoot, createRecord())

    const { appendFile } = await import('node:fs/promises')
    await appendFile(
      path.join(projectRoot, '.friday/runtime/execution-log.jsonl'),
      'not-json\n',
      'utf8',
    )

    await expect(runUsageCommand({ projectRoot, args: [] })).rejects.toThrow(
      'Malformed execution log record at line 2: invalid JSON.',
    )
  })

  it('reports aggregate hosted budget state from the existing execution log', async () => {
    const projectRoot = await createTempProject()
    await mkdir(path.join(projectRoot, '.friday'), { recursive: true })
    await writeFile(
      path.join(projectRoot, '.friday', 'budget-policy.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        period: 'calendar-month',
        currency: 'USD',
        aggregateHostedCost: { warningThreshold: 1, hardLimit: 2 },
      })}\n`,
      'utf8',
    )
    await appendExecutionLogRecord(
      projectRoot,
      createRecord({
        chosenRoute: {
          ...localRoute,
          decision: 'use-strong-hosted',
          provider: 'deepseek',
          modelTier: 'strong-hosted',
          model: 'deepseek-v4-pro',
        },
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        costEstimate: {
          ...createRecord().costEstimate,
          provider: 'deepseek',
          model: 'deepseek-v4-pro',
          estimatedTotalCost: 1.25,
        },
      }),
    )

    const output = await captureUsageOutput({
      projectRoot,
      args: ['--budget'],
      now: new Date('2026-07-12T12:00:00.000Z'),
    })

    expect(output).toContain('Friday hosted budget')
    expect(output).toContain('Policy source: project')
    expect(output).toContain('Current hosted usage: 1.250000 USD')
    expect(output).toContain('Status: warning')
    expect(output).toContain('Warning acknowledgement required: yes')
  })

  it('rejects filters and grouping when reporting the fixed calendar-month budget', async () => {
    const projectRoot = await createTempProject()

    await expect(
      runUsageCommand({ projectRoot, args: ['--budget', '--since', '7d'] }),
    ).rejects.toThrow('friday usage --budget always reports the current UTC calendar month')
    await expect(
      runUsageCommand({ projectRoot, args: ['--group-by', 'model', '--budget'] }),
    ).rejects.toThrow('does not support --since or --group-by')
  })

  it('makes missing-policy and hard-limit budget states unambiguous', async () => {
    const projectRoot = await createTempProject()
    const missingPolicy = await captureUsageOutput({
      projectRoot,
      args: ['--budget'],
      now: new Date('2026-07-12T12:00:00.000Z'),
    })

    expect(missingPolicy).toContain('Policy source: none')
    expect(missingPolicy).toContain('Status: unconfigured')
    expect(missingPolicy).not.toContain('Status: within')

    await mkdir(path.join(projectRoot, '.friday'), { recursive: true })
    await writeFile(
      path.join(projectRoot, '.friday', 'budget-policy.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        period: 'calendar-month',
        currency: 'USD',
        aggregateHostedCost: { hardLimit: 1 },
      })}\n`,
      'utf8',
    )
    await appendExecutionLogRecord(
      projectRoot,
      createRecord({
        chosenRoute: { ...localRoute, provider: 'deepseek', modelTier: 'strong-hosted' },
        costEstimate: { ...createRecord().costEstimate, estimatedTotalCost: 1.25 },
      }),
    )

    const exceeded = await captureUsageOutput({
      projectRoot,
      args: ['--budget'],
      now: new Date('2026-07-12T12:00:00.000Z'),
    })
    expect(exceeded).toContain('Remaining allowance: 0.000000 USD')
    expect(exceeded).toContain('Overage: 0.250000 USD')
    expect(exceeded).toContain('Status: blocked')
  })
})
