export type AiTaskType =
  | 'brainstorm'
  | 'plan'
  | 'spec'
  | 'design'
  | 'build'
  | 'review'
  | 'refactor'
  | 'test'
  | 'ship'
  | 'ask'
  | 'escalate'

export type PrivacyLevel =
  | 'public'
  | 'internal'
  | 'private-repo'
  | 'sensitive'
  | 'secret'

export type TaskComplexity = 'low' | 'medium' | 'high'

export type ConfidenceRequirement = 'draft' | 'standard' | 'high'

export type CostPreference = 'minimise-cost' | 'balanced' | 'quality-first'

export type ModelProvider = 'none' | 'local' | 'deepseek' | 'openai' | 'anthropic'

export type ModelTier = 'none' | 'local' | 'cheap-hosted' | 'strong-hosted' | 'premium'

export type RecommendedModel =
  | 'none'
  | 'local-coder'
  | 'deepseek-v4-flash'
  | 'deepseek-v4-pro'
  | 'gpt-5'
  | 'gpt-5.5'
  | 'claude-opus'

export type RouteDecision =
  | 'no-ai-required'
  | 'use-local'
  | 'use-cheap-hosted'
  | 'use-strong-hosted'
  | 'use-premium'
  | 'blocked'

export interface RouteAiRequestInput {
  taskType: AiTaskType
  privacyLevel: PrivacyLevel
  complexity: TaskComplexity
  confidenceRequirement: ConfidenceRequirement
  costPreference: CostPreference
  allowHostedModels: boolean
  allowPremiumModels: boolean
}

export interface AiRoute {
  decision: RouteDecision
  provider: ModelProvider
  modelTier: ModelTier
  model: RecommendedModel
  reason: string
  requiresApproval: boolean
  blocked: boolean
}

export interface RouteAiRequestResult {
  route: AiRoute
  alternatives: AiRoute[]
  warnings: string[]
}
