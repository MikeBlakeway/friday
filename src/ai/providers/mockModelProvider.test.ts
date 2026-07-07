import { describe, expect, it } from 'vitest'

import { createMockModelProvider } from './mockModelProvider.js'
import type { GenerateModelResponseRequest, ModelProviderCapabilities } from './modelProvider.js'

const capabilities: ModelProviderCapabilities = {
  provider: 'mock',
  model: 'mock-reasoner',
  hosted: false,
  supportsStreaming: false,
  supportsToolCalls: true,
  supportedInputModalities: ['text'],
  supportedOutputModalities: ['text', 'json'],
  maxInputTokens: 8_000,
  maxOutputTokens: 2_000,
}

function createRequest(
  overrides: Partial<GenerateModelResponseRequest> = {},
): GenerateModelResponseRequest {
  return {
    taskType: 'plan',
    privacyLevel: 'private-repo',
    messages: [
      {
        role: 'user',
        content: 'Draft a small implementation plan.',
      },
    ],
    output: {
      modality: 'text',
    },
    ...overrides,
  }
}

describe('createMockModelProvider', () => {
  it('exposes provider capability metadata without network configuration', () => {
    const provider = createMockModelProvider({
      capabilities,
      responseText: 'Use the local provider contract.',
    })

    expect(provider.capabilities).toEqual(capabilities)
  })

  it('returns a typed model response and records typed requests', async () => {
    const provider = createMockModelProvider({
      capabilities,
      responseText: 'Use the local provider contract.',
      usage: {
        inputTokens: 12,
        outputTokens: 7,
      },
    })

    const request = createRequest()
    const response = await provider.generateResponse(request)

    expect(response).toMatchObject({
      provider: 'mock',
      model: 'mock-reasoner',
      message: {
        role: 'assistant',
        content: 'Use the local provider contract.',
      },
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
      },
      stopReason: 'complete',
    })
    expect(provider.requests).toEqual([request])
  })
})
