import path from 'node:path'

import {
  executePrompt,
  preparePromptExecution,
  type AvailableLocalModelProvider,
  type ExecutePromptRequest,
  type ExecutionProviderChoice,
} from '../../ai/execution/executePrompt.js'
import type { LmStudioFetch } from '../../ai/providers/lmStudioProvider.js'
import { resolveLocalModelProvider } from '../../ai/providers/resolveLocalProvider.js'
import type { AiTaskType } from '../../ai/routing/modelRouting.js'
import {
  assistantDisplayDefaults,
  getDefaultMaxOutputTokens,
  type AssistantDisplayPolicy,
} from '../../ai/execution/outputTokenPolicy.js'
import { printAssistantResponse } from '../ui/assistantResponse.js'
import { createStatusReporter, type StatusReporter } from '../ui/statusReporter.js'

const taskTypes = [
  'brainstorm',
  'plan',
  'spec',
  'design',
  'build',
  'review',
  'refactor',
  'test',
  'ship',
  'ask',
  'escalate',
] as const satisfies readonly AiTaskType[]

export interface ExecuteCommandOptions {
  projectRoot: string
  args: string[]
  localProvider?: AvailableLocalModelProvider
  homeDir?: string
  providerFetch?: LmStudioFetch
  statusReporter?: StatusReporter
  displayPolicy?: AssistantDisplayPolicy
}

function parseRequiredValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }

  return value
}

function parseTaskType(value: string): AiTaskType {
  if (taskTypes.includes(value as AiTaskType)) {
    return value as AiTaskType
  }

  throw new Error(`Invalid --task value "${value}". Expected one of: ${taskTypes.join(', ')}.`)
}

function parseProvider(value: string): ExecutionProviderChoice {
  if (value === 'local') {
    return value
  }

  throw new Error('friday execute currently supports only --provider local.')
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

function inferTaskType(promptPath: string): AiTaskType {
  const baseName = path.basename(promptPath)

  if (baseName.includes('plan')) {
    return 'plan'
  }

  if (baseName.includes('review')) {
    return 'review'
  }

  return 'ask'
}

export function parseExecuteArgs(args: string[], projectRoot: string): ExecutePromptRequest {
  const promptPathArg = args[0]

  if (!promptPathArg || promptPathArg.startsWith('--')) {
    throw new Error(
      'A generated prompt artefact is required. Usage: friday execute <prompt-path> --provider local',
    )
  }

  const request: ExecutePromptRequest = {
    promptPath: path.resolve(projectRoot, promptPathArg),
    provider: 'local',
    taskType: inferTaskType(promptPathArg),
    maxOutputTokens: getDefaultMaxOutputTokens(inferTaskType(promptPathArg)),
    temperature: 0.2,
  }
  let providerWasSet = false

  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index]

    switch (flag) {
      case '--provider':
        request.provider = parseProvider(parseRequiredValue(args, index, flag))
        providerWasSet = true
        index += 1
        break
      case '--task':
        request.taskType = parseTaskType(parseRequiredValue(args, index, flag))
        index += 1
        break
      case '--max-output-tokens':
        request.maxOutputTokens = parsePositiveInteger(flag, parseRequiredValue(args, index, flag))
        request.maxOutputTokensExplicit = true
        index += 1
        break
      case '--temperature':
        request.temperature = parseTemperature(parseRequiredValue(args, index, flag))
        index += 1
        break
      case '--display-max-lines':
      case '--display-max-chars':
        parsePositiveInteger(flag, parseRequiredValue(args, index, flag))
        index += 1
        break
      default:
        throw new Error(`Unknown execute option: ${String(flag)}.`)
    }
  }

  if (!providerWasSet) {
    throw new Error('friday execute requires an explicit provider. Use --provider local.')
  }

  if (!request.maxOutputTokensExplicit) {
    request.maxOutputTokens = getDefaultMaxOutputTokens(request.taskType)
  }

  return request
}

export function parseExecuteDisplayPolicy(args: string[]): AssistantDisplayPolicy {
  const policy = { ...assistantDisplayDefaults }

  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--display-max-lines') {
      policy.maxLines = parsePositiveInteger(flag, parseRequiredValue(args, index, flag))
      index += 1
    } else if (flag === '--display-max-chars') {
      policy.maxChars = parsePositiveInteger(flag, parseRequiredValue(args, index, flag))
      index += 1
    }
  }

  return policy
}

export async function runExecuteCommand(options: ExecuteCommandOptions): Promise<void> {
  const request = parseExecuteArgs(options.args, options.projectRoot)
  const displayPolicy = options.displayPolicy ?? parseExecuteDisplayPolicy(options.args)
  const statusReporter = options.statusReporter ?? createStatusReporter()
  const modelProvider =
    options.localProvider ??
    (
      await resolveLocalModelProvider({
        ...(options.homeDir === undefined ? {} : { homeDir: options.homeDir }),
        ...(options.providerFetch === undefined ? {} : { fetch: options.providerFetch }),
      })
    ).provider
  const preparedExecution = await preparePromptExecution({
    request,
    projectRoot: options.projectRoot,
    modelProvider,
    statusReporter,
  })

  console.log('Friday execute pre-execution summary')
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
  console.log('')
  const result = await executePrompt({
    request,
    projectRoot: options.projectRoot,
    modelProvider,
    preparedExecution,
    statusReporter,
  })

  console.log('Friday prompt executed with an explicit local provider.')
  console.log('')
  console.log('Input:')
  console.log(result.promptArtifact)
  console.log('')
  console.log('Safety:')
  console.log(`Privacy level: ${result.classification.privacyLevel}`)
  console.log(`Blocked: ${result.route.blocked ? 'yes' : 'no'}`)
  console.log(`Route decision: ${result.route.decision}`)
  console.log(`Provider/model: ${result.provider}/${result.model}`)
  console.log(`Effective output allowance: ${result.request.maxOutputTokens} tokens`)
  console.log('')
  console.log('Usage:')
  console.log(`Input tokens: ${result.usage.inputTokens}`)
  console.log(`Output tokens: ${result.usage.outputTokens}`)
  console.log(`Total tokens: ${result.usage.totalTokens}`)
  console.log('')
  printAssistantResponse({
    content: result.message.content,
    resultArtifact: result.resultArtifact,
    policy: displayPolicy,
  })
  console.log('')
  console.log(`Result artefact: ${result.resultArtifact}`)
}
