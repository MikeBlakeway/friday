import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { estimateAiUsageCost } from '../pricing/estimateAiUsageCost.js'
import { findPricing } from '../pricing/advisoryPricing.js'
import type { AiUsageCostEstimate } from '../pricing/pricingModel.js'
import type { PrivacyClassificationResult } from '../privacy/privacyClassification.js'
import { composeAiRouteRecommendation } from '../routing/composeAiRouteRecommendation.js'
import type { ComposeAiRouteRecommendationResult } from '../routing/composeAiRouteRecommendation.js'
import type { AiRoute, AiTaskType, RouteAiRequestResult } from '../routing/modelRouting.js'
import { ModelProviderError } from '../providers/modelProvider.js'
import type {
  AiModelProvider,
  GenerateModelResponseRequest,
  GenerateModelResponseResult,
  ModelTokenUsage,
} from '../providers/modelProvider.js'
import { appendExecutionLogRecord, createExecutionLogRecord } from '../usage/executionLog.js'
import { ensureDir, readTextFile, writeTextFile } from '../../core/fileSystem.js'

const executionPhaseLabels = {
  promptBuild: 'Prompt build',
  privacyClassification: 'Privacy classification',
  providerRouting: 'Provider routing',
  modelExecution: 'Model execution',
  outputWriting: 'Output writing',
} as const

export type ExecutionProviderChoice = 'local'

export interface LocalProviderAvailability {
  available: boolean
  message: string
}

export interface AvailableLocalModelProvider extends AiModelProvider {
  checkAvailability?: () => Promise<LocalProviderAvailability>
}

export interface ExecutePromptRequest {
  promptPath: string
  provider: ExecutionProviderChoice
  taskType: AiTaskType
  maxOutputTokens: number
  maxOutputTokensExplicit?: true
  temperature: number
}

export type AdaptiveRetryPolicy =
  | { enabled: true; maxOutputTokens: number }
  | { enabled: false; reason: string }

export interface OutputTokenAllowance {
  estimatedInputTokens: number
  effectiveMaxOutputTokens: number
  contextWindowTokens?: number
  availableOutputTokens?: number
  retry: AdaptiveRetryPolicy
}

export interface ExecutePromptOptions {
  request: ExecutePromptRequest
  projectRoot: string
  modelProvider: AvailableLocalModelProvider
  now?: () => Date
  preparedExecution?: PreparedPromptExecution
  statusReporter?: ExecutionStatusReporter
}

export interface ExecutionStatusReporter {
  start(message: string): void
  success(message?: string): void
  warn(message: string): void
  fail(message?: string): void
}

export interface PreparedPromptExecution {
  prompt: string
  promptArtifact: string
  routeSummary: ComposeAiRouteRecommendationResult
  costEstimate: AiUsageCostEstimate
  tokenAllowance: OutputTokenAllowance
}

export interface ExecutePromptResult {
  request: ExecutePromptRequest
  promptArtifact: string
  resultArtifact: string
  provider: string
  model: string
  classification: PrivacyClassificationResult
  route: AiRoute
  warnings: string[]
  usage: GenerateModelResponseResult['usage']
  stopReason: GenerateModelResponseResult['stopReason']
  message: GenerateModelResponseResult['message']
  costEstimate: AiUsageCostEstimate
}

function estimateInputTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4))
}

async function withExecutionStatusPhase<T>(
  reporter: ExecutionStatusReporter | undefined,
  message: string,
  action: () => T | Promise<T>,
): Promise<T> {
  reporter?.start(message)

  try {
    const result = await action()
    reporter?.success()
    return result
  } catch (error) {
    reporter?.fail()
    throw error
  }
}

function minimumDefined(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length === 0 ? undefined : Math.min(...defined)
}

