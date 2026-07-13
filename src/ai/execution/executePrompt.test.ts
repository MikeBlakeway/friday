import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { createMockModelProvider } from '../providers/mockModelProvider.js'
import type { MockModelProvider } from '../providers/mockModelProvider.js'
import {
  ModelProviderError,
  type GenerateModelResponseRequest,
  type GenerateModelResponseResult,
} from '../providers/modelProvider.js'
import { readExecutionLogRecords } from '../usage/executionLog.js'
import {
  executePrompt,
  preparePromptExecution,
  type AvailableLocalModelProvider,
} from './executePrompt.js'

const tempDirs: string[] = []

async function createPromptProject(promptContent: string): Promise<{
  projectRoot: string
  promptPath: string
}> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-execute-domain-'))
  tempDirs.push(projectRoot)
  const outputDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR, 'output')
  const promptPath = path.join(outputDirPath, 'plan-prompt.md')

  await mkdir(outputDirPath, { recursive: true })
  await writeFile(promptPath, promptContent, 'utf8')

  return { projectRoot, promptPath }
}

function createLocalProvider(
  input: {
    responseText?: string
    available?: boolean
    availabilityMessage?: string
    contextWindowTokens?: number
    maxOutputTokens?: number
  } = {},
): AvailableLocalModelProvider & MockModelProvider {
  return {
    ...createMockModelProvider({
      capabilities: {
        provider: 'mock-local',
        model: 'mock-coder',
        hosted: false,
        supportsStreaming: false,
        supportsToolCalls: false,
        supportedInputModalities: ['text'],
        supportedOutputModalities: ['text'],
        maxInputTokens: 8_000,
        maxOutputTokens: input.maxOutputTokens ?? 16_000,
        contextWindowTokens: input.contextWindowTokens ?? 16_000,
      },
      responseText: input.responseText ?? 'Use a local execution boundary.',
      usage: {
        inputTokens: 8,
        outputTokens: 6,
      },
    }),
    async checkAvailability() {
      return {
        available: input.available ?? true,
        message: input.availabilityMessage ?? 'mock local provider is available.',
      }
    },
  }
}

