export interface ModelPricingConfiguration {
  provider: string
  model: string
  currency: string
  inputTokenPricePerMillion: number
  outputTokenPricePerMillion: number
  source?: string
  effectiveDate?: string
  notes?: string
}

export interface EstimatedTokenUsage {
  estimatedInputTokens: number
  estimatedOutputTokens: number
}

export interface EstimateAiUsageCostInput {
  pricing: ModelPricingConfiguration
  usage: EstimatedTokenUsage
}

export interface AiUsageCostEstimate {
  provider: string
  model: string
  currency: string
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  estimatedInputCost: number
  estimatedOutputCost: number
  estimatedTotalCost: number
  advisory: true
  basis: 'estimated-token-counts'
  warning: string
}
