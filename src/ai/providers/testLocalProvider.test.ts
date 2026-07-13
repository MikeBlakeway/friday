import { describe, expect, it } from 'vitest'

import {
  ModelProviderError,
  type GenerateModelResponseRequest,
  type GenerateModelResponseResult,
  type ModelProviderCapabilities,
} from './modelProvider.js'
import type { LmStudioProvider } from './lmStudioProvider.js'
import { testLocalProvider } from './testLocalProvider.js'

const capabilities: ModelProviderCapabilities = {
  provider: 'lm-studio',
  model: 'qwen/qwen3.6-35b-a3b',
  hosted: false,
  supportsStreaming: false,
  supportsToolCalls: false,
  supportedInputModalities: ['text'],
  supportedOutputModalities: ['text'],
  maxInputTokens: 8_000,
  maxOutputTokens: 2_000,
}

function successfulResponse(): GenerateModelResponseResult {
  return {
    provider: 'lm-studio',
    model: capabilities.model,
    message: {
      role: 'assistant',
      content: 'OK',
    },
    usage: {
      inputTokens: 21,
      outputTokens: 8,
      totalTokens: 29,
    },
    stopReason: 'complete',
  }
}

function outputLimitError(allowance: number): ModelProviderError {
  return new ModelProviderError(`No final content within ${allowance} tokens.`, {
    provider: capabilities.provider,
    model: capabilities.model,
    code: 'output-limit-exhausted',
    stopReason: 'length',
    usage: {
      inputTokens: 21,
      outputTokens: allowance,
      totalTokens: 21 + allowance,
    },
  })
}

function createProvider(
  responses: Array<GenerateModelResponseResult | Error>,
): LmStudioProvider & { requests: GenerateModelResponseRequest[] } {
  const requests: GenerateModelResponseRequest[] = []

  return {
    capabilities,
    requests,
    async checkAvailability() {
      return { available: true, message: 'LM Studio is available.' }
    },
    async generateResponse(request) {
      requests.push(request)
      const response = responses[requests.length - 1]

      if (response instanceof Error) {
        throw response
      }

      if (response === undefined) {
        throw new Error('Missing test response.')
      }

      return response
    },
  }
}

describe('testLocalProvider', () => {
  it('starts with a useful lightweight output allowance', async () => {
    const provider = createProvider([successfulResponse()])

    const result = await testLocalProvider(provider, 'friday-doctor')

    expect(provider.requests.map((request) => request.maxOutputTokens)).toEqual([64])
    expect(result.diagnostic).toEqual({
      attempts: 1,
      maxOutputTokens: 64,
      adaptiveRetry: false,
    })
  })

  it('increases the allowance when observed output-limit behavior needs more room', async () => {
    const provider = createProvider([
      outputLimitError(64),
      outputLimitError(256),
      successfulResponse(),
    ])

    const result = await testLocalProvider(provider, 'friday-doctor')

    expect(provider.requests.map((request) => request.maxOutputTokens)).toEqual([64, 256, 1_024])
    expect(result.diagnostic).toEqual({
      attempts: 3,
      maxOutputTokens: 1_024,
      adaptiveRetry: true,
    })
  })

  it('does not retry failures that a larger output allowance cannot safely fix', async () => {
    const reasoningOnly = new ModelProviderError('Reasoning-only response.', {
      provider: capabilities.provider,
      model: capabilities.model,
      code: 'reasoning-only',
      stopReason: 'complete',
    })
    const provider = createProvider([reasoningOnly, successfulResponse()])

    await expect(testLocalProvider(provider, 'friday-doctor')).rejects.toBe(reasoningOnly)
    expect(provider.requests.map((request) => request.maxOutputTokens)).toEqual([64])
  })

  it('stops after the bounded maximum allowance', async () => {
    const finalError = outputLimitError(1_024)
    const provider = createProvider([
      outputLimitError(64),
      outputLimitError(256),
      finalError,
      successfulResponse(),
    ])

    await expect(testLocalProvider(provider, 'friday-doctor')).rejects.toBe(finalError)
    expect(provider.requests.map((request) => request.maxOutputTokens)).toEqual([64, 256, 1_024])
  })
})
