import type { LocalProviderConfiguration } from './globalProviderConfig.js'
import type { LmStudioFetch } from './lmStudioProvider.js'

export const commonLmStudioBaseUrls = [
  'http://127.0.0.1:1234/v1',
  'http://localhost:1234/v1',
] as const

interface LmStudioDiscoveryBase {
  provider: 'lm-studio'
  message: string
}

export type LmStudioDiscoveryResult =
  | (LmStudioDiscoveryBase & {
      status: 'unavailable'
      attemptedBaseUrls: string[]
    })
  | (LmStudioDiscoveryBase & {
      status: 'invalid-response'
      baseUrl: string
    })
  | (LmStudioDiscoveryBase & {
      status: 'no-models'
      baseUrl: string
      models: string[]
    })
  | (LmStudioDiscoveryBase & {
      status: 'choice-required'
      baseUrl: string
      models: string[]
    })
  | (LmStudioDiscoveryBase & {
      status: 'ready'
      baseUrl: string
      models: string[]
      selectedModel: string
      selection: 'configured' | 'only-available'
    })

export interface DiscoverLmStudioProviderInput {
  configuration?: LocalProviderConfiguration
  fetch?: LmStudioFetch
}

function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function createModelsEndpoint(baseUrl: string): string {
  return `${normaliseBaseUrl(baseUrl)}/models`
}

function getFetch(inputFetch: LmStudioFetch | undefined): LmStudioFetch {
  if (inputFetch !== undefined) {
    return inputFetch
  }

  if (typeof fetch !== 'function') {
    throw new Error('Local provider discovery requires a fetch implementation in this runtime.')
  }

  return fetch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseModelIds(value: unknown): string[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return undefined
  }

  const modelIds: string[] = []

  for (const model of value.data) {
    if (!isRecord(model) || typeof model.id !== 'string' || model.id.trim().length === 0) {
      return undefined
    }

    const modelId = model.id.trim()

    if (!modelIds.includes(modelId)) {
      modelIds.push(modelId)
    }
  }

  return modelIds
}

function selectModel(
  baseUrl: string,
  models: string[],
  configuredModel: string | undefined,
): LmStudioDiscoveryResult {
  if (models.length === 0) {
    return {
      status: 'no-models',
      provider: 'lm-studio',
      baseUrl,
      models,
      message: `LM Studio is running at ${baseUrl} but no models are loaded. Load a model in LM Studio and retry.`,
    }
  }

  if (configuredModel !== undefined && models.includes(configuredModel)) {
    return {
      status: 'ready',
      provider: 'lm-studio',
      baseUrl,
      models,
      selectedModel: configuredModel,
      selection: 'configured',
      message: `Selected configured LM Studio model: ${configuredModel}.`,
    }
  }

  const [onlyModel] = models

  if (models.length === 1 && onlyModel !== undefined) {
    return {
      status: 'ready',
      provider: 'lm-studio',
      baseUrl,
      models,
      selectedModel: onlyModel,
      selection: 'only-available',
      message: `Selected the only loaded LM Studio model: ${onlyModel}.`,
    }
  }

  if (configuredModel !== undefined) {
    return {
      status: 'choice-required',
      provider: 'lm-studio',
      baseUrl,
      models,
      message: `Configured LM Studio model "${configuredModel}" is not loaded. Available models: ${models.join(', ')}. Update providers.lm-studio.model in ~/.friday/providers.json.`,
    }
  }

  return {
    status: 'choice-required',
    provider: 'lm-studio',
    baseUrl,
    models,
    message: `LM Studio has multiple loaded models: ${models.join(', ')}. Set providers.lm-studio.model in ~/.friday/providers.json.`,
  }
}

export async function discoverLmStudioProvider(
  input: DiscoverLmStudioProviderInput = {},
): Promise<LmStudioDiscoveryResult> {
  const configuredFetch = getFetch(input.fetch)
  const baseUrls = input.configuration?.baseUrl
    ? [input.configuration.baseUrl]
    : [...commonLmStudioBaseUrls]
  const attemptedBaseUrls: string[] = []
  const failures: string[] = []

  for (const candidateBaseUrl of baseUrls) {
    const baseUrl = normaliseBaseUrl(candidateBaseUrl)
    attemptedBaseUrls.push(baseUrl)
    let response

    try {
      response = await configuredFetch(createModelsEndpoint(baseUrl), { method: 'GET' })
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
      continue
    }

    if (!response.ok) {
      failures.push(`HTTP ${response.status} ${response.statusText}`)
      continue
    }

    let rawModels: unknown

    try {
      rawModels = await response.json()
    } catch {
      return {
        status: 'invalid-response',
        provider: 'lm-studio',
        baseUrl,
        message: `LM Studio returned invalid JSON from ${createModelsEndpoint(baseUrl)}. Check the configured endpoint and retry.`,
      }
    }

    const models = parseModelIds(rawModels)

    if (models === undefined) {
      return {
        status: 'invalid-response',
        provider: 'lm-studio',
        baseUrl,
        message: `LM Studio returned an invalid model list from ${createModelsEndpoint(baseUrl)}. Expected an OpenAI-compatible data array with model identifiers.`,
      }
    }

    return selectModel(baseUrl, models, input.configuration?.model)
  }

  const failureDetail = failures.length > 0 ? ` Last error: ${failures.at(-1)}.` : ''

  return {
    status: 'unavailable',
    provider: 'lm-studio',
    attemptedBaseUrls,
    message: `LM Studio was not found at ${attemptedBaseUrls.join(' or ')}. Start the LM Studio local server or configure providers.lm-studio.baseUrl in ~/.friday/providers.json.${failureDetail}`,
  }
}
