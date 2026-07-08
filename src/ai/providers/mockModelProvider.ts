import type {
  AiModelProvider,
  GenerateModelResponseRequest,
  GenerateModelResponseResult,
  ModelProviderCapabilities,
  ModelStopReason,
} from './modelProvider.js'

export interface CreateMockModelProviderInput {
  capabilities: ModelProviderCapabilities
  responseText: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  stopReason?: ModelStopReason
}

export interface MockModelProvider extends AiModelProvider {
  requests: GenerateModelResponseRequest[]
}

function createUsage(input: CreateMockModelProviderInput['usage']) {
  const inputTokens = input?.inputTokens ?? 0
  const outputTokens = input?.outputTokens ?? 0

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

export function createMockModelProvider(input: CreateMockModelProviderInput): MockModelProvider {
  const requests: GenerateModelResponseRequest[] = []

  return {
    capabilities: input.capabilities,
    requests,
    async generateResponse(
      request: GenerateModelResponseRequest,
    ): Promise<GenerateModelResponseResult> {
      requests.push(request)

      return {
        provider: input.capabilities.provider,
        model: input.capabilities.model,
        message: {
          role: 'assistant',
          content: input.responseText,
        },
        usage: createUsage(input.usage),
        stopReason: input.stopReason ?? 'complete',
      }
    },
  }
}
