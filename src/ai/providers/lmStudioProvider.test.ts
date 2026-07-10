import { describe, expect, it } from 'vitest'

import {
  createLmStudioProvider,
  defaultLmStudioBaseUrl,
  defaultLmStudioModel,
  LmStudioProviderError,
  type LmStudioFetch,
} from './lmStudioProvider.js'
import type { GenerateModelResponseRequest } from './modelProvider.js'

function createRequest(
  overrides: Partial<GenerateModelResponseRequest> = {},
): GenerateModelResponseRequest {
  return {
    taskType: 'plan',
    privacyLevel: 'private-repo',
    messages: [
      {
        role: 'user',
        content: 'Draft a local-only implementation plan.',
      },
    ],
    output: {
      modality: 'text',
    },
    maxOutputTokens: 128,
    temperature: 0.2,
    ...overrides,
  }
}

function createResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    async json() {
      return body
    },
  }
}

function createFetch(body: unknown): {
  fetch: LmStudioFetch
  calls: { url: string; init?: RequestInit }[]
} {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetch: LmStudioFetch = async (url, init) => {
    if (init === undefined) {
      calls.push({ url })
    } else {
      calls.push({ url, init })
    }

    return createResponse(body)
  }

  return { fetch, calls }
}

describe('createLmStudioProvider', () => {
  it('exposes local capabilities with safe defaults', () => {
    const { fetch } = createFetch({})
    const provider = createLmStudioProvider({ fetch })

    expect(provider.capabilities).toMatchObject({
      provider: 'lm-studio',
      model: defaultLmStudioModel,
      hosted: false,
      supportsStreaming: false,
      supportsToolCalls: false,
      supportedInputModalities: ['text'],
      supportedOutputModalities: ['text'],
    })
    expect(provider.capabilities.notes).toContain(defaultLmStudioBaseUrl)
  })

  it('checks availability against the configured local endpoint', async () => {
    const { fetch, calls } = createFetch({
      data: [
        {
          id: 'qwen-local',
        },
      ],
    })
    const provider = createLmStudioProvider({
      baseUrl: 'http://127.0.0.1:4321/v1',
      model: 'qwen-local',
      fetch,
    })

    await expect(provider.checkAvailability()).resolves.toEqual({
      available: true,
      message: 'LM Studio is available at http://127.0.0.1:4321/v1/.',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('http://127.0.0.1:4321/v1/models')
    expect(calls[0]?.init?.method).toBe('GET')
  })

  it('reports unavailable LM Studio without throwing during availability checks', async () => {
    const fetch: LmStudioFetch = async () => {
      throw new Error('connect ECONNREFUSED')
    }
    const provider = createLmStudioProvider({ fetch })

    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      message: 'LM Studio is unavailable at http://127.0.0.1:1234/v1/. connect ECONNREFUSED',
    })
  })

  it('generates text using the OpenAI-compatible chat completions path', async () => {
    const { fetch, calls } = createFetch({
      choices: [
        {
          message: {
            content: 'Keep the workflow local.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 5,
        total_tokens: 17,
      },
    })
    const provider = createLmStudioProvider({
      baseUrl: 'http://127.0.0.1:4321/v1',
      model: 'qwen-local',
      fetch,
    })

    const response = await provider.generateResponse(createRequest())

    expect(response).toMatchObject({
      provider: 'lm-studio',
      model: 'qwen-local',
      message: {
        role: 'assistant',
        content: 'Keep the workflow local.',
      },
      usage: {
        inputTokens: 12,
        outputTokens: 5,
        totalTokens: 17,
      },
      stopReason: 'complete',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('http://127.0.0.1:4321/v1/chat/completions')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.headers).toEqual({
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      model: 'qwen-local',
      messages: [
        {
          role: 'user',
          content: 'Draft a local-only implementation plan.',
        },
      ],
      max_tokens: 128,
      temperature: 0.2,
    })
  })

  it('throws a clear error when LM Studio returns an HTTP failure', async () => {
    const fetch: LmStudioFetch = async () => createResponse({}, false, 503, 'Service Unavailable')
    const provider = createLmStudioProvider({ fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio request failed with HTTP 503 Service Unavailable.',
    )
  })

  it('throws a clear error when the request cannot reach LM Studio', async () => {
    const fetch: LmStudioFetch = async () => {
      throw new Error('connect ECONNREFUSED')
    }
    const provider = createLmStudioProvider({ fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio request failed before a response was returned.',
    )
  })

  it('rejects malformed provider responses', async () => {
    const { fetch } = createFetch({
      choices: [
        {
          message: {},
          finish_reason: 'stop',
        },
      ],
    })
    const provider = createLmStudioProvider({ fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio returned a malformed response: assistant message content is missing.',
    )
  })

  it('rejects invalid JSON responses', async () => {
    const fetch: LmStudioFetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      async json() {
        throw new Error('Unexpected token')
      },
    })
    const provider = createLmStudioProvider({ fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio returned invalid JSON during text generation.',
    )
  })

  it('rejects unsupported output and tool requests before making HTTP calls', async () => {
    const { fetch, calls } = createFetch({})
    const provider = createLmStudioProvider({ fetch })

    await expect(
      provider.generateResponse(
        createRequest({
          output: {
            modality: 'json',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(LmStudioProviderError)

    await expect(
      provider.generateResponse(
        createRequest({
          tools: [
            {
              name: 'read_file',
              description: 'Read a file.',
              inputSchema: {},
            },
          ],
        }),
      ),
    ).rejects.toThrow('LM Studio provider does not support tool calls through Friday yet.')

    expect(calls).toEqual([])
  })
})
