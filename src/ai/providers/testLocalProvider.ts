import { ModelProviderError } from './modelProvider.js'
import type { GenerateModelResponseResult } from './modelProvider.js'
import type { LmStudioProvider } from './lmStudioProvider.js'

const diagnosticOutputTokenAllowances = [64, 256, 1_024] as const

function createTestRequest(purpose: string, maxOutputTokens: number) {
  return {
    taskType: 'plan' as const,
    privacyLevel: 'public' as const,
    messages: [
      {
        role: 'user' as const,
        content: 'Reply with exactly OK to confirm the local provider is ready. Do not explain.',
      },
    ],
    output: { modality: 'text' as const },
    maxOutputTokens,
    temperature: 0,
    metadata: { purpose },
  }
}

export async function testLocalProvider(
  provider: LmStudioProvider,
  purpose: string,
): Promise<
  GenerateModelResponseResult & {
    diagnostic: {
      attempts: number
      maxOutputTokens: number
      adaptiveRetry: boolean
    }
  }
> {
  for (const [index, maxOutputTokens] of diagnosticOutputTokenAllowances.entries()) {
    try {
      const response = await provider.generateResponse(createTestRequest(purpose, maxOutputTokens))

      return {
        ...response,
        diagnostic: {
          attempts: index + 1,
          maxOutputTokens,
          adaptiveRetry: index > 0,
        },
      }
    } catch (error) {
      const hasAnotherAllowance = index < diagnosticOutputTokenAllowances.length - 1
      const shouldRetry =
        error instanceof ModelProviderError &&
        error.code === 'output-limit-exhausted' &&
        hasAnotherAllowance

      if (!shouldRetry) {
        throw error
      }
    }
  }

  throw new Error('Local provider diagnostic exhausted its retry policy.')
}
