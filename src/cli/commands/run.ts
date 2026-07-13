import path from 'node:path'
import readline from 'node:readline/promises'

import {
  executePrompt,
  preparePromptExecution,
  type AvailableLocalModelProvider,
  type ExecutePromptRequest,
} from '../../ai/execution/executePrompt.js'
import { loadGlobalProviderConfiguration } from '../../ai/providers/globalProviderConfig.js'
import type { LmStudioFetch } from '../../ai/providers/lmStudioProvider.js'
import { resolveLocalModelProvider } from '../../ai/providers/resolveLocalProvider.js'
import {
  assistantDisplayDefaults,
  getDefaultMaxOutputTokens,
  type AssistantDisplayPolicy,
} from '../../ai/execution/outputTokenPolicy.js'
import { runPlanCommand } from './plan.js'
import { runReviewCommand } from './review.js'
import { printAssistantResponse } from '../ui/assistantResponse.js'
import { createStatusReporter, type StatusReporter } from '../ui/statusReporter.js'

type RunWorkflow = 'plan' | 'review'

export interface RunCommandArgs {
  workflow: RunWorkflow
  goal?: string
  changed?: true
  provider?: string
  model?: string
  yes: boolean
  maxOutputTokens: number
  maxOutputTokensExplicit: boolean
  temperature: number
  displayMaxLines: number
  displayMaxChars: number
}

export interface RunWorkflowCommandOptions {
  projectRoot: string
  args: string[]
  homeDir?: string
  localProvider?: AvailableLocalModelProvider
  providerFetch?: LmStudioFetch
  interactive?: boolean
  confirm?: (question: string) => Promise<boolean>
  now?: () => Date
  statusReporter?: StatusReporter
  displayPolicy?: AssistantDisplayPolicy
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }
  return value
}

