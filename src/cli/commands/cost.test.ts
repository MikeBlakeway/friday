import { describe, expect, it } from 'vitest'

import { formatCostEstimate, parseCostEstimateArgs } from './cost.js'

describe('parseCostEstimateArgs', () => {
  it('builds a deterministic cost estimate input from CLI flags', () => {
    const input = parseCostEstimateArgs([
      '--provider',
      'deepseek',
      '--model',
      'deepseek-v4-flash',
      '--input-tokens',
      '1000',
      '--output-tokens',
      '2000',
    ])

    expect(input).toEqual({
      pricing: {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        currency: 'USD',
        inputTokenPricePerMillion: 0.15,
        outputTokenPricePerMillion: 0.6,
        source: 'Friday local MVP advisory pricing configuration',
      },
      usage: {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 2000,
      },
    })
  })

  it('rejects missing required numeric input', () => {
    expect(() =>
      parseCostEstimateArgs([
        '--provider',
        'deepseek',
        '--model',
        'deepseek-v4-flash',
        '--input-tokens',
        '1000',
      ]),
    ).toThrow('Missing required option: --output-tokens.')
  })

  it('rejects invalid token counts', () => {
    expect(() =>
      parseCostEstimateArgs([
        '--provider',
        'deepseek',
        '--model',
        'deepseek-v4-flash',
        '--input-tokens',
        '-1',
        '--output-tokens',
        '2000',
      ]),
    ).toThrow('--input-tokens must be a non-negative integer.')
  })

  it('rejects unsupported provider and model combinations', () => {
    expect(() =>
      parseCostEstimateArgs([
        '--provider',
        'openai',
        '--model',
        'deepseek-v4-flash',
        '--input-tokens',
        '1000',
        '--output-tokens',
        '2000',
      ]),
    ).toThrow(
      'Unsupported provider/model pricing: openai/deepseek-v4-flash. Available pricing: deepseek/deepseek-v4-flash, deepseek/deepseek-v4-pro, anthropic/claude-opus.',
    )
  })
})

describe('formatCostEstimate', () => {
  it('prints advisory provider, model, token, cost, currency, and warning details', () => {
    const output = formatCostEstimate({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      currency: 'USD',
      estimatedInputTokens: 1000,
      estimatedOutputTokens: 2000,
      estimatedTotalTokens: 3000,
      estimatedInputCost: 0.00015,
      estimatedOutputCost: 0.0012,
      estimatedTotalCost: 0.00135,
      advisory: true,
      basis: 'estimated-token-counts',
      warning:
        'Cost estimates are advisory and based on estimated token counts until real usage telemetry exists.',
    })

    expect(output).toBe(`Friday cost estimate
Advisory: yes
Provider: deepseek
Model: deepseek-v4-flash
Estimated input tokens: 1000
Estimated output tokens: 2000
Estimated total tokens: 3000
Estimated input cost: 0.000150 USD
Estimated output cost: 0.001200 USD
Estimated total cost: 0.001350 USD
Basis: estimated-token-counts
Warning: Cost estimates are advisory and based on estimated token counts until real usage telemetry exists.`)
  })
})
