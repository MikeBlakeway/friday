import path from 'node:path'

import {
  executePrompt,
  type AvailableLocalModelProvider,
  type ExecutePromptRequest,
  type ExecutionProviderChoice,
} from '../../ai/execution/executePrompt.js'
import { createLmStudioProvider } from '../../ai/providers/lmStudioProvider.js'
import type { AiTaskType } from '../../ai/routing/modelRouting.js'

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
      'A generated prompt artifact is required. Usage: friday execute <prompt-path> --provider local',
    )
  }

  const request: ExecutePromptRequest = {
    promptPath: path.resolve(projectRoot, promptPathArg),
    provider: 'local',
    taskType: inferTaskType(promptPathArg),
    maxOutputTokens: 1_200,
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
        index += 1
        break
      case '--temperature':
        request.temperature = parseTemperature(parseRequiredValue(args, index, flag))
        index += 1
        break
      default:
        throw new Error(`Unknown execute option: ${String(flag)}.`)
    }
  }

  if (!providerWasSet) {
    throw new Error('friday execute requires an explicit provider. Use --provider local.')
  }

  return request
}

export async function runExecuteCommand(options: ExecuteCommandOptions): Promise<void> {
  const request = parseExecuteArgs(options.args, options.projectRoot)
  const result = await executePrompt({
    request,
    projectRoot: options.projectRoot,
    modelProvider: options.localProvider ?? createLmStudioProvider(),
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
  console.log('')
  console.log('Usage:')
  console.log(`Input tokens: ${result.usage.inputTokens}`)
  console.log(`Output tokens: ${result.usage.outputTokens}`)
  console.log(`Total tokens: ${result.usage.totalTokens}`)
  console.log('')
  console.log('Output:')
  console.log(result.resultArtifact)
}
