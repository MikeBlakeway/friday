import type { GenerateModelResponseResult } from './modelProvider.js'
import type { LmStudioProvider } from './lmStudioProvider.js'

export async function testLocalProvider(
  provider: LmStudioProvider,
  purpose: string,
): Promise<GenerateModelResponseResult> {
  return provider.generateResponse({
    taskType: 'plan',
    privacyLevel: 'public',
    messages: [
      {
        role: 'user',
        content: 'Reply with OK to confirm the local provider is ready.',
      },
    ],
    output: { modality: 'text' },
    maxOutputTokens: 8,
    temperature: 0,
    metadata: { purpose },
  })
}
