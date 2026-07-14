import {
  readExecutionLogRecords,
  summariseExecutionLogRecords,
  type ExecutionLogRecord,
  type ExecutionLogSummary,
} from '../../ai/usage/executionLog.js'
import { readDeveloperOutcomeEvents } from '../../ai/usage/outcomeLog.js'
import {
  evaluateHostedBudgetPolicy,
  loadBudgetPolicies,
  resolveEffectiveHostedBudgetPolicy,
  type HostedBudgetPolicyResult,
} from '../../ai/budget/budgetPolicy.js'

type UsageGroupBy = 'workflow' | 'model'

export interface UsageCommandOptions {
  projectRoot: string
  args: string[]
  now?: Date
  homeDir?: string
}

interface ParsedUsageArgs {
  groupBy?: UsageGroupBy
  since?: Date
  budget?: true
}

function parseRequiredValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }

  return value
}

function parseSince(value: string, now: Date): Date {
  const duration = /^(\d+)(m|h|d|w)$/.exec(value)

  if (duration !== null) {
    const amount = Number(duration[1])

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error(
        'Invalid --since value. Use a positive duration such as 24h or 7d, or a date such as 2026-07-01.',
      )
    }

    const millisecondsByUnit = {
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
    } as const
    const unit = duration[2] as keyof typeof millisecondsByUnit
    const timestamp = now.getTime() - amount * millisecondsByUnit[unit]

    if (!Number.isFinite(timestamp) || Number.isNaN(new Date(timestamp).getTime())) {
      throw new Error(
        'Invalid --since value. Use a positive duration such as 24h or 7d, or a date such as 2026-07-01.',
      )
    }

    return new Date(timestamp)
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      'Invalid --since value. Use a positive duration such as 24h or 7d, or a date such as 2026-07-01.',
    )
  }

  return new Date(timestamp)
}

function parseUsageArgs(args: string[], now = new Date()): ParsedUsageArgs {
  let groupBy: UsageGroupBy | undefined
  let since: Date | undefined
  let budget = false

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]

    switch (flag) {
      case '--since':
        since = parseSince(parseRequiredValue(args, index, flag), now)
        index += 1
        break
      case '--group-by': {
        const value = parseRequiredValue(args, index, flag)

        if (value !== 'workflow' && value !== 'model') {
          throw new Error('--group-by must be "workflow" or "model".')
        }

        groupBy = value
        index += 1
        break
      }
      case '--budget':
        budget = true
        break
      default:
        throw new Error(`Unknown usage option: ${String(flag)}.`)
    }
  }

  if (budget && (since !== undefined || groupBy !== undefined)) {
    throw new Error(
      'friday usage --budget always reports the current UTC calendar month and does not support --since or --group-by. Run "friday usage" without --budget to use those options.',
    )
  }

  return {
    ...(groupBy === undefined ? {} : { groupBy }),
    ...(since === undefined ? {} : { since }),
    ...(budget ? { budget: true as const } : {}),
  }
}

function formatBudgetSummary(result: HostedBudgetPolicyResult): string {
  return [
    'Friday hosted budget',
    `Policy source: ${result.source}`,
    `Period: ${result.period.startedAt} to ${result.period.endsAt}`,
    `Current hosted usage: ${result.currentUsage.toFixed(6)} ${result.currency}`,
    `Estimated request cost: ${result.estimatedRequestCost.toFixed(6)} ${result.currency}`,
    `Remaining allowance: ${
      result.remainingAllowance === undefined
        ? 'No hard limit configured'
        : `${result.remainingAllowance.toFixed(6)} ${result.currency}`
    }`,
    ...(result.overage === undefined
      ? []
      : [`Overage: ${result.overage.toFixed(6)} ${result.currency}`]),
    `Status: ${result.status}`,
    `Warning acknowledgement required: ${result.warningAcknowledgementRequired ? 'yes' : 'no'}`,
    `Hard-limit override allowed: ${result.hardLimitOverrideAllowed ? 'yes' : 'no'}`,
    'Reasons:',
    ...result.reasons.map((reason) => `  - ${reason}`),
  ].join('\n')
}

