import { estimateAiUsageCost } from '../../ai/pricing/estimateAiUsageCost.js'
import type {
  AiUsageCostEstimate,
  EstimateAiUsageCostInput,
  ModelPricingConfiguration,
} from '../../ai/pricing/pricingModel.js'

const PRICING_SOURCE = 'Friday local MVP advisory pricing configuration'

const pricingConfigurations = [
  {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    currency: 'USD',
    inputTokenPricePerMillion: 0.15,
    outputTokenPricePerMillion: 0.6,
    source: PRICING_SOURCE,
  },
  {
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    currency: 'USD',
    inputTokenPricePerMillion: 0.55,
    outputTokenPricePerMillion: 2.19,
    source: PRICING_SOURCE,
  },
  {
    provider: 'anthropic',
    model: 'claude-opus',
    currency: 'USD',
    inputTokenPricePerMillion: 15,
    outputTokenPricePerMillion: 75,
    source: PRICING_SOURCE,
  },
] as const satisfies readonly ModelPricingConfiguration[]

function parseRequiredValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`)
  }

  return value
}

function parseTokenCount(flag: string, value: string): number {
  const tokenCount = Number(value)

  if (!Number.isInteger(tokenCount) || tokenCount < 0) {
    throw new Error(`${flag} must be a non-negative integer.`)
  }

  return tokenCount
}

function getAvailablePricingMessage(): string {
  return pricingConfigurations.map((pricing) => `${pricing.provider}/${pricing.model}`).join(', ')
}

function findPricing(provider: string, model: string): ModelPricingConfiguration {
  const pricing = pricingConfigurations.find(
    (candidate) => candidate.provider === provider && candidate.model === model,
  )

  if (!pricing) {
    throw new Error(
      `Unsupported provider/model pricing: ${provider}/${model}. Available pricing: ${getAvailablePricingMessage()}.`,
    )
  }

  return pricing
}

function assertRequiredOption<T>(flag: string, value: T | undefined): T {
  if (value === undefined) {
    throw new Error(`Missing required option: ${flag}.`)
  }

  return value
}

export function parseCostEstimateArgs(args: string[]): EstimateAiUsageCostInput {
  let provider: string | undefined
  let model: string | undefined
  let estimatedInputTokens: number | undefined
  let estimatedOutputTokens: number | undefined

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]

    switch (flag) {
      case '--provider':
        provider = parseRequiredValue(args, index, flag)
        index += 1
        break
      case '--model':
        model = parseRequiredValue(args, index, flag)
        index += 1
        break
      case '--input-tokens':
        estimatedInputTokens = parseTokenCount(flag, parseRequiredValue(args, index, flag))
        index += 1
        break
      case '--output-tokens':
        estimatedOutputTokens = parseTokenCount(flag, parseRequiredValue(args, index, flag))
        index += 1
        break
      default:
        throw new Error(`Unknown cost option: ${String(flag)}.`)
    }
  }

  const pricing = findPricing(
    assertRequiredOption('--provider', provider),
    assertRequiredOption('--model', model),
  )

  return {
    pricing,
    usage: {
      estimatedInputTokens: assertRequiredOption('--input-tokens', estimatedInputTokens),
      estimatedOutputTokens: assertRequiredOption('--output-tokens', estimatedOutputTokens),
    },
  }
}

function formatMoney(value: number, currency: string): string {
  return `${value.toFixed(6)} ${currency}`
}

export function formatCostEstimate(estimate: AiUsageCostEstimate): string {
  return [
    'Friday cost estimate',
    'Advisory: yes',
    `Provider: ${estimate.provider}`,
    `Model: ${estimate.model}`,
    `Estimated input tokens: ${estimate.estimatedInputTokens}`,
    `Estimated output tokens: ${estimate.estimatedOutputTokens}`,
    `Estimated total tokens: ${estimate.estimatedTotalTokens}`,
    `Estimated input cost: ${formatMoney(estimate.estimatedInputCost, estimate.currency)}`,
    `Estimated output cost: ${formatMoney(estimate.estimatedOutputCost, estimate.currency)}`,
    `Estimated total cost: ${formatMoney(estimate.estimatedTotalCost, estimate.currency)}`,
    `Basis: ${estimate.basis}`,
    `Warning: ${estimate.warning}`,
  ].join('\n')
}

export function runCostCommand(args: string[]): void {
  const input = parseCostEstimateArgs(args)
  const estimate = estimateAiUsageCost(input)

  console.log(formatCostEstimate(estimate))
}
