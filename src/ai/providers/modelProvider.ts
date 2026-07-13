import type { AiTaskType, PrivacyLevel } from '../routing/modelRouting.js'

export type ModelMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type ModelModality = 'text' | 'json'

export type ModelStopReason = 'complete' | 'length' | 'tool-call' | 'content-filtered'

export interface ModelMessage {
  role: ModelMessageRole
  content: string
  name?: string
}

export interface ModelToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ModelResponseFormat {
  modality: ModelModality
  schema?: Record<string, unknown>
}

export interface GenerateModelResponseRequest {
  taskType: AiTaskType
  privacyLevel: PrivacyLevel
  messages: ModelMessage[]
  output: ModelResponseFormat
  tools?: ModelToolDefinition[]
  maxOutputTokens?: number
  temperature?: number
  metadata?: Record<string, string>
}

export interface ModelTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type ModelProviderErrorCode =
  | 'provider-error'
  | 'malformed-response'
  | 'missing-content'
  | 'empty-content'
  | 'output-limit-exhausted'
  | 'reasoning-only'

export interface ModelProviderErrorOptions {
  provider: string
  model: string
  code: ModelProviderErrorCode
  stopReason?: ModelStopReason
  usage?: ModelTokenUsage
}

export class ModelProviderError extends Error {
  readonly provider: string
  readonly model: string
  readonly code: ModelProviderErrorCode
  readonly stopReason: ModelStopReason | undefined
  readonly usage: ModelTokenUsage | undefined

  constructor(message: string, options: ModelProviderErrorOptions) {
    super(message)
    this.name = 'ModelProviderError'
    this.provider = options.provider
    this.model = options.model
    this.code = options.code
    this.stopReason = options.stopReason
    this.usage = options.usage
  }
}

export interface GenerateModelResponseResult {
  provider: string
  model: string
  message: ModelMessage
  usage: ModelTokenUsage
  stopReason: ModelStopReason
  rawResponse?: unknown
}

export interface ModelProviderCapabilities {
  provider: string
  model: string
  hosted: boolean
  supportsStreaming: boolean
  supportsToolCalls: boolean
  supportedInputModalities: ModelModality[]
  supportedOutputModalities: ModelModality[]
  maxInputTokens?: number
  maxOutputTokens?: number
  contextWindowTokens?: number
  notes?: string
}

export interface AiModelProvider {
  capabilities: ModelProviderCapabilities
  generateResponse(request: GenerateModelResponseRequest): Promise<GenerateModelResponseResult>
}
