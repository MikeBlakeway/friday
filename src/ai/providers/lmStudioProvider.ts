import type {
  AiModelProvider,
  GenerateModelResponseRequest,
  GenerateModelResponseResult,
  ModelMessage,
  ModelProviderCapabilities,
  ModelStopReason,
  ModelTokenUsage,
} from './modelProvider.js'

export const defaultLmStudioBaseUrl = 'http://127.0.0.1:1234/v1'
export const defaultLmStudioModel = 'local-model'

export class LmStudioProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LmStudioProviderError'
  }
}

interface HttpResponseLike {
  ok: boolean
  status: number
  statusText: string
  json(): Promise<unknown>
}

export type LmStudioFetch = (url: string, init?: RequestInit) => Promise<HttpResponseLike>

export interface CreateLmStudioProviderInput {
  baseUrl?: string
  model?: string
  fetch?: LmStudioFetch
}

export interface LmStudioAvailability {
  available: boolean
  message: string
}

export interface LmStudioProvider extends AiModelProvider {
  checkAvailability(): Promise<LmStudioAvailability>
}

interface LmStudioChatCompletionPayload {
  model: string
  messages: ModelMessage[]
  max_tokens?: number
  temperature?: number
}

function normaliseBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()

  if (trimmed.length === 0) {
    throw new LmStudioProviderError('LM Studio base URL must not be empty.')
  }

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

function createEndpoint(baseUrl: string, path: string): string {
  return new URL(path, normaliseBaseUrl(baseUrl)).toString()
}

function getFetch(inputFetch: LmStudioFetch | undefined): LmStudioFetch {
  if (inputFetch) {
    return inputFetch
  }

  if (typeof fetch !== 'function') {
    throw new LmStudioProviderError(
      'LM Studio provider requires a fetch implementation in this runtime.',
    )
  }

  return fetch
}

function createCapabilities(baseUrl: string, model: string): ModelProviderCapabilities {
  return {
    provider: 'lm-studio',
    model,
    hosted: false,
    supportsStreaming: false,
    supportsToolCalls: false,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['text'],
    maxInputTokens: 8_000,
    maxOutputTokens: 2_000,
    notes: `Optional local provider using LM Studio's OpenAI-compatible endpoint at ${normaliseBaseUrl(
      baseUrl,
    )}.`,
  }
}

function createPayload(
  model: string,
  request: GenerateModelResponseRequest,
): LmStudioChatCompletionPayload {
  if (request.output.modality !== 'text') {
    throw new LmStudioProviderError(
      'LM Studio provider currently supports text output only. Request text output or use another provider.',
    )
  }

  if (request.tools && request.tools.length > 0) {
    throw new LmStudioProviderError(
      'LM Studio provider does not support tool calls through Friday yet. Remove tools or use another provider.',
    )
  }

  const payload: LmStudioChatCompletionPayload = {
    model,
    messages: request.messages,
  }

  if (request.maxOutputTokens !== undefined) {
    payload.max_tokens = request.maxOutputTokens
  }

  if (request.temperature !== undefined) {
    payload.temperature = request.temperature
  }

  return payload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstChoice(response: unknown): Record<string, unknown> {
  if (!isRecord(response) || !Array.isArray(response.choices)) {
    throw new LmStudioProviderError(
      'LM Studio returned a malformed response: missing choices array.',
    )
  }

  const [choice] = response.choices

  if (!isRecord(choice)) {
    throw new LmStudioProviderError(
      'LM Studio returned a malformed response: first choice is missing.',
    )
  }

  return choice
}

function parseMessage(choice: Record<string, unknown>): ModelMessage {
  const message = choice.message

  if (!isRecord(message) || typeof message.content !== 'string') {
    throw new LmStudioProviderError(
      'LM Studio returned a malformed response: assistant message content is missing.',
    )
  }

  return {
    role: 'assistant',
    content: message.content,
  }
}

function parseStopReason(choice: Record<string, unknown>): ModelStopReason {
  switch (choice.finish_reason) {
    case 'stop':
    case null:
    case undefined:
      return 'complete'
    case 'length':
      return 'length'
    case 'content_filter':
      return 'content-filtered'
    case 'tool_calls':
      return 'tool-call'
    default:
      throw new LmStudioProviderError(
        'LM Studio returned a malformed response: unsupported finish reason.',
      )
  }
}

function parseTokenUsage(response: unknown): ModelTokenUsage {
  if (!isRecord(response) || response.usage === undefined) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }
  }

  if (!isRecord(response.usage)) {
    throw new LmStudioProviderError('LM Studio returned a malformed response: usage is invalid.')
  }

  const inputTokens = response.usage.prompt_tokens
  const outputTokens = response.usage.completion_tokens
  const totalTokens = response.usage.total_tokens

  if (
    typeof inputTokens !== 'number' ||
    typeof outputTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    throw new LmStudioProviderError(
      'LM Studio returned a malformed response: token usage is invalid.',
    )
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  }
}

async function readJson(response: HttpResponseLike, context: string): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new LmStudioProviderError(`LM Studio returned invalid JSON during ${context}.`)
  }
}

function httpFailure(response: HttpResponseLike, context: string): LmStudioProviderError {
  return new LmStudioProviderError(
    `LM Studio ${context} failed with HTTP ${response.status} ${response.statusText}. Check that LM Studio is running, serving the configured model, and exposing the local server.`,
  )
}

export function createLmStudioProvider(input: CreateLmStudioProviderInput = {}): LmStudioProvider {
  const baseUrl = input.baseUrl ?? defaultLmStudioBaseUrl
  const model = input.model ?? defaultLmStudioModel
  const configuredFetch = getFetch(input.fetch)

  return {
    capabilities: createCapabilities(baseUrl, model),
    async checkAvailability(): Promise<LmStudioAvailability> {
      let response: HttpResponseLike

      try {
        response = await configuredFetch(createEndpoint(baseUrl, 'models'), {
          method: 'GET',
        })
      } catch (error) {
        const cause = error instanceof Error ? ` ${error.message}` : ''

        return {
          available: false,
          message: `LM Studio is unavailable at ${normaliseBaseUrl(baseUrl)}.${cause}`,
        }
      }

      if (!response.ok) {
        return {
          available: false,
          message: httpFailure(response, 'availability check').message,
        }
      }

      return {
        available: true,
        message: `LM Studio is available at ${normaliseBaseUrl(baseUrl)}.`,
      }
    },
    async generateResponse(
      request: GenerateModelResponseRequest,
    ): Promise<GenerateModelResponseResult> {
      let response: HttpResponseLike

      try {
        response = await configuredFetch(createEndpoint(baseUrl, 'chat/completions'), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(createPayload(model, request)),
        })
      } catch (error) {
        const cause = error instanceof Error ? ` ${error.message}` : ''

        throw new LmStudioProviderError(
          `LM Studio request failed before a response was returned. Check that LM Studio is running at ${normaliseBaseUrl(
            baseUrl,
          )} and that model "${model}" is loaded.${cause}`,
        )
      }

      if (!response.ok) {
        throw httpFailure(response, 'request')
      }

      const rawResponse = await readJson(response, 'text generation')
      const choice = firstChoice(rawResponse)

      return {
        provider: 'lm-studio',
        model,
        message: parseMessage(choice),
        usage: parseTokenUsage(rawResponse),
        stopReason: parseStopReason(choice),
        rawResponse,
      }
    },
  }
}
