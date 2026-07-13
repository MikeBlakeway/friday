import { describe, expect, it } from 'vitest'

import { estimateAiUsageCost } from './estimateAiUsageCost.js'
import type { ModelPricingConfiguration } from './pricingModel.js'

function createPricing(
  overrides: Partial<ModelPricingConfiguration> = {},
): ModelPricingConfiguration {
  return {
    provider: 'example-ai',
    model: 'example-reasoner',
    currency: 'USD',
    inputTokenPricePerMillion: 1,
    outputTokenPricePerMillion: 3,
    ...overrides,
  }
}

describe('estimateAiUsageCost', () => {
  it('estimates input, output, and total cost from per-million token pricing', () => {
    const estimate = estimateAiUsageCost({
      pricing: createPricing(),
      usage: {
        estimatedInputTokens: 100_000,
        estimatedOutputTokens: 50_000,
      },
    })

    expect(estimate).toMatchObject({
      provider: 'example-ai',
      model: 'example-reasoner',
      currency: 'USD',
      estimatedInputTokens: 100_000,
      estimatedOutputTokens: 50_000,
      estimatedTotalTokens: 150_000,
      estimatedInputCost: 0.1,
      estimatedOutputCost: 0.15,
      estimatedTotalCost: 0.25,
      advisory: true,
      basis: 'estimated-token-counts',
    })
  })

  it('supports zero estimated output tokens for input-only planning', () => {
    const estimate = estimateAiUsageCost({
      pricing: createPricing({ inputTokenPricePerMillion: 2, outputTokenPricePerMillion: 8 }),
      usage: {
        estimatedInputTokens: 25_000,
        estimatedOutputTokens: 0,
      },
    })

    expect(estimate.estimatedInputCost).toBe(0.05)
    expect(estimate.estimatedOutputCost).toBe(0)
    expect(estimate.estimatedTotalCost).toBe(0.05)
  })

  it('distinguishes advisory estimates from local usage history and planned reporting', () => {
    const estimate = estimateAiUsageCost({
      pricing: createPricing(),
      usage: {
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
      },
    })

    expect(estimate.advisory).toBe(true)
    expect(estimate.warning).toContain('advisory')
    expect(estimate.warning).toContain('local execution records actual token usage separately')
    expect(estimate.warning).toContain('aggregate reporting and budget enforcement remain planned')
  })

  it('rejects negative or fractional estimated token counts', () => {
    expect(() =>
      estimateAiUsageCost({
        pricing: createPricing(),
        usage: {
          estimatedInputTokens: -1,
          estimatedOutputTokens: 10,
        },
      }),
    ).toThrow('estimatedInputTokens must be a non-negative integer')

    expect(() =>
      estimateAiUsageCost({
        pricing: createPricing(),
        usage: {
          estimatedInputTokens: 10,
          estimatedOutputTokens: 0.5,
        },
      }),
    ).toThrow('estimatedOutputTokens must be a non-negative integer')
  })

  it('rejects invalid pricing values', () => {
    expect(() =>
      estimateAiUsageCost({
        pricing: createPricing({ inputTokenPricePerMillion: Number.NaN }),
        usage: {
          estimatedInputTokens: 10,
          estimatedOutputTokens: 10,
        },
      }),
    ).toThrow('inputTokenPricePerMillion must be a non-negative finite number')

    expect(() =>
      estimateAiUsageCost({
        pricing: createPricing({ outputTokenPricePerMillion: -1 }),
        usage: {
          estimatedInputTokens: 10,
          estimatedOutputTokens: 10,
        },
      }),
    ).toThrow('outputTokenPricePerMillion must be a non-negative finite number')
  })
})
