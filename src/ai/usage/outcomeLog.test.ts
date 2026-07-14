import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  appendDeveloperOutcomeEvent,
  createDeveloperOutcomeEvent,
  getDeveloperOutcomeLogPath,
  readDeveloperOutcomeEvents,
} from './outcomeLog.js'

const tempDirs: string[] = []

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-outcome-log-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('developer outcome log', () => {
  it.each(['accepted', 'retried', 'escalated', 'rejected'] as const)(
    'appends a structured %s event without extra fields',
    async (status) => {
      const projectRoot = await createTempProject()
      const event = {
        ...createDeveloperOutcomeEvent({
          id: `outcome-${status}`,
          executionId: 'exec-1',
          status,
          recordedAt: '2026-07-14T09:00:00.000Z',
        }),
        note: 'PRIVATE-SNIPPET',
        rawPrompt: 'OPENAI_API_KEY=sk-secret',
      }

      await appendDeveloperOutcomeEvent(projectRoot, event)

      const rawLog = await readFile(getDeveloperOutcomeLogPath(projectRoot), 'utf8')
      expect(rawLog).toBe(
        `${JSON.stringify({
          schemaVersion: 1,
          id: `outcome-${status}`,
          executionId: 'exec-1',
          status,
          recordedAt: '2026-07-14T09:00:00.000Z',
        })}\n`,
      )
      expect(rawLog).not.toContain('PRIVATE-SNIPPET')
      expect(rawLog).not.toContain('sk-secret')
    },
  )

  it('keeps superseding outcome events append-only and in order', async () => {
    const projectRoot = await createTempProject()
    const first = createDeveloperOutcomeEvent({
      id: 'outcome-1',
      executionId: 'exec-1',
      status: 'retried',
      recordedAt: '2026-07-14T09:00:00.000Z',
    })
    const second = createDeveloperOutcomeEvent({
      id: 'outcome-2',
      executionId: 'exec-1',
      status: 'accepted',
      recordedAt: '2026-07-14T09:05:00.000Z',
    })

    await appendDeveloperOutcomeEvent(projectRoot, first)
    await appendDeveloperOutcomeEvent(projectRoot, second)

    await expect(readDeveloperOutcomeEvents(projectRoot)).resolves.toEqual([first, second])
  })

  it('rejects malformed events with line-specific errors', async () => {
    const projectRoot = await createTempProject()
    const logPath = getDeveloperOutcomeLogPath(projectRoot)

    await mkdir(path.dirname(logPath), { recursive: true })
    await writeFile(
      logPath,
      `${JSON.stringify({
        schemaVersion: 1,
        id: 'outcome-1',
        executionId: 'exec-1',
        status: 'maybe',
        recordedAt: '2026-07-14T09:00:00.000Z',
      })}\n`,
      'utf8',
    )

    await expect(readDeveloperOutcomeEvents(projectRoot)).rejects.toThrow(
      'Malformed developer outcome event at line 1: invalid status.',
    )
  })
})
