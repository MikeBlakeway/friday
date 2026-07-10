import type { ModelPricingConfiguration } from './pricingModel.js'

export const PRICING_SOURCE = 'Friday local MVP advisory pricing configuration'

export const pricingConfigurations = [
  {
    provider: 'local',
    model: 'local-coder',
    currency: 'USD',
    inputTokenPricePerMillion: 0,
    outputTokenPricePerMillion: 0,
    source: PRICING_SOURCE,
  },
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

export function getAvailablePricingMessage(): string {
  return pricingConfigurations.map((pricing) => `${pricing.provider}/${pricing.model}`).join(', ')
}

export function findPricing(provider: string, model: string): ModelPricingConfiguration {
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
