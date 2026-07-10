import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { createMockModelProvider } from '../providers/mockModelProvider.js'
import type { MockModelProvider } from '../providers/mockModelProvider.js'
import type { GenerateModelResponseResult } from '../providers/modelProvider.js'
import { readExecutionLogRecords } from '../usage/executionLog.js'
import { executePrompt, type AvailableLocalModelProvider } from './executePrompt.js'

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
        maxOutputTokens: 2_000,
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
    ).rejects.toThrow('Local provider returned malformed output: assistant content is empty.')

    await expect(listExecutionArtifacts(promptPath)).resolves.toEqual([])
  })
})
