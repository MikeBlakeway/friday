import { estimateAiUsageCost } from '../../ai/pricing/estimateAiUsageCost.js'
import type { AiUsageCostEstimate } from '../../ai/pricing/pricingModel.js'
import { findPricing } from '../../ai/pricing/advisoryPricing.js'
import { composeAiRouteRecommendation } from '../../ai/routing/composeAiRouteRecommendation.js'
import type {
  AiTaskType,
  ConfidenceRequirement,
  CostPreference,
  PrivacyLevel,
  TaskComplexity,
} from '../../ai/routing/modelRouting.js'

export interface AiWorkflowSummary {
  routeSummary: ReturnType<typeof composeAiRouteRecommendation>
  costEstimate?: AiUsageCostEstimate
  estimatedInputTokens: number
  estimatedOutputTokens: number
}

export interface BuildAiWorkflowSummaryInput {
  prompt: string
  taskType: AiTaskType
  complexity: TaskComplexity
  confidenceRequirement: ConfidenceRequirement
  costPreference: CostPreference
  estimatedOutputTokens: number
  declaredPrivacyLevel?: PrivacyLevel
}

function estimateInputTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4))
}

function formatMoney(value: number, currency: string): string {
  return `${value.toFixed(6)} ${currency}`
}

export function buildAiWorkflowSummary(input: BuildAiWorkflowSummaryInput): AiWorkflowSummary {
  const routeSummary = composeAiRouteRecommendation({
    prompt: input.prompt,
    taskType: input.taskType,
    complexity: input.complexity,
    confidenceRequirement: input.confidenceRequirement,
    costPreference: input.costPreference,
    allowHostedModels: true,
    allowPremiumModels: false,
    ...(input.declaredPrivacyLevel === undefined
      ? {}
      : { declaredPrivacyLevel: input.declaredPrivacyLevel }),
  })
  const route = routeSummary.recommendation.route
  const estimatedInputTokens = estimateInputTokens(input.prompt)

  if (route.blocked) {
    return {
      routeSummary,
      estimatedInputTokens,
      estimatedOutputTokens: input.estimatedOutputTokens,
    }
  }

  const pricing = findPricing(route.provider, route.model)

  return {
    routeSummary,
    costEstimate: estimateAiUsageCost({
      pricing,
      usage: {
        estimatedInputTokens,
        estimatedOutputTokens: input.estimatedOutputTokens,
      },
    }),
    estimatedInputTokens,
    estimatedOutputTokens: input.estimatedOutputTokens,
  }
}

export function printAiWorkflowSummary(summary: AiWorkflowSummary): void {
  const { classification } = summary.routeSummary
  const { route } = summary.routeSummary.recommendation

  console.log('AI policy:')
  console.log(`Privacy level: ${classification.privacyLevel}`)
  console.log(`Blocked: ${route.blocked ? 'yes' : 'no'}`)
  console.log(`Route decision: ${route.decision}`)
  console.log(`Provider/model: ${route.provider}/${route.model}`)
  console.log(`Model tier: ${route.modelTier}`)
  console.log(`Route reason: ${route.reason}`)
  console.log('Warnings:')
  for (const warning of summary.routeSummary.warnings) {
    console.log(`- ${warning}`)
  }
  console.log('')
  console.log('Estimated cost:')

  if (summary.costEstimate === undefined) {
    console.log('Not estimated because the route is blocked.')
    console.log(`Estimated input tokens: ${summary.estimatedInputTokens}`)
    console.log(`Estimated output tokens: ${summary.estimatedOutputTokens}`)
    return
  }

  console.log(`Provider: ${summary.costEstimate.provider}`)
  console.log(`Model: ${summary.costEstimate.model}`)
  console.log(`Estimated input tokens: ${summary.costEstimate.estimatedInputTokens}`)
  console.log(`Estimated output tokens: ${summary.costEstimate.estimatedOutputTokens}`)
  console.log(`Estimated total tokens: ${summary.costEstimate.estimatedTotalTokens}`)
  console.log(
    `Estimated total cost: ${formatMoney(
      summary.costEstimate.estimatedTotalCost,
      summary.costEstimate.currency,
    )}`,
  )
  console.log(`Advisory: ${summary.costEstimate.warning}`)
}