function calculateOutputTokenAllowance(input: {
  request: ExecutePromptRequest
  prompt: string
  modelProvider: AiModelProvider
}): OutputTokenAllowance {
  const estimatedInputTokens = estimateInputTokens(input.prompt)
  const { maxInputTokens, maxOutputTokens, contextWindowTokens } = input.modelProvider.capabilities

  if (maxInputTokens !== undefined && estimatedInputTokens > maxInputTokens) {
    throw new Error(
      `Estimated input is ${estimatedInputTokens} tokens, exceeding the known provider input limit of ${maxInputTokens} tokens. Shorten the prompt or configure a larger model context.`,
    )
  }

  const contextHeadroom =
    contextWindowTokens === undefined ? undefined : contextWindowTokens - estimatedInputTokens

  if (contextHeadroom !== undefined && contextHeadroom < 1) {
    throw new Error(
      `Estimated input is ${estimatedInputTokens} tokens, leaving no output headroom in the known ${contextWindowTokens}-token context window. Shorten the prompt or configure a larger context window.`,
    )
  }

  const availableOutputTokens = minimumDefined(contextHeadroom, maxOutputTokens)

  if (contextHeadroom !== undefined && input.request.maxOutputTokens > contextHeadroom) {
    throw new Error(
      `Requested ${input.request.maxOutputTokens} output tokens cannot fit: estimated input is ${estimatedInputTokens} tokens and the known context window is ${contextWindowTokens} tokens, leaving ${contextHeadroom} tokens of output headroom. Lower --max-output-tokens, shorten the prompt, or configure a larger context window.`,
    )
  }

  if (maxOutputTokens !== undefined && input.request.maxOutputTokens > maxOutputTokens) {
    throw new Error(
      `Requested ${input.request.maxOutputTokens} output tokens exceeds the known provider/model output limit of ${maxOutputTokens} tokens. Lower --max-output-tokens or configure an appropriate model limit.`,
    )
  }

  let retry: AdaptiveRetryPolicy
  if (input.request.maxOutputTokensExplicit) {
    retry = { enabled: false, reason: 'an explicit --max-output-tokens ceiling was provided' }
  } else if (
    availableOutputTokens !== undefined &&
    availableOutputTokens > input.request.maxOutputTokens
  ) {
    retry = {
      enabled: true,
      maxOutputTokens: Math.min(input.request.maxOutputTokens * 2, availableOutputTokens),
    }
  } else if (availableOutputTokens === undefined) {
    retry = { enabled: false, reason: 'provider/model limits are unknown' }
  } else {
    retry = { enabled: false, reason: 'no additional known output headroom is available' }
  }

  return {
    estimatedInputTokens,
    effectiveMaxOutputTokens: input.request.maxOutputTokens,
    ...(contextWindowTokens === undefined ? {} : { contextWindowTokens }),
    ...(availableOutputTokens === undefined ? {} : { availableOutputTokens }),
    retry,
  }
}

function estimateExecutionCost(
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): AiUsageCostEstimate {
  return estimateAiUsageCost({
    pricing: findPricing('local', 'local-coder'),
    usage: { estimatedInputTokens, estimatedOutputTokens },
  })
}

function relativeToProject(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/')
}

function inferResultArtifactPath(promptPath: string, now: Date): string {
  const promptDirPath = path.dirname(promptPath)
  const promptBaseName = path.basename(promptPath, path.extname(promptPath))
  const timestamp = now.toISOString().replace(/[:.]/g, '-')

  return path.join(promptDirPath, 'executions', `${promptBaseName}-${timestamp}.json`)
}

function assertLocalProvider(request: ExecutePromptRequest, provider: AiModelProvider): void {
  if (request.provider !== 'local') {
    throw new Error('Friday execute currently supports only --provider local.')
  }

  if (provider.capabilities.hosted) {
    throw new Error('Friday execute requires a local provider. Hosted providers are out of scope.')
  }

  if (!provider.capabilities.supportedOutputModalities.includes('text')) {
    throw new Error('Friday execute requires a local provider that supports text output.')
  }
}

async function assertProviderAvailable(provider: AvailableLocalModelProvider): Promise<void> {
  if (provider.checkAvailability === undefined) {
    return
  }

  const availability = await provider.checkAvailability()

  if (!availability.available) {
    throw new Error(`Local provider unavailable: ${availability.message}`)
  }
}

function assertSafeToExecute(result: {
  classification: PrivacyClassificationResult
  recommendation: RouteAiRequestResult
}): void {
  if (result.classification.blocked || result.classification.privacyLevel === 'secret') {
    throw new Error(
      `Friday execute blocked this prompt before provider invocation: ${result.classification.reason}`,
    )
  }

  if (result.recommendation.route.blocked) {
    throw new Error(
      `Friday execute blocked this prompt before provider invocation: ${result.recommendation.route.reason}`,
    )
  }

  if (result.recommendation.route.provider !== 'local') {
    throw new Error(
      `Friday execute expected a local route but selected ${result.recommendation.route.provider}.`,
    )
  }
}

function assertValidProviderResult(result: GenerateModelResponseResult): void {
  if (result.message.role !== 'assistant') {
    throw new ModelProviderError(
      `Local provider ${result.provider}/${result.model} returned malformed output: assistant message is missing.`,
      {
        provider: result.provider,
        model: result.model,
        code: 'malformed-response',
        stopReason: result.stopReason,
        usage: result.usage,
      },
    )
  }

  if (result.message.content.trim().length === 0) {
    throw new ModelProviderError(
      `Local provider ${result.provider}/${result.model} returned empty assistant content (finish reason: ${result.stopReason}; usage: ${result.usage.inputTokens} input, ${result.usage.outputTokens} output, ${result.usage.totalTokens} total tokens).`,
      {
        provider: result.provider,
        model: result.model,
        code: result.stopReason === 'length' ? 'output-limit-exhausted' : 'empty-content',
        stopReason: result.stopReason,
        usage: result.usage,
      },
    )
  }
}

