import path from 'node:path'

import { appendTextFile, ensureDir, pathExists, readTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import type { DeveloperOutcomeStatus } from './executionLog.js'

export const DEVELOPER_OUTCOME_LOG_SCHEMA_VERSION = 1
export const FRIDAY_DEVELOPER_OUTCOME_LOG_FILE = 'outcome-log.jsonl'

export interface DeveloperOutcomeEvent {
  schemaVersion: typeof DEVELOPER_OUTCOME_LOG_SCHEMA_VERSION
  id: string
  executionId: string
  status: DeveloperOutcomeStatus
  recordedAt: string
}

export type CreateDeveloperOutcomeEventInput = Omit<DeveloperOutcomeEvent, 'schemaVersion'>

export function getDeveloperOutcomeLogPath(projectRoot: string): string {
  return path.join(projectRoot, FRIDAY_PROJECT_DIR, 'runtime', FRIDAY_DEVELOPER_OUTCOME_LOG_FILE)
}

export function createDeveloperOutcomeEvent(
  input: CreateDeveloperOutcomeEventInput,
): DeveloperOutcomeEvent {
  return {
    schemaVersion: DEVELOPER_OUTCOME_LOG_SCHEMA_VERSION,
    id: input.id,
    executionId: input.executionId,
    status: input.status,
    recordedAt: input.recordedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertDeveloperOutcomeEvent(
  value: unknown,
  lineNumber: number,
): asserts value is DeveloperOutcomeEvent {
  if (!isRecord(value)) {
    throw new Error(`Malformed developer outcome event at line ${lineNumber}: expected object.`)
  }

  if (value.schemaVersion !== DEVELOPER_OUTCOME_LOG_SCHEMA_VERSION) {
    throw new Error(
      `Malformed developer outcome event at line ${lineNumber}: unsupported schemaVersion.`,
    )
  }

  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.executionId !== 'string' ||
    value.executionId.length === 0 ||
    typeof value.recordedAt !== 'string' ||
    value.recordedAt.length === 0
  ) {
    throw new Error(
      `Malformed developer outcome event at line ${lineNumber}: missing required fields.`,
    )
  }

  if (
    value.status !== 'accepted' &&
    value.status !== 'retried' &&
    value.status !== 'escalated' &&
    value.status !== 'rejected'
  ) {
    throw new Error(`Malformed developer outcome event at line ${lineNumber}: invalid status.`)
  }
}

export async function appendDeveloperOutcomeEvent(
  projectRoot: string,
  event: CreateDeveloperOutcomeEventInput | DeveloperOutcomeEvent,
): Promise<void> {
  const logPath = getDeveloperOutcomeLogPath(projectRoot)

  await ensureDir(path.dirname(logPath))
  await appendTextFile(logPath, `${JSON.stringify(createDeveloperOutcomeEvent(event))}\n`)
}

export async function readDeveloperOutcomeEvents(
  projectRoot: string,
): Promise<DeveloperOutcomeEvent[]> {
  const logPath = getDeveloperOutcomeLogPath(projectRoot)

  if (!(await pathExists(logPath))) {
    return []
  }

  const content = await readTextFile(logPath)
  const events: DeveloperOutcomeEvent[] = []

  content.split('\n').forEach((line, index) => {
    if (line.trim().length === 0) {
      return
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`Malformed developer outcome event at line ${index + 1}: invalid JSON.`)
    }

    assertDeveloperOutcomeEvent(parsed, index + 1)
    events.push(parsed)
  })

  return events
}
