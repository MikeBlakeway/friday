import { classifyPromptPrivacy } from '../privacy/classifyPromptPrivacy.js'
import type { PrivacyClassificationResult } from '../privacy/privacyClassification.js'
import type { RouteAiRequestInput, RouteAiRequestResult } from './modelRouting.js'
import { routeAiRequest } from './routeAiRequest.js'

export interface ComposeAiRouteRecommendationInput extends Omit<
  RouteAiRequestInput,
  'privacyLevel'
> {
  prompt: string
  filePath?: string
  declaredPrivacyLevel?: RouteAiRequestInput['privacyLevel']
}

export interface ComposeAiRouteRecommendationResult {
  classification: PrivacyClassificationResult
  routeInput: RouteAiRequestInput
  recommendation: RouteAiRequestResult
  warnings: string[]
}

export function composeAiRouteRecommendation(
  input: ComposeAiRouteRecommendationInput,
): ComposeAiRouteRecommendationResult {
  const classification = classifyPromptPrivacy({
    content: input.prompt,
    ...(input.filePath === undefined ? {} : { filePath: input.filePath }),
    ...(input.declaredPrivacyLevel === undefined
      ? {}
      : { declaredPrivacyLevel: input.declaredPrivacyLevel }),
  })
  const routeInput: RouteAiRequestInput = {
    taskType: input.taskType,
    privacyLevel: classification.privacyLevel,
    complexity: input.complexity,
    confidenceRequirement: input.confidenceRequirement,
    costPreference: input.costPreference,
    allowHostedModels: input.allowHostedModels,
    allowPremiumModels: input.allowPremiumModels,
  }
  const recommendation = routeAiRequest(routeInput)

  return {
    classification,
    routeInput,
    recommendation,
    warnings: [...new Set([classification.reason, ...recommendation.warnings])],
  }
}
