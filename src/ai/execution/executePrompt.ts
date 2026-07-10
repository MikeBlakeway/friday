import path from 'node:path'

import { estimateAiUsageCost } from '../pricing/estimateAiUsageCost.js'
import { findPricing } from '../pricing/advisoryPricing.js'
import type { AiUsageCostEstimate } from '../pricing/pricingModel.js'
import type { PrivacyClassificationResult } from '../privacy/privacyClassification.js'
import { composeAiRouteRecommendation } from '../routing/composeAiRouteRecommendation.js'
import type { AiRoute, AiTaskType, RouteAiRequestResult } from '../routing/modelRouting.js'
import type {
  AiModelProvider,
  GenerateModelResponseRequest,
  GenerateModelResponseResult,
} from '../providers/modelProvider.js'
import { appendExecutionLogRecord, createExecutionLogRecord } from '../usage/executionLog.js'
import { ensureDir, readTextFile, writeTextFile } from '../../core/fileSystem.js'

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
  temperature: number
}

export interface ExecutePromptOptions {
  request: ExecutePromptRequest
  projectRoot: string
  modelProvider: AvailableLocalModelProvider
  now?: () => Date
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
    throw new Error('Local provider returned malformed output: assistant message is missing.')
  }

  if (result.message.content.trim().length === 0) {
    throw new Error('Local provider returned malformed output: assistant content is empty.')
  }
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
  assertLocalProvider(options.request, options.modelProvider)

  const prompt = await readTextFile(options.request.promptPath)
  const promptArtifact = relativeToProject(options.projectRoot, options.request.promptPath)
  const executionStartedAt = options.now?.() ?? new Date()
  const routeSummary = composeAiRouteRecommendation({
    prompt,
    filePath: options.request.promptPath,
    taskType: options.request.taskType,
    complexity: 'high',
    confidenceRequirement: 'standard',
    costPreference: 'balanced',
    allowHostedModels: false,
    allowPremiumModels: false,
  })

  assertSafeToExecute(routeSummary)
  await assertProviderAvailable(options.modelProvider)

  const providerResult = await options.modelProvider.generateResponse(
    buildModelRequest(options.request, prompt, routeSummary.classification, promptArtifact),
  )
  assertValidProviderResult(providerResult)

  const executionCompletedAt = options.now?.() ?? new Date()
  const resultArtifactPath = inferResultArtifactPath(
    options.request.promptPath,
    executionCompletedAt,
  )
  const costEstimate = estimateAiUsageCost({
    pricing: findPricing('local', 'local-coder'),
    usage: {
      estimatedInputTokens: estimateInputTokens(prompt),
      estimatedOutputTokens: options.request.maxOutputTokens,
    },
  })
  const result: ExecutePromptResult = {
    request: options.request,
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
      startedAt: executionStartedAt.toISOString(),
      completedAt: executionCompletedAt.toISOString(),
      latencyMs: Math.max(0, executionCompletedAt.getTime() - executionStartedAt.getTime()),
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
    }),
  )

  return result
}
