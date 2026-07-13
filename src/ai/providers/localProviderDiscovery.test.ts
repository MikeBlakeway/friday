import { describe, expect, it } from 'vitest'

import { commonLmStudioBaseUrls, discoverLmStudioProvider } from './localProviderDiscovery.js'
import type { LmStudioFetch } from './lmStudioProvider.js'

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

describe('discoverLmStudioProvider', () => {
  it('tries common localhost endpoints and reports an unavailable server', async () => {
    const calls: string[] = []
    const fetch: LmStudioFetch = async (url) => {
      calls.push(url)
      throw new Error('connect ECONNREFUSED')
    }

    await expect(discoverLmStudioProvider({ fetch })).resolves.toMatchObject({
      status: 'unavailable',
      provider: 'lm-studio',
    })
    expect(calls).toEqual(commonLmStudioBaseUrls.map((baseUrl) => `${baseUrl}/models`))
  })

  it('returns an actionable no-models result when the server is reachable', async () => {
    const fetch: LmStudioFetch = async () => createResponse({ data: [] })

    await expect(discoverLmStudioProvider({ fetch })).resolves.toEqual({
      status: 'no-models',
      provider: 'lm-studio',
      baseUrl: 'http://127.0.0.1:1234/v1',
      models: [],
      message:
        'LM Studio is running at http://127.0.0.1:1234/v1 but no models are loaded. Load a model in LM Studio and retry.',
    })
  })

  it('automatically selects the only discovered model', async () => {
    const fetch: LmStudioFetch = async (url) =>
      createResponse({
        data: [
          {
            id: 'qwen3-coder-14b',
            ...(url.includes('/api/v0/') ? { max_context_length: 32_768 } : {}),
          },
        ],
      })

    await expect(discoverLmStudioProvider({ fetch })).resolves.toEqual({
      status: 'ready',
      provider: 'lm-studio',
      baseUrl: 'http://127.0.0.1:1234/v1',
      models: ['qwen3-coder-14b'],
      modelContextWindowTokens: { 'qwen3-coder-14b': 32_768 },
      selectedModel: 'qwen3-coder-14b',
      selection: 'only-available',
      message: 'Selected the only loaded LM Studio model: qwen3-coder-14b.',
    })
  })

  it('requires a configured choice when multiple models are available', async () => {
    const fetch: LmStudioFetch = async () =>
      createResponse({ data: [{ id: 'qwen3-coder-14b' }, { id: 'codestral-22b' }] })

    await expect(discoverLmStudioProvider({ fetch })).resolves.toEqual({
      status: 'choice-required',
      provider: 'lm-studio',
      baseUrl: 'http://127.0.0.1:1234/v1',
      models: ['qwen3-coder-14b', 'codestral-22b'],
      message:
        'LM Studio has multiple loaded models: qwen3-coder-14b, codestral-22b. Set providers.lm-studio.model in ~/.friday/providers.json.',
    })
  })

  it('uses a configured endpoint and model when that model is available', async () => {
    const calls: string[] = []
    const fetch: LmStudioFetch = async (url) => {
      calls.push(url)
      return createResponse({
        data: [
          { id: 'codestral-22b' },
          {
            id: 'qwen3-coder-14b',
            ...(url.includes('/api/v0/') ? { max_context_length: 65_536 } : {}),
          },
        ],
      })
    }

    await expect(
      discoverLmStudioProvider({
        configuration: {
          baseUrl: 'http://localhost:4321/v1',
          model: 'qwen3-coder-14b',
          autoStart: false,
        },
        fetch,
      }),
    ).resolves.toEqual({
      status: 'ready',
      provider: 'lm-studio',
      baseUrl: 'http://localhost:4321/v1',
      models: ['codestral-22b', 'qwen3-coder-14b'],
      modelContextWindowTokens: { 'qwen3-coder-14b': 65_536 },
      selectedModel: 'qwen3-coder-14b',
      selection: 'configured',
      message: 'Selected configured LM Studio model: qwen3-coder-14b.',
    })
    expect(calls).toEqual([
      'http://localhost:4321/v1/models',
      'http://localhost:4321/api/v0/models',
    ])
  })

  it('lists available choices when the configured model is not loaded', async () => {
    const fetch: LmStudioFetch = async () =>
      createResponse({ data: [{ id: 'qwen3-coder-14b' }, { id: 'codestral-22b' }] })

    await expect(
      discoverLmStudioProvider({
        configuration: { model: 'missing-model' },
        fetch,
      }),
    ).resolves.toMatchObject({
      status: 'choice-required',
      models: ['qwen3-coder-14b', 'codestral-22b'],
      message:
        'Configured LM Studio model "missing-model" is not loaded. Available models: qwen3-coder-14b, codestral-22b. Update providers.lm-studio.model in ~/.friday/providers.json.',
    })
  })
})