function parsePositiveInteger(flag: string, value: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${flag} value "${value}". Expected a positive integer.`)
  }
  return parsed
}

function parseTemperature(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
    throw new Error(`Invalid --temperature value "${value}". Expected a number from 0 to 2.`)
  }
  return parsed
}

export function parseRunArgs(args: string[]): RunCommandArgs {
  const workflow = args[0]
  if (workflow !== 'plan' && workflow !== 'review') {
    throw new Error('Unknown or missing workflow. Usage: friday run <plan|review> ...')
  }

  const positional: string[] = []
  const parsed: RunCommandArgs = {
    workflow,
    yes: false,
    maxOutputTokens: getDefaultMaxOutputTokens(workflow),
    maxOutputTokensExplicit: false,
    temperature: 0.2,
    displayMaxLines: assistantDisplayDefaults.maxLines,
    displayMaxChars: assistantDisplayDefaults.maxChars,
  }

  for (let index = 1; index < args.length; index += 1) {
    const value = args[index]
    switch (value) {
      case '--changed':
        parsed.changed = true
        break
      case '--yes':
        parsed.yes = true
        break
      case '--provider':
        parsed.provider = requireValue(args, index, value)
        index += 1
        break
      case '--model':
        parsed.model = requireValue(args, index, value)
        index += 1
        break
      case '--max-output-tokens':
        parsed.maxOutputTokens = parsePositiveInteger(value, requireValue(args, index, value))
        parsed.maxOutputTokensExplicit = true
        index += 1
        break
      case '--temperature':
        parsed.temperature = parseTemperature(requireValue(args, index, value))
        index += 1
        break
      case '--display-max-lines':
        parsed.displayMaxLines = parsePositiveInteger(value, requireValue(args, index, value))
        index += 1
        break
      case '--display-max-chars':
        parsed.displayMaxChars = parsePositiveInteger(value, requireValue(args, index, value))
        index += 1
        break
      default:
        if (value?.startsWith('--')) {
          throw new Error(`Unknown friday run option: ${value}.`)
        }
        positional.push(String(value))
    }
  }

  if (parsed.provider !== undefined && parsed.provider !== 'lm-studio') {
    throw new Error('friday run currently supports only --provider lm-studio.')
  }

  if (workflow === 'plan') {
    const goal = positional.join(' ').trim()
    if (goal.length === 0) {
      throw new Error('A planning goal is required. Usage: friday run plan <goal...>')
    }
    if (parsed.changed) {
      throw new Error('--changed is only supported by friday run review.')
    }
    parsed.goal = goal
  } else if (!parsed.changed || positional.length > 0) {
    throw new Error('A review source is required. Usage: friday run review --changed')
  }

  return parsed
}

async function askForConfirmation(question: string): Promise<boolean> {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await prompt.question(question)
    return ['y', 'yes'].includes(answer.trim().toLowerCase())
  } finally {
    prompt.close()
  }
}

function formatMoney(value: number, currency: string): string {
  return `${value.toFixed(6)} ${currency}`
}

export async function runWorkflowCommand(options: RunWorkflowCommandOptions): Promise<void> {
  const args = parseRunArgs(options.args)
  const statusReporter = options.statusReporter ?? createStatusReporter()
  const displayPolicy = options.displayPolicy ?? {
    maxLines: args.displayMaxLines,
    maxChars: args.displayMaxChars,
  }
  const configuration = await loadGlobalProviderConfiguration(options.homeDir)
  if (configuration.status === 'missing') {
    throw new Error(
      `No global provider configuration found at ${configuration.filePath}. Run "friday local setup" first.`,
    )
  }

  if (args.workflow === 'plan') {
    await runPlanCommand({
      projectRoot: options.projectRoot,
      ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
      goal: args.goal ?? '',
      statusReporter,
    })
  } else {
    await runReviewCommand({
      projectRoot: options.projectRoot,
      ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
      args: ['--changed'],
      statusReporter,
    })
  }

  const promptPath = path.join(
    options.projectRoot,
    '.friday',
    'output',
    `${args.workflow}-prompt.md`,
  )
  const request: ExecutePromptRequest = {
    promptPath,
    provider: 'local',
    taskType: args.workflow,
    maxOutputTokens: args.maxOutputTokens,
    ...(args.maxOutputTokensExplicit ? { maxOutputTokensExplicit: true } : {}),
    temperature: args.temperature,
  }
  const modelProvider =
    options.localProvider ??
    (
      await resolveLocalModelProvider({
        ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
        ...(options.providerFetch === undefined ? {} : { fetch: options.providerFetch }),
        ...(args.provider === undefined ? {} : { provider: args.provider }),
        ...(args.model === undefined ? {} : { model: args.model }),
      })
    ).provider
  const preparedExecution = await preparePromptExecution({
    request,
    projectRoot: options.projectRoot,
    modelProvider,
  })
  const route = preparedExecution.routeSummary.recommendation.route

  console.log('')
  console.log('Friday run pre-execution summary')
  console.log(`Workflow: ${args.workflow}`)
  console.log(`Privacy level: ${preparedExecution.routeSummary.classification.privacyLevel}`)
  console.log(`Route: ${route.decision}`)
  console.log(
    `Provider/model: ${modelProvider.capabilities.provider}/${modelProvider.capabilities.model}`,
  )
  console.log(
    `Effective output allowance: ${preparedExecution.tokenAllowance.effectiveMaxOutputTokens} tokens`,
  )
  console.log(
    preparedExecution.tokenAllowance.retry.enabled
      ? `Adaptive retry: one retry up to ${preparedExecution.tokenAllowance.retry.maxOutputTokens} tokens`
      : `Adaptive retry: disabled (${preparedExecution.tokenAllowance.retry.reason})`,
  )
  console.log('Expected output: .friday/output/executions/')
  console.log(
    `Estimated cost: ${formatMoney(preparedExecution.costEstimate.estimatedTotalCost, preparedExecution.costEstimate.currency)}`,
  )
  console.log('Warnings:')
  for (const warning of preparedExecution.routeSummary.warnings) {
    console.log(`- ${warning}`)
  }

  if (!args.yes) {
    const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
    if (!interactive) {
      throw new Error('Friday run requires approval before provider invocation. Re-run with --yes.')
    }
    const confirmed = await (options.confirm ?? askForConfirmation)(
      'Execute this workflow with the configured local provider? [y/N] ',
    )
    if (!confirmed) {
      throw new Error('Friday run cancelled before provider invocation.')
    }
  }

  const result = await executePrompt({
    request,
    projectRoot: options.projectRoot,
    modelProvider,
    preparedExecution,
    statusReporter,
    ...(options.now === undefined ? {} : { now: options.now }),
  })

  console.log('')
  console.log('Friday workflow executed locally.')
  console.log(`Prompt artefact: ${result.promptArtifact}`)
  printAssistantResponse({
    content: result.message.content,
    resultArtifact: result.resultArtifact,
    policy: displayPolicy,
  })
  console.log(`Result artefact: ${result.resultArtifact}`)
  console.log(`Usage: ${result.usage.totalTokens} total tokens`)
}