async function listExecutionArtifacts(promptPath: string): Promise<string[]> {
  try {
    return await readdir(path.join(path.dirname(promptPath), 'executions'))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('executePrompt', () => {
  it('executes a safe prompt with an explicit local provider and writes an artifact', async () => {
    const { projectRoot, promptPath } = await createPromptProject(
      '# Plan\n\nPlan the next project milestone.',
    )
    const provider = createLocalProvider()

    const result = await executePrompt({
      projectRoot,
      modelProvider: provider,
      now: () => new Date('2026-07-10T10:20:30.000Z'),
      request: {
        promptPath,
        provider: 'local',
        taskType: 'plan',
        maxOutputTokens: 500,
        temperature: 0.2,
      },
    })

    expect(result.resultArtifact).toBe(
      '.friday/output/executions/plan-prompt-2026-07-10T10-20-30-000Z.json',
    )
    expect(result.classification.privacyLevel).toBe('internal')
    expect(result.route.provider).toBe('local')
    expect(result.costEstimate.provider).toBe('local')
    expect(provider.requests).toHaveLength(1)
    expect(provider.requests[0]).toMatchObject({
      taskType: 'plan',
      privacyLevel: 'internal',
      maxOutputTokens: 500,
      temperature: 0.2,
      metadata: {
        promptArtifact: '.friday/output/plan-prompt.md',
        executionBoundary: 'explicit-local',
      },
    })

    const artifactContent = await readFile(path.join(projectRoot, result.resultArtifact), 'utf8')
    expect(JSON.parse(artifactContent)).toMatchObject({
      request: {
        promptPath: '.friday/output/plan-prompt.md',
      },
      provider: 'mock-local',
      model: 'mock-coder',
      message: {
        role: 'assistant',
        content: 'Use a local execution boundary.',
      },
      usage: {
        inputTokens: 8,
        outputTokens: 6,
        totalTokens: 14,
      },
    })

    await expect(readExecutionLogRecords(projectRoot)).resolves.toMatchObject([
      {
        schemaVersion: 1,
        id: '.friday/output/executions/plan-prompt-2026-07-10T10-20-30-000Z.json',
        workflow: {
          type: 'plan',
          artifact: '.friday/output/plan-prompt.md',
        },
        recommendedRoute: {
          provider: 'local',
          model: 'local-coder',
        },
        chosenRoute: {
          provider: 'local',
          model: 'local-coder',
        },
        provider: 'mock-local',
        model: 'mock-coder',
        startedAt: '2026-07-10T10:20:30.000Z',
        completedAt: '2026-07-10T10:20:30.000Z',
        latencyMs: 0,
        usage: {
          inputTokens: 8,
          outputTokens: 6,
          totalTokens: 14,
        },
        result: {
          status: 'succeeded',
          artifact: '.friday/output/executions/plan-prompt-2026-07-10T10-20-30-000Z.json',
        },
        privacy: {
          privacyLevel: 'internal',
          blocked: false,
          secretDetected: false,
        },
      },
    ])
  })

  it('blocks secret-bearing input before invoking the provider', async () => {
    const { projectRoot, promptPath } = await createPromptProject(
      'Use OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789 in the plan.',
    )
    const provider = createLocalProvider()

    await expect(
      executePrompt({
        projectRoot,
        modelProvider: provider,
        request: {
          promptPath,
          provider: 'local',
          taskType: 'plan',
          maxOutputTokens: 500,
          temperature: 0.2,
        },
      }),
    ).rejects.toThrow('Friday execute blocked this prompt before provider invocation')

    expect(provider.requests).toEqual([])
    await expect(listExecutionArtifacts(promptPath)).resolves.toEqual([])
  })

  it('fails clearly when the local provider is unavailable without writing output', async () => {
    const { projectRoot, promptPath } = await createPromptProject(
      '# Plan\n\nPlan the next project milestone.',
    )
    const provider = createLocalProvider({
      available: false,
      availabilityMessage: 'LM Studio is not running.',
    })

    await expect(
      executePrompt({
        projectRoot,
        modelProvider: provider,
        request: {
          promptPath,
          provider: 'local',
          taskType: 'plan',
          maxOutputTokens: 500,
          temperature: 0.2,
        },
      }),
    ).rejects.toThrow('Local provider unavailable: LM Studio is not running.')

    expect(provider.requests).toEqual([])
    await expect(listExecutionArtifacts(promptPath)).resolves.toEqual([])
  })

  it('rejects malformed provider output before writing an artifact', async () => {
    const { projectRoot, promptPath } = await createPromptProject(
      '# Plan\n\nPlan the next project milestone.',
    )
    const provider = createLocalProvider()
    provider.generateResponse = async (): Promise<GenerateModelResponseResult> => ({
      provider: 'mock-local',
      model: 'mock-coder',
      message: {
        role: 'assistant',
        content: '   ',
      },
      usage: {
        inputTokens: 8,
        outputTokens: 0,
        totalTokens: 8,
      },
      stopReason: 'complete',
    })

    await expect(
      executePrompt({
        projectRoot,
        modelProvider: provider,
        request: {
          promptPath,
          provider: 'local',
          taskType: 'plan',
          maxOutputTokens: 500,
          temperature: 0.2,
        },
      }),
    ).rejects.toThrow(
      'Local provider mock-local/mock-coder returned empty assistant content (finish reason: complete; usage: 8 input, 0 output, 8 total tokens).',
    )

    await expect(listExecutionArtifacts(promptPath)).resolves.toEqual([])
    await expect(readExecutionLogRecords(projectRoot)).resolves.toMatchObject([
      {
        workflow: {
          type: 'plan',
          artifact: '.friday/output/plan-prompt.md',
        },
        provider: 'mock-local',
        model: 'mock-coder',
        usage: {
          inputTokens: 8,
          outputTokens: 0,
          totalTokens: 8,
        },
        result: {
          status: 'failed',
          stopReason: 'complete',
          errorCode: 'empty-content',
        },
      },
    ])

    const logContent = await readFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'runtime', 'execution-log.jsonl'),
      'utf8',
    )
    expect(logContent).not.toContain('Plan the next project milestone')
  })

  it('calculates context-safe effective and retry allowances before generation', async () => {
    const { projectRoot, promptPath } = await createPromptProject('x'.repeat(400))
    const provider = createLocalProvider({ contextWindowTokens: 5_000, maxOutputTokens: 4_500 })

    const prepared = await preparePromptExecution({
      projectRoot,
      modelProvider: provider,
      request: {
        promptPath,
        provider: 'local',
        taskType: 'plan',
        maxOutputTokens: 2_000,
        temperature: 0.2,
      },
    })

    expect(prepared.tokenAllowance).toEqual({
      estimatedInputTokens: 100,
      effectiveMaxOutputTokens: 2_000,
      contextWindowTokens: 5_000,
      availableOutputTokens: 4_500,
      retry: { enabled: true, maxOutputTokens: 4_000 },
    })
    expect(prepared.costEstimate.estimatedOutputTokens).toBe(2_000)
  })

  it('retries output-limit exhaustion once within the known context and records failures as metadata', async () => {
    const { projectRoot, promptPath } = await createPromptProject(
      '# Plan\n\nPlan the next project milestone.',
    )
    const requests: GenerateModelResponseRequest[] = []
    const provider = createLocalProvider({ contextWindowTokens: 8_000, maxOutputTokens: 6_000 })
    provider.generateResponse = async (request): Promise<GenerateModelResponseResult> => {
      requests.push(request)
      if (requests.length === 1) {
        throw new ModelProviderError('private reasoning exhausted the allowance', {
          provider: 'mock-local',
          model: 'mock-coder',
          code: 'output-limit-exhausted',
          stopReason: 'length',
          usage: { inputTokens: 10, outputTokens: 1_000, totalTokens: 1_010 },
        })
      }

      return {
        provider: 'mock-local',
        model: 'mock-coder',
        message: { role: 'assistant', content: 'Final answer only.' },
        usage: { inputTokens: 10, outputTokens: 1_200, totalTokens: 1_210 },
        stopReason: 'complete',
      }
    }

    const result = await executePrompt({
      projectRoot,
      modelProvider: provider,
      now: () => new Date('2026-07-13T10:00:00.000Z'),
      request: {
        promptPath,
        provider: 'local',
        taskType: 'plan',
        maxOutputTokens: 1_000,
        temperature: 0.2,
      },
    })

    expect(requests.map((request) => request.maxOutputTokens)).toEqual([1_000, 2_000])
    expect(result.request.maxOutputTokens).toBe(2_000)
    expect(result.costEstimate.estimatedOutputTokens).toBe(2_000)
    await expect(readExecutionLogRecords(projectRoot)).resolves.toMatchObject([
      { result: { status: 'failed', errorCode: 'output-limit-exhausted' } },
      { result: { status: 'succeeded' } },
    ])
    const history = await readFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'runtime', 'execution-log.jsonl'),
      'utf8',
    )
    expect(history).not.toContain('private reasoning')
  })

  it('never retries beyond one attempt or an explicit user ceiling', async () => {
    const createExhaustedProvider = () => {
      const provider = createLocalProvider({ contextWindowTokens: 8_000, maxOutputTokens: 6_000 })
      provider.generateResponse = async () => {
        throw new ModelProviderError('output exhausted', {
          provider: 'mock-local',
          model: 'mock-coder',
          code: 'output-limit-exhausted',
          stopReason: 'length',
        })
      }
      return provider
    }
    const implicitProject = await createPromptProject('# Plan\n\nImplicit ceiling.')
    const implicitProvider = createExhaustedProvider()
    let implicitAttempts = 0
    implicitProvider.generateResponse = async () => {
      implicitAttempts += 1
      throw new ModelProviderError('output exhausted', {
        provider: 'mock-local',
        model: 'mock-coder',
        code: 'output-limit-exhausted',
        stopReason: 'length',
      })
    }

    await expect(
      executePrompt({
        projectRoot: implicitProject.projectRoot,
        modelProvider: implicitProvider,
        request: {
          promptPath: implicitProject.promptPath,
          provider: 'local',
          taskType: 'plan',
          maxOutputTokens: 1_000,
          temperature: 0.2,
        },
      }),
    ).rejects.toThrow('output exhausted')
    expect(implicitAttempts).toBe(2)

    const explicitProject = await createPromptProject('# Plan\n\nExplicit ceiling.')
    const explicitProvider = createExhaustedProvider()
    let explicitAttempts = 0
    explicitProvider.generateResponse = async () => {
      explicitAttempts += 1
      throw new ModelProviderError('explicit output exhausted', {
        provider: 'mock-local',
        model: 'mock-coder',
        code: 'output-limit-exhausted',
        stopReason: 'length',
      })
    }

    await expect(
      executePrompt({
        projectRoot: explicitProject.projectRoot,
        modelProvider: explicitProvider,
        request: {
          promptPath: explicitProject.promptPath,
          provider: 'local',
          taskType: 'plan',
          maxOutputTokens: 1_000,
          maxOutputTokensExplicit: true,
          temperature: 0.2,
        },
      }),
    ).rejects.toThrow('explicit output exhausted')
    expect(explicitAttempts).toBe(1)
  })

  it('fails before generation when the requested output cannot fit the known context', async () => {
    const { projectRoot, promptPath } = await createPromptProject('x'.repeat(1_600))
    const provider = createLocalProvider({ contextWindowTokens: 1_000, maxOutputTokens: 1_000 })

    await expect(
      executePrompt({
        projectRoot,
        modelProvider: provider,
        request: {
          promptPath,
          provider: 'local',
          taskType: 'plan',
          maxOutputTokens: 700,
          temperature: 0.2,
        },
      }),
    ).rejects.toThrow(
      'Requested 700 output tokens cannot fit: estimated input is 400 tokens and the known context window is 1000 tokens',
    )
    expect(provider.requests).toEqual([])
  })
})
