import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  appendExecutionLogRecord,
  createExecutionLogRecord,
  type ExecutionLogRecord,
} from '../../ai/usage/executionLog.js'
import { readDeveloperOutcomeEvents } from '../../ai/usage/outcomeLog.js'
import type { AiRoute } from '../../ai/routing/modelRouting.js'
import { runOutcomeCommand } from './outcome.js'

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
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-outcome-command-'))
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
    startedAt: '2026-07-14T08:59:00.000Z',
    completedAt: '2026-07-14T09:00:00.000Z',
    latencyMs: 60_000,
    usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
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
    privacy: { privacyLevel: 'internal', blocked: false, secretDetected: false },
    ...overrides,
  })
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('runOutcomeCommand', () => {
  it.each(['accepted', 'retried', 'escalated', 'rejected'] as const)(
    'records %s for an exact execution identifier and displays the target first',
    async (status) => {
      const projectRoot = await createTempProject()
      await appendExecutionLogRecord(projectRoot, createRecord())
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

      await runOutcomeCommand({
        projectRoot,
        args: ['exec-1', status],
        interactive: false,
        now: new Date('2026-07-14T10:00:00.000Z'),
        createId: () => `outcome-${status}`,
      })

      const output = log.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Execution: exec-1')
      expect(output).toContain('Workflow: plan')
      expect(output).toContain('Execution status: succeeded')
      expect(output.indexOf('Execution: exec-1')).toBeLessThan(output.indexOf('Outcome recorded:'))
      await expect(readDeveloperOutcomeEvents(projectRoot)).resolves.toMatchObject([
        { executionId: 'exec-1', status },
      ])
    },
  )

  it('requires confirmation before latest mutates history', async () => {
    const projectRoot = await createTempProject()
    await appendExecutionLogRecord(projectRoot, createRecord({ id: 'exec-1' }))
    await appendExecutionLogRecord(projectRoot, createRecord({ id: 'exec-2' }))
    const confirm = vi.fn().mockResolvedValue(true)

    await runOutcomeCommand({
      projectRoot,
      args: ['latest', 'accepted'],
      interactive: true,
      confirm,
      createId: () => 'outcome-1',
    })

    expect(confirm).toHaveBeenCalledWith('Record outcome "accepted" for execution exec-2?')
    await expect(readDeveloperOutcomeEvents(projectRoot)).resolves.toMatchObject([
      { executionId: 'exec-2', status: 'accepted' },
    ])
  })

  it('does not mutate when latest confirmation is declined', async () => {
    const projectRoot = await createTempProject()
    await appendExecutionLogRecord(projectRoot, createRecord())

    await runOutcomeCommand({
      projectRoot,
      args: ['latest', 'rejected'],
      interactive: true,
      confirm: async () => false,
    })

    await expect(readDeveloperOutcomeEvents(projectRoot)).resolves.toEqual([])
  })

  it('rejects latest in non-interactive use', async () => {
    const projectRoot = await createTempProject()
    await appendExecutionLogRecord(projectRoot, createRecord())

    await expect(
      runOutcomeCommand({
        projectRoot,
        args: ['latest', 'accepted'],
        interactive: false,
      }),
    ).rejects.toThrow('Non-interactive outcome recording requires an exact execution identifier.')
  })

  it('rejects missing and ambiguous exact targets', async () => {
    const projectRoot = await createTempProject()
    await appendExecutionLogRecord(projectRoot, createRecord())
    await appendExecutionLogRecord(projectRoot, createRecord())

    await expect(
      runOutcomeCommand({ projectRoot, args: ['missing', 'accepted'], interactive: false }),
    ).rejects.toThrow('Execution "missing" was not found')
    await expect(
      runOutcomeCommand({ projectRoot, args: ['exec-1', 'accepted'], interactive: false }),
    ).rejects.toThrow('Execution identifier "exec-1" is ambiguous')
  })

  it('validates outcome values and does not accept free-text fields', async () => {
    const projectRoot = await createTempProject()

    await expect(
      runOutcomeCommand({ projectRoot, args: ['exec-1', 'useful'], interactive: false }),
    ).rejects.toThrow('Outcome must be accepted, retried, escalated, or rejected.')
    await expect(
      runOutcomeCommand({
        projectRoot,
        args: ['exec-1', 'accepted', '--reason', 'private'],
        interactive: false,
      }),
    ).rejects.toThrow('Usage: friday outcome <execution-id|latest>')
  })
})
