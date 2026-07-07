import type { AiUsageCostEstimate, EstimateAiUsageCostInput } from './pricingModel.js'

const TOKENS_PER_PRICING_UNIT = 1_000_000
const ADVISORY_WARNING =
  'Cost estimates are advisory and based on estimated token counts until real usage telemetry exists.'

function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }
}

function assertNonNegativeFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative finite number`)
  }
}

function estimateTokenCost(tokenCount: number, pricePerMillionTokens: number): number {
  return roundCost((tokenCount / TOKENS_PER_PRICING_UNIT) * pricePerMillionTokens)
}

function roundCost(value: number): number {
  return Number(value.toFixed(12))
}

export function estimateAiUsageCost(input: EstimateAiUsageCostInput): AiUsageCostEstimate {
  const { pricing, usage } = input

  assertNonNegativeInteger(usage.estimatedInputTokens, 'estimatedInputTokens')
  assertNonNegativeInteger(usage.estimatedOutputTokens, 'estimatedOutputTokens')
  assertNonNegativeFiniteNumber(pricing.inputTokenPricePerMillion, 'inputTokenPricePerMillion')
  assertNonNegativeFiniteNumber(pricing.outputTokenPricePerMillion, 'outputTokenPricePerMillion')

  const estimatedInputCost = estimateTokenCost(
    usage.estimatedInputTokens,
    pricing.inputTokenPricePerMillion,
  )
  const estimatedOutputCost = estimateTokenCost(
    usage.estimatedOutputTokens,
    pricing.outputTokenPricePerMillion,
  )

  return {
    provider: pricing.provider,
    model: pricing.model,
    currency: pricing.currency,
    estimatedInputTokens: usage.estimatedInputTokens,
    estimatedOutputTokens: usage.estimatedOutputTokens,
    estimatedTotalTokens: usage.estimatedInputTokens + usage.estimatedOutputTokens,
    estimatedInputCost,
    estimatedOutputCost,
    estimatedTotalCost: roundCost(estimatedInputCost + estimatedOutputCost),
    advisory: true,
    basis: 'estimated-token-counts',
    warning: ADVISORY_WARNING,
  }
}
