import type {
  AiRoute,
  ModelProvider,
  ModelTier,
  RecommendedModel,
  RouteAiRequestInput,
  RouteAiRequestResult,
  RouteDecision,
} from './modelRouting.js'

function createRoute(
  decision: RouteDecision,
  provider: ModelProvider,
  modelTier: ModelTier,
  model: RecommendedModel,
  reason: string,
  requiresApproval = false,
  blocked = false,
): AiRoute {
  return {
    decision,
    provider,
    modelTier,
    model,
    reason,
    requiresApproval,
    blocked,
  }
}

function createResult(
  route: AiRoute,
  alternatives: AiRoute[] = [],
  warnings: string[] = [],
): RouteAiRequestResult {
  return { route, alternatives, warnings }
}

function createCheapHostedRoute(reason: string): AiRoute {
  return createRoute('use-cheap-hosted', 'deepseek', 'cheap-hosted', 'deepseek-v4-flash', reason)
}

function createStrongHostedRoute(reason: string): AiRoute {
  return createRoute('use-strong-hosted', 'deepseek', 'strong-hosted', 'deepseek-v4-pro', reason)
}

function createPremiumRoute(reason: string): AiRoute {
  return createRoute('use-premium', 'anthropic', 'premium', 'claude-opus', reason, true)
}

function createCheapHostedResult(reason: string): RouteAiRequestResult {
  return createResult(createCheapHostedRoute(reason), [
    createStrongHostedRoute('A stronger hosted route is available if more reasoning is needed.'),
  ])
}

function createStrongHostedResult(
  reason: string,
  allowPremiumModels: boolean,
  warnings: string[] = [],
): RouteAiRequestResult {
  const alternatives = [
    createCheapHostedRoute('A cheaper hosted route is available for lower-risk work.'),
  ]

  if (allowPremiumModels) {
    alternatives.push(
      createPremiumRoute('A premium route is available when the task earns escalation.'),
    )
  }

  return createResult(createStrongHostedRoute(reason), alternatives, warnings)
}

function createPremiumResult(reason: string): RouteAiRequestResult {
  return createResult(createPremiumRoute(reason), [
    createStrongHostedRoute(
      'A strong hosted route is available when premium escalation is not needed.',
    ),
    createCheapHostedRoute('A cheaper hosted route is available for lower-risk work.'),
  ])
}

function requiresPremiumEscalation(input: RouteAiRequestInput): boolean {
  return (
    input.complexity === 'high' &&
    input.confidenceRequirement === 'high' &&
    input.costPreference === 'quality-first'
  )
}

function isHighComplexityHighConfidence(input: RouteAiRequestInput): boolean {
  return input.complexity === 'high' && input.confidenceRequirement === 'high'
}

function isStrongHostedTask(input: RouteAiRequestInput): boolean {
  return ['plan', 'spec', 'review', 'refactor', 'build'].includes(input.taskType)
}

function createLocalResult(input: RouteAiRequestInput): RouteAiRequestResult {
  const warnings: string[] = []

  if (input.privacyLevel === 'sensitive') {
    warnings.push('Sensitive context is being kept local.')
  }

  if (input.complexity === 'high' || input.confidenceRequirement === 'high') {
    warnings.push(
      'The local route may be insufficient for high-complexity or high-confidence work.',
    )
  }

  const reason =
    input.privacyLevel === 'sensitive'
      ? 'Sensitive context is routed to a local model by default.'
      : 'Hosted models are disabled, so the task is routed to a local model.'

  return createResult(
    createRoute('use-local', 'local', 'local', 'local-coder', reason),
    [],
    warnings,
  )
}

export function routeAiRequest(input: RouteAiRequestInput): RouteAiRequestResult {
  if (input.privacyLevel === 'secret') {
    return createResult(
      createRoute(
        'blocked',
        'none',
        'none',
        'none',
        'Secret context cannot be routed to an AI model.',
        false,
        true,
      ),
      [],
      ['Secret context must never be sent to AI models.'],
    )
  }

  if (!input.allowHostedModels || input.privacyLevel === 'sensitive') {
    return createLocalResult(input)
  }

  if (input.taskType === 'escalate') {
    if (input.allowPremiumModels) {
      return createPremiumResult('Premium escalation was explicitly requested for this task.')
    }

    return createStrongHostedResult(
      'Escalation needs a strong hosted route because premium models are disabled.',
      input.allowPremiumModels,
      ['Escalation was requested but premium models are disabled.'],
    )
  }

  if (requiresPremiumEscalation(input)) {
    if (input.allowPremiumModels) {
      return createPremiumResult(
        'High-complexity, high-confidence quality-first work earns a premium route.',
      )
    }

    return createStrongHostedResult(
      'A strong hosted route is recommended because premium models are not allowed.',
      input.allowPremiumModels,
      ['Premium escalation would normally be considered but premium models are not allowed.'],
    )
  }

  if (input.complexity === 'low' && input.confidenceRequirement === 'draft') {
    return createCheapHostedResult('Low-complexity draft work can use a cheaper hosted model.')
  }

  if (input.costPreference === 'minimise-cost' && !isHighComplexityHighConfidence(input)) {
    return createCheapHostedResult('The minimise-cost preference selects a cheaper hosted model.')
  }

  if (isStrongHostedTask(input)) {
    return createStrongHostedResult(
      'This task type benefits from a strong hosted model by default.',
      input.allowPremiumModels,
    )
  }

  return createStrongHostedResult(
    'The hosted-safe fallback selects a strong model for balanced or quality-first work.',
    input.allowPremiumModels,
  )
}
