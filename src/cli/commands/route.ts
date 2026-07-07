import { routeAiRequest } from '../../ai/routing/routeAiRequest.js'
import type {
  AiRoute,
  AiTaskType,
  ConfidenceRequirement,
  CostPreference,
  PrivacyLevel,
  RouteAiRequestInput,
  RouteAiRequestResult,
  TaskComplexity,
} from '../../ai/routing/modelRouting.js'

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

const privacyLevels = [
  'public',
  'internal',
  'private-repo',
  'sensitive',
  'secret',
] as const satisfies readonly PrivacyLevel[]

const taskComplexities = ['low', 'medium', 'high'] as const satisfies readonly TaskComplexity[]
const confidenceRequirements = [
  'draft',
  'standard',
  'high',
] as const satisfies readonly ConfidenceRequirement[]
const costPreferences = [
  'minimise-cost',
  'balanced',
  'quality-first',
] as const satisfies readonly CostPreference[]

function parseRequiredValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }

  return value
}

function parseEnumValue<T extends string>(
  flag: string,
  value: string,
  acceptedValues: readonly T[],
): T {
  if (acceptedValues.includes(value as T)) {
    return value as T
  }

  throw new Error(
    `Invalid ${flag} value "${value}". Expected one of: ${acceptedValues.join(', ')}.`,
  )
}

export function parseRoutePreviewArgs(args: string[]): RouteAiRequestInput {
  const input: RouteAiRequestInput = {
    taskType: 'ask',
    privacyLevel: 'public',
    complexity: 'medium',
    confidenceRequirement: 'standard',
    costPreference: 'balanced',
    allowHostedModels: true,
    allowPremiumModels: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]

    switch (flag) {
      case '--task':
        input.taskType = parseEnumValue(flag, parseRequiredValue(args, index, flag), taskTypes)
        index += 1
        break
      case '--privacy':
        input.privacyLevel = parseEnumValue(
          flag,
          parseRequiredValue(args, index, flag),
          privacyLevels,
        )
        index += 1
        break
      case '--complexity':
        input.complexity = parseEnumValue(
          flag,
          parseRequiredValue(args, index, flag),
          taskComplexities,
        )
        index += 1
        break
      case '--confidence':
        input.confidenceRequirement = parseEnumValue(
          flag,
          parseRequiredValue(args, index, flag),
          confidenceRequirements,
        )
        index += 1
        break
      case '--cost':
        input.costPreference = parseEnumValue(
          flag,
          parseRequiredValue(args, index, flag),
          costPreferences,
        )
        index += 1
        break
      case '--local-only':
        input.allowHostedModels = false
        break
      case '--allow-premium':
        input.allowPremiumModels = true
        break
      default:
        throw new Error(`Unknown route option: ${String(flag)}.`)
    }
  }

  return input
}

function formatYesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

function formatAlternative(route: AiRoute): string {
  return `- ${route.decision}: ${route.provider}/${route.model} (${route.modelTier}) - ${route.reason}`
}

export function formatRoutePreview(result: RouteAiRequestResult): string {
  return [
    'Friday route preview',
    `Decision: ${result.route.decision}`,
    `Provider: ${result.route.provider}`,
    `Model tier: ${result.route.modelTier}`,
    `Model: ${result.route.model}`,
    `Requires approval: ${formatYesNo(result.route.requiresApproval)}`,
    `Blocked: ${formatYesNo(result.route.blocked)}`,
    `Reason: ${result.route.reason}`,
    '',
    'Warnings:',
    ...(result.warnings.length > 0 ? result.warnings.map((warning) => `- ${warning}`) : ['- none']),
    '',
    'Alternatives:',
    ...(result.alternatives.length > 0 ? result.alternatives.map(formatAlternative) : ['- none']),
  ].join('\n')
}

export function runRouteCommand(args: string[]): void {
  const input = parseRoutePreviewArgs(args)
  const result = routeAiRequest(input)

  console.log(formatRoutePreview(result))
}