function zeroUsage(): ModelTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  }
}

async function recordFailedProviderExecution(input: {
  options: ExecutePromptOptions
  promptArtifact: string
  routeSummary: ComposeAiRouteRecommendationResult
  costEstimate: AiUsageCostEstimate
  startedAt: Date
  completedAt: Date
  error: unknown
  workflowExecutionId: string
  attempt: number
}): Promise<void> {
  const providerError = input.error instanceof ModelProviderError ? input.error : undefined
  const provider = providerError?.provider ?? input.options.modelProvider.capabilities.provider
  const model =
    providerError?.model === undefined || providerError.model === 'unknown'
      ? input.options.modelProvider.capabilities.model
      : providerError.model
  const timestamp = input.completedAt.toISOString().replace(/[:.]/g, '-')

  await appendExecutionLogRecord(
    input.options.projectRoot,
    createExecutionLogRecord({
      id: `${input.promptArtifact}#provider-failure-${input.attempt}-${timestamp}`,
      workflow: {
        type: input.options.request.taskType,
        artifact: input.promptArtifact,
      },
      recommendedRoute: input.routeSummary.recommendation.route,
      chosenRoute: input.routeSummary.recommendation.route,
      provider,
      model,
      startedAt: input.startedAt.toISOString(),
      completedAt: input.completedAt.toISOString(),
      latencyMs: Math.max(0, input.completedAt.getTime() - input.startedAt.getTime()),
      usage: providerError?.usage ?? zeroUsage(),
      costEstimate: input.costEstimate,
      result: {
        status: 'failed',
        ...(providerError?.stopReason === undefined
          ? {}
          : { stopReason: providerError.stopReason }),
        errorCode: providerError?.code ?? 'provider-error',
      },
      privacy: {
        privacyLevel: input.routeSummary.classification.privacyLevel,
        blocked: input.routeSummary.classification.blocked,
        secretDetected: input.routeSummary.classification.secrets.length > 0,
      },
      providerAttempt: {
        workflowExecutionId: input.workflowExecutionId,
        attempt: input.attempt,
        adaptiveRetry: input.attempt > 1,
      },
    }),
  )
}

function buildModelRequest(
  request: ExecutePromptRequest,
  prompt: string,
  classification: PrivacyClassificationResult,
  promptArtifact: string,
): GenerateModelResponseRequest {
  return {
    taskType: request.taskType,
    privacyLevel: classification.privacyLevel,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    output: {
      modality: 'text',
    },
    maxOutputTokens: request.maxOutputTokens,
    temperature: request.temperature,
    metadata: {
      promptArtifact,
      executionBoundary: 'explicit-local',
    },
  }
}

function createArtifactJson(result: ExecutePromptResult): string {
  return `${JSON.stringify(
    {
      request: {
        ...result.request,
        promptPath: result.promptArtifact,
      },
      promptArtifact: result.promptArtifact,
      provider: result.provider,
      model: result.model,
      classification: result.classification,
      route: result.route,
      warnings: result.warnings,
      usage: result.usage,
      stopReason: result.stopReason,
      costEstimate: result.costEstimate,
      message: result.message,
    },
    null,
    2,
  )}\n`
}

