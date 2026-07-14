import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'

import {
  readExecutionLogRecords,
  type DeveloperOutcomeStatus,
  type ExecutionLogRecord,
} from '../../ai/usage/executionLog.js'
import {
  appendDeveloperOutcomeEvent,
  createDeveloperOutcomeEvent,
} from '../../ai/usage/outcomeLog.js'

const outcomeUsage = 'friday outcome <execution-id|latest> <accepted|retried|escalated|rejected>'

export interface OutcomeCommandOptions {
  projectRoot: string
  args: string[]
  interactive?: boolean
  confirm?: (question: string) => Promise<boolean>
  now?: Date
  createId?: () => string
}

function parseOutcomeArgs(args: string[]): {
  target: string
  status: DeveloperOutcomeStatus
} {
  if (args.length !== 2) {
    throw new Error(`Usage: ${outcomeUsage}`)
  }

  const [target, status] = args

  if (!target) {
    throw new Error(`Usage: ${outcomeUsage}`)
  }

  if (
    status !== 'accepted' &&
    status !== 'retried' &&
    status !== 'escalated' &&
    status !== 'rejected'
  ) {
    throw new Error('Outcome must be accepted, retried, escalated, or rejected.')
  }

  return { target, status }
}

function findTargetExecution(records: ExecutionLogRecord[], target: string): ExecutionLogRecord {
  if (target === 'latest') {
    const latest = records.at(-1)

    if (latest === undefined) {
      throw new Error('No local execution history was found.')
    }

    return latest
  }

  const matches = records.filter((record) => record.id === target)

  if (matches.length === 0) {
    throw new Error(`Execution "${target}" was not found in local history.`)
  }

  if (matches.length > 1) {
    throw new Error(
      `Execution identifier "${target}" is ambiguous because it appears more than once in local history.`,
    )
  }

  return matches[0] as ExecutionLogRecord
}

function displayTargetExecution(record: ExecutionLogRecord): void {
  console.log('Target execution')
  console.log(`Execution: ${record.id}`)
  console.log(`Workflow: ${record.workflow.type}`)
  console.log(`Provider/model: ${record.provider}/${record.model}`)
  console.log(`Execution status: ${record.result.status}`)
  console.log(`Completed: ${record.completedAt}`)
}

async function confirmInTerminal(question: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })

  try {
    const answer = await prompt.question(`${question} [y/N] `)
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes'
  } finally {
    prompt.close()
  }
}

export async function runOutcomeCommand(options: OutcomeCommandOptions): Promise<void> {
  const { target, status } = parseOutcomeArgs(options.args)
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)

  if (target === 'latest' && !interactive) {
    throw new Error(
      'Non-interactive outcome recording requires an exact execution identifier. Replace "latest" with the displayed execution ID.',
    )
  }

  const records = await readExecutionLogRecords(options.projectRoot)
  const execution = findTargetExecution(records, target)

  displayTargetExecution(execution)

  if (target === 'latest') {
    const confirm = options.confirm ?? confirmInTerminal
    const confirmed = await confirm(`Record outcome "${status}" for execution ${execution.id}?`)

    if (!confirmed) {
      console.log('Outcome recording cancelled. No history was changed.')
      return
    }
  }

  const event = createDeveloperOutcomeEvent({
    id: (options.createId ?? randomUUID)(),
    executionId: execution.id,
    status,
    recordedAt: (options.now ?? new Date()).toISOString(),
  })

  await appendDeveloperOutcomeEvent(options.projectRoot, event)
  console.log(`Outcome recorded: ${status}`)
  console.log(
    'Outcome history is local and append-only; a later outcome supersedes this summary value.',
  )
}
