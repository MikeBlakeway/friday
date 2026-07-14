/**
 * Canonical routing values. Runtime consumers such as execution-log validation
 * must use these rather than copying the corresponding TypeScript unions.
 */
export const AI_TASK_TYPES = [
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
] as const

export type AiTaskType = (typeof AI_TASK_TYPES)[number]

export const PRIVACY_LEVELS = ['public', 'internal', 'private-repo', 'sensitive', 'secret'] as const

export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number]

export type TaskComplexity = 'low' | 'medium' | 'high'

export type ConfidenceRequirement = 'draft' | 'standard' | 'high'

export type CostPreference = 'minimise-cost' | 'balanced' | 'quality-first'

export const MODEL_PROVIDERS = ['none', 'local', 'deepseek', 'openai', 'anthropic'] as const

export type ModelProvider = (typeof MODEL_PROVIDERS)[number]

export const MODEL_TIERS = ['none', 'local', 'cheap-hosted', 'strong-hosted', 'premium'] as const

export type ModelTier = (typeof MODEL_TIERS)[number]

export const RECOMMENDED_MODELS = [
  'none',
  'local-coder',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'gpt-5',
  'gpt-5.5',
  'claude-opus',
] as const

export type RecommendedModel = (typeof RECOMMENDED_MODELS)[number]

export const ROUTE_DECISIONS = [
  'no-ai-required',
  'use-local',
  'use-cheap-hosted',
  'use-strong-hosted',
  'use-premium',
  'blocked',
] as const

export type RouteDecision = (typeof ROUTE_DECISIONS)[number]

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