export async function executePrompt(options: ExecutePromptOptions): Promise<ExecutePromptResult> {
  const preparedExecution =
    options.preparedExecution ??
    (await preparePromptExecution({
      request: options.request,
      projectRoot: options.projectRoot,
      modelProvider: options.modelProvider,
      ...(options.statusReporter === undefined ? {} : { statusReporter: options.statusReporter }),
    }))
  const { prompt, promptArtifact, routeSummary, tokenAllowance } = preparedExecution
  const executionStartedAt = options.now?.() ?? new Date()
  const workflowExecutionId = randomUUID()

  let providerResult: GenerateModelResponseResult
  let effectiveRequest: ExecutePromptRequest = {
    ...options.request,
    maxOutputTokens: tokenAllowance.effectiveMaxOutputTokens,
  }
  let costEstimate = preparedExecution.costEstimate
  let attempt = 1
  let attemptStartedAt = executionStartedAt

  options.statusReporter?.start(executionPhaseLabels.modelExecution)

  while (true) {
    try {
      providerResult = await options.modelProvider.generateResponse(
        buildModelRequest(effectiveRequest, prompt, routeSummary.classification, promptArtifact),
      )
      assertValidProviderResult(providerResult)
      options.statusReporter?.success()
      break
    } catch (error) {
      const attemptCompletedAt = options.now?.() ?? new Date()

      try {
        await recordFailedProviderExecution({
          options,
          promptArtifact,
          routeSummary,
          costEstimate,
          startedAt: attemptStartedAt,
          completedAt: attemptCompletedAt,
          error,
          workflowExecutionId,
          attempt,
        })
      } catch (recordingError) {
        options.statusReporter?.fail()
        throw recordingError
      }

      const canRetry =
        attempt === 1 &&
        tokenAllowance.retry.enabled &&
        error instanceof ModelProviderError &&
        error.code === 'output-limit-exhausted'

      if (!canRetry) {
        options.statusReporter?.fail()
        throw error
      }

      if (!tokenAllowance.retry.enabled) {
        options.statusReporter?.fail()
        throw error
      }

      effectiveRequest = {
        ...effectiveRequest,
        maxOutputTokens: tokenAllowance.retry.maxOutputTokens,
      }
      costEstimate = estimateExecutionCost(
        tokenAllowance.estimatedInputTokens,
        effectiveRequest.maxOutputTokens,
      )
      attempt += 1
      attemptStartedAt = attemptCompletedAt
      options.statusReporter?.warn('Model execution reached the output limit; retrying once')
      options.statusReporter?.start(executionPhaseLabels.modelExecution)
    }
  }

  const executionCompletedAt = options.now?.() ?? new Date()
  const resultArtifactPath = inferResultArtifactPath(
    options.request.promptPath,
    executionCompletedAt,
  )
  const result: ExecutePromptResult = {
    request: effectiveRequest,
    promptArtifact,
    resultArtifact: relativeToProject(options.projectRoot, resultArtifactPath),
    provider: providerResult.provider,
    model: providerResult.model,
    classification: routeSummary.classification,
    route: routeSummary.recommendation.route,
    warnings: routeSummary.warnings,
    usage: providerResult.usage,
    stopReason: providerResult.stopReason,
    message: providerResult.message,
    costEstimate,
  }

  await withExecutionStatusPhase(
    options.statusReporter,
    executionPhaseLabels.outputWriting,
    async () => {
      await ensureDir(path.dirname(resultArtifactPath))
      await writeTextFile(resultArtifactPath, createArtifactJson(result))
      await appendExecutionLogRecord(
        options.projectRoot,
        createExecutionLogRecord({
          id: result.resultArtifact,
          workflow: {
            type: options.request.taskType,
            artifact: promptArtifact,
          },
          recommendedRoute: routeSummary.recommendation.route,
          chosenRoute: result.route,
          provider: result.provider,
          model: result.model,
          startedAt: attemptStartedAt.toISOString(),
          completedAt: executionCompletedAt.toISOString(),
          latencyMs: Math.max(0, executionCompletedAt.getTime() - attemptStartedAt.getTime()),
          usage: result.usage,
          costEstimate: result.costEstimate,
          result: {
            status: 'succeeded',
            stopReason: result.stopReason,
            artifact: result.resultArtifact,
          },
          privacy: {
            privacyLevel: result.classification.privacyLevel,
            blocked: result.classification.blocked,
            secretDetected: result.classification.secrets.length > 0,
          },
          providerAttempt: {
            workflowExecutionId,
            attempt,
            adaptiveRetry: attempt > 1,
          },
        }),
      )
    },
  )

  return result
}

export async function preparePromptExecution(options: {
  request: ExecutePromptRequest
  projectRoot: string
  modelProvider: AvailableLocalModelProvider
  statusReporter?: ExecutionStatusReporter
}): Promise<PreparedPromptExecution> {
  assertLocalProvider(options.request, options.modelProvider)

  const prompt = await withExecutionStatusPhase(
    options.statusReporter,
    executionPhaseLabels.promptBuild,
    () => readTextFile(options.request.promptPath),
  )
  const promptArtifact = relativeToProject(options.projectRoot, options.request.promptPath)
  const routeSummary = await withExecutionStatusPhase(
    options.statusReporter,
    executionPhaseLabels.privacyClassification,
    () =>
      composeAiRouteRecommendation({
        prompt,
        filePath: options.request.promptPath,
        taskType: options.request.taskType,
        complexity: 'high',
        confidenceRequirement: 'standard',
        costPreference: 'balanced',
        allowHostedModels: false,
        allowPremiumModels: false,
      }),
  )

  const tokenAllowance = await withExecutionStatusPhase(
    options.statusReporter,
    executionPhaseLabels.providerRouting,
    async () => {
      assertSafeToExecute(routeSummary)
      await assertProviderAvailable(options.modelProvider)
      return calculateOutputTokenAllowance({
        request: options.request,
        prompt,
        modelProvider: options.modelProvider,
      })
    },
  )

  return {
    prompt,
    promptArtifact,
    routeSummary,
    tokenAllowance,
    costEstimate: estimateExecutionCost(
      tokenAllowance.estimatedInputTokens,
      tokenAllowance.effectiveMaxOutputTokens,
    ),
  }
}