function filterRecordsSince(records: ExecutionLogRecord[], since?: Date): ExecutionLogRecord[] {
  if (since === undefined) {
    return records
  }

  return records.filter((record) => Date.parse(record.completedAt) >= since.getTime())
}

function formatCounts(title: string, counts: Record<string, number>): string[] {
  return [
    `${title}:`,
    ...Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `  ${key}: ${count}`),
  ]
}

function formatAdvisoryCosts(summary: ExecutionLogSummary): string[] {
  const costs = Object.entries(summary.advisoryCostByCurrency).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  if (costs.length === 0) {
    return ['Advisory total cost: 0.000000 USD']
  }

  return costs.map(([currency, total]) => `Advisory total cost: ${total.toFixed(6)} ${currency}`)
}

function formatUsageSummary(summary: ExecutionLogSummary, options: ParsedUsageArgs): string {
  const lines = [
    'Friday usage',
    ...(options.since === undefined ? [] : [`Since: ${options.since.toISOString()}`]),
    `Workflow runs: ${summary.workflowRuns}`,
    `Provider attempts: ${summary.providerAttempts}`,
    `Successful attempts: ${summary.byResultStatus.succeeded}`,
    `Failed attempts: ${summary.byResultStatus.failed}`,
    `Blocked attempts: ${summary.byResultStatus.blocked}`,
    `Recorded input tokens: ${summary.tokenUsage.inputTokens}`,
    `Recorded output tokens: ${summary.tokenUsage.outputTokens}`,
    `Recorded total tokens: ${summary.tokenUsage.totalTokens}`,
    ...formatAdvisoryCosts(summary),
    'Advisory costs are estimates, not billing records; local-model financial cost may be zero.',
    `Adaptive provider retries: ${summary.adaptiveRetries}`,
    ...formatCounts('Developer-recorded outcomes', summary.developerOutcomes),
  ]

  if (options.groupBy === undefined || options.groupBy === 'workflow') {
    lines.push(...formatCounts('Provider attempts by workflow', summary.byWorkflow))
  }

  if (options.groupBy === undefined || options.groupBy === 'model') {
    lines.push(...formatCounts('Provider attempts by provider/model', summary.byProviderModel))
  }

  return lines.join('\n')
}

export async function runUsageCommand(options: UsageCommandOptions): Promise<void> {
  const parsed = parseUsageArgs(options.args, options.now)
  const [records, outcomeEvents] = await Promise.all([
    readExecutionLogRecords(options.projectRoot),
    readDeveloperOutcomeEvents(options.projectRoot),
  ])

  if (parsed.budget) {
    const policies = await loadBudgetPolicies({
      projectRoot: options.projectRoot,
      ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
    })
    const effectivePolicy = resolveEffectiveHostedBudgetPolicy(policies)
    const budget = evaluateHostedBudgetPolicy({
      records,
      policies,
      estimatedRequestCost: 0,
      currency: effectivePolicy?.currency ?? 'USD',
      ...(options.now === undefined ? {} : { now: options.now }),
    })
    console.log(formatBudgetSummary(budget))
    return
  }

  if (records.length === 0) {
    console.log('Friday usage')
    console.log('No local execution history found.')
    console.log('Run a local workflow with "friday run" or "friday execute" to record usage.')
    return
  }

  const filteredRecords = filterRecordsSince(records, parsed.since)

  if (filteredRecords.length === 0) {
    console.log('Friday usage')
    console.log(`Since: ${parsed.since?.toISOString()}`)
    console.log('No execution history matched the selected time filter.')
    return
  }

  console.log(
    formatUsageSummary(summariseExecutionLogRecords(filteredRecords, outcomeEvents), parsed),
  )
}
