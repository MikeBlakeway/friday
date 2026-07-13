import { readFile } from 'node:fs/promises'

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

async function loadResponseFixture(name: string): Promise<unknown> {
  const fixtureUrl = new URL(`./fixtures/lm-studio-chat-completions/${name}.json`, import.meta.url)

  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as unknown
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
    expect(provider.capabilities).not.toHaveProperty('maxInputTokens')
    expect(provider.capabilities).not.toHaveProperty('maxOutputTokens')
    expect(provider.capabilities).not.toHaveProperty('contextWindowTokens')
  })

  it('exposes configured or discovered model limits without hardcoded generic values', () => {
    const { fetch } = createFetch({})
    const provider = createLmStudioProvider({
      fetch,
      contextWindowTokens: 32_768,
      maxOutputTokens: 8_192,
    })

    expect(provider.capabilities).toMatchObject({
      contextWindowTokens: 32_768,
      maxInputTokens: 32_768,
      maxOutputTokens: 8_192,
    })
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
    const { fetch, calls } = createFetch(await loadResponseFixture('standard-content'))
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

  it('returns final assistant content without exposing separate reasoning content', async () => {
    const { fetch } = createFetch(await loadResponseFixture('reasoning-with-final-content'))
    const provider = createLmStudioProvider({ model: 'qwen/qwen3.6-35b-a3b', fetch })

    await expect(provider.generateResponse(createRequest())).resolves.toMatchObject({
      message: {
        role: 'assistant',
        content: 'Prioritise the provider response boundary.',
      },
      stopReason: 'complete',
    })
  })

  it('normalises OpenAI-compatible text content parts', async () => {
    const { fetch } = createFetch(await loadResponseFixture('text-content-parts'))
    const provider = createLmStudioProvider({ model: 'qwen-local', fetch })

    await expect(provider.generateResponse(createRequest())).resolves.toMatchObject({
      message: {
        role: 'assistant',
        content: 'Keep the workflow local and inspectable.',
      },
    })
  })

  it('distinguishes output-limit exhaustion from malformed output', async () => {
    const { fetch } = createFetch(await loadResponseFixture('empty-content-length'))
    const provider = createLmStudioProvider({ model: 'qwen/qwen3.6-35b-a3b', fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio provider lm-studio/qwen/qwen3.6-35b-a3b returned no final assistant content after reaching the output token limit (finish reason: length; usage: 6725 input, 1200 output, 7925 total tokens). Increase --max-output-tokens or choose a model that can finish within the configured limit.',
    )
  })

  it('rejects reasoning-only output without exposing hidden reasoning', async () => {
    const { fetch } = createFetch(await loadResponseFixture('reasoning-only'))
    const provider = createLmStudioProvider({ model: 'qwen/qwen3.6-35b-a3b', fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio provider lm-studio/qwen/qwen3.6-35b-a3b returned separate reasoning but no final assistant content (finish reason: stop; usage: 6725 input, 642 output, 7367 total tokens). Friday does not expose hidden reasoning as the assistant response. Use a model or LM Studio configuration that returns a final answer.',
    )
  })

  it('reports empty stopped output with provider, model, finish reason, and usage', async () => {
    const { fetch } = createFetch(await loadResponseFixture('empty-content-stop'))
    const provider = createLmStudioProvider({ model: 'qwen/qwen3.6-35b-a3b', fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio provider lm-studio/qwen/qwen3.6-35b-a3b returned empty assistant content (finish reason: stop; usage: 6725 input, 0 output, 6725 total tokens). Check the model chat template and LM Studio reasoning-output settings.',
    )
  })

  it('reports missing message content with safe response metadata', async () => {
    const { fetch } = createFetch(await loadResponseFixture('missing-content'))
    const provider = createLmStudioProvider({ model: 'qwen/qwen3.6-35b-a3b', fetch })

    await expect(provider.generateResponse(createRequest())).rejects.toThrow(
      'LM Studio provider lm-studio/qwen/qwen3.6-35b-a3b returned a response without assistant message content (finish reason: stop; usage: 6725 input, 0 output, 6725 total tokens). Check that the loaded model exposes OpenAI-compatible final text content.',
    )
  })

  it('uses zero token counts when a successful response omits usage', async () => {
    const { fetch } = createFetch(await loadResponseFixture('missing-usage'))
    const provider = createLmStudioProvider({ model: 'qwen/qwen3.6-35b-a3b', fetch })

    await expect(provider.generateResponse(createRequest())).resolves.toMatchObject({
      message: {
        content: 'The final answer is still usable.',
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
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
      'LM Studio provider lm-studio/local-model returned a response without assistant message content (finish reason: stop; usage unavailable).',
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
