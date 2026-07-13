import { ModelProviderError } from './modelProvider.js'
import type {
  AiModelProvider,
  GenerateModelResponseRequest,
  GenerateModelResponseResult,
  ModelMessage,
  ModelProviderErrorCode,
  ModelProviderCapabilities,
  ModelStopReason,
  ModelTokenUsage,
} from './modelProvider.js'

export const defaultLmStudioBaseUrl = 'http://127.0.0.1:1234/v1'
export const defaultLmStudioModel = 'local-model'

export class LmStudioProviderError extends ModelProviderError {
  constructor(
    message: string,
    options: {
      model?: string
      code?: ModelProviderErrorCode
      stopReason?: ModelStopReason
      usage?: ModelTokenUsage
    } = {},
  ) {
    super(message, {
      provider: 'lm-studio',
      model: options.model ?? 'unknown',
      code: options.code ?? 'provider-error',
      ...(options.stopReason === undefined ? {} : { stopReason: options.stopReason }),
      ...(options.usage === undefined ? {} : { usage: options.usage }),
    })
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
  contextWindowTokens?: number
  maxOutputTokens?: number
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

function createCapabilities(
  baseUrl: string,
  model: string,
  input: Pick<CreateLmStudioProviderInput, 'contextWindowTokens' | 'maxOutputTokens'>,
): ModelProviderCapabilities {
  return {
    provider: 'lm-studio',
    model,
    hosted: false,
    supportsStreaming: false,
    supportsToolCalls: false,
    supportedInputModalities: ['text'],
    supportedOutputModalities: ['text'],
    ...(input.contextWindowTokens === undefined
      ? {}
      : {
          contextWindowTokens: input.contextWindowTokens,
          maxInputTokens: input.contextWindowTokens,
        }),
    ...(input.maxOutputTokens === undefined
      ? input.contextWindowTokens === undefined
        ? {}
        : { maxOutputTokens: input.contextWindowTokens }
      : { maxOutputTokens: input.maxOutputTokens }),
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

interface ParsedTokenUsage {
  usage: ModelTokenUsage
  available: boolean
}

function parseAssistantText(content: unknown): string | undefined {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return undefined
  }

  const textParts = content.flatMap((part) => {
    if (typeof part === 'string') {
      return [part]
    }

    if (
      isRecord(part) &&
      (part.type === 'text' || part.type === 'output_text') &&
      typeof part.text === 'string'
    ) {
      return [part.text]
    }

    return []
  })

  return textParts.length > 0 ? textParts.join('') : undefined
}

function hasSeparateReasoning(
  message: Record<string, unknown>,
  choice: Record<string, unknown>,
): boolean {
  const candidates = [message.reasoning_content, message.reasoning, choice.reasoning_content]

  return candidates.some((value) => {
    if (typeof value === 'string') {
      return value.trim().length > 0
    }

    return Array.isArray(value) && value.length > 0
  })
}

function formatUsage(parsedUsage: ParsedTokenUsage): string {
  if (!parsedUsage.available) {
    return 'usage unavailable'
  }

  const { inputTokens, outputTokens, totalTokens } = parsedUsage.usage

  return `usage: ${inputTokens} input, ${outputTokens} output, ${totalTokens} total tokens`
}

function responseError(
  message: string,
  input: {
    model: string
    code: ModelProviderErrorCode
    stopReason: ModelStopReason
    usage: ParsedTokenUsage
  },
): LmStudioProviderError {
  return new LmStudioProviderError(message, {
    model: input.model,
    code: input.code,
    stopReason: input.stopReason,
    ...(input.usage.available ? { usage: input.usage.usage } : {}),
  })
}

function parseMessage(
  choice: Record<string, unknown>,
  model: string,
  stopReason: ModelStopReason,
  usage: ParsedTokenUsage,
): ModelMessage {
  const message = choice.message
  const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : 'stop'
  const diagnosticContext = `finish reason: ${finishReason}; ${formatUsage(usage)}`

  if (!isRecord(message)) {
    throw responseError(
      `LM Studio provider lm-studio/${model} returned a response without an assistant message (${diagnosticContext}). Check that the loaded model exposes an OpenAI-compatible chat-completion response.`,
      { model, code: 'malformed-response', stopReason, usage },
    )
  }

  const content = message.content === null ? '' : parseAssistantText(message.content)

  if (content === undefined) {
    throw responseError(
      `LM Studio provider lm-studio/${model} returned a response without assistant message content (${diagnosticContext}). Check that the loaded model exposes OpenAI-compatible final text content.`,
      { model, code: 'missing-content', stopReason, usage },
    )
  }

  if (content.trim().length === 0) {
    if (stopReason === 'length') {
      throw responseError(
        `LM Studio provider lm-studio/${model} returned no final assistant content after reaching the output token limit (${diagnosticContext}). Increase --max-output-tokens or choose a model that can finish within the configured limit.`,
        { model, code: 'output-limit-exhausted', stopReason, usage },
      )
    }

    if (hasSeparateReasoning(message, choice)) {
      throw responseError(
        `LM Studio provider lm-studio/${model} returned separate reasoning but no final assistant content (${diagnosticContext}). Friday does not expose hidden reasoning as the assistant response. Use a model or LM Studio configuration that returns a final answer.`,
        { model, code: 'reasoning-only', stopReason, usage },
      )
    }

    throw responseError(
      `LM Studio provider lm-studio/${model} returned empty assistant content (${diagnosticContext}). Check the model chat template and LM Studio reasoning-output settings.`,
      { model, code: 'empty-content', stopReason, usage },
    )
  }

  return {
    role: 'assistant',
    content,
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

function parseTokenUsage(response: unknown): ParsedTokenUsage {
  if (!isRecord(response) || response.usage === undefined) {
    return {
      available: false,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
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
    available: true,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
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
    capabilities: createCapabilities(baseUrl, model, input),
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
      const stopReason = parseStopReason(choice)
      const parsedUsage = parseTokenUsage(rawResponse)

      return {
        provider: 'lm-studio',
        model,
        message: parseMessage(choice, model, stopReason, parsedUsage),
        usage: parsedUsage.usage,
        stopReason,
        rawResponse,
      }
    },
  }
}
