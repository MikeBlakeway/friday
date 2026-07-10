import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { createMockModelProvider } from '../../ai/providers/mockModelProvider.js'
import { parseExecuteArgs, runExecuteCommand } from './execute.js'

const tempDirs: string[] = []

async function createPromptProject(): Promise<{
  projectRoot: string
  promptPath: string
}> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-execute-command-'))
  tempDirs.push(projectRoot)
  const outputDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR, 'output')
  const promptPath = path.join(outputDirPath, 'plan-prompt.md')

  await mkdir(outputDirPath, { recursive: true })
  await writeFile(promptPath, '# Plan\n\nPlan the next project milestone.', 'utf8')

  return { projectRoot, promptPath }
}

async function captureConsoleOutput(action: () => Promise<void>): Promise<string> {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

  try {
    await action()
    return log.mock.calls.map((call) => call.join(' ')).join('\n')
  } finally {
    log.mockRestore()
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
  vi.restoreAllMocks()
})

describe('parseExecuteArgs', () => {
  it('requires an explicit local provider for an existing prompt artifact', () => {
    expect(() => parseExecuteArgs(['.friday/output/plan-prompt.md'], '/repo')).toThrow(
      'friday execute requires an explicit provider. Use --provider local.',
    )

    expect(
      parseExecuteArgs(
        [
          '.friday/output/plan-prompt.md',
          '--provider',
          'local',
          '--max-output-tokens',
          '700',
          '--temperature',
          '0.1',
        ],
        '/repo',
      ),
    ).toEqual({
      promptPath: path.resolve('/repo', '.friday/output/plan-prompt.md'),
      provider: 'local',
      taskType: 'plan',
      maxOutputTokens: 700,
      temperature: 0.1,
    })
  })

  it('rejects hosted providers', () => {
    expect(() =>
      parseExecuteArgs(['.friday/output/plan-prompt.md', '--provider', 'openai'], '/repo'),
    ).toThrow('friday execute currently supports only --provider local.')
  })
})

describe('runExecuteCommand', () => {
  it('discovers the only loaded model without requiring global configuration or a local-model alias', async () => {
    const { projectRoot } = await createPromptProject()
    const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-execute-home-'))
    tempDirs.push(homeDir)
    const calls: Array<{ url: string; init?: RequestInit }> = []

    const output = await captureConsoleOutput(() =>
      runExecuteCommand({
        projectRoot,
        homeDir,
        args: ['.friday/output/plan-prompt.md', '--provider', 'local'],
        providerFetch: async (url, init) => {
          calls.push(init === undefined ? { url } : { url, init })

          if (url.endsWith('/models')) {
            return {
              ok: true,
              status: 200,
              statusText: 'OK',
              async json() {
                return { data: [{ id: 'qwen3-coder-14b' }] }
              },
            }
          }

          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            async json() {
              return {
                choices: [
                  {
                    message: { content: 'Use the discovered local model.' },
                    finish_reason: 'stop',
                  },
                ],
                usage: { prompt_tokens: 8, completion_tokens: 6, total_tokens: 14 },
              }
            },
          }
        },
      }),
    )

    expect(output).toContain('Provider/model: lm-studio/qwen3-coder-14b')
    const generationCall = calls.find((call) => call.url.endsWith('/chat/completions'))
    expect(JSON.parse(String(generationCall?.init?.body))).toMatchObject({
      model: 'qwen3-coder-14b',
    })
  })

  it('fails clearly when the default local provider is unavailable without modifying the prompt', async () => {
    const { projectRoot, promptPath } = await createPromptProject()
    const originalPrompt = await readFile(promptPath, 'utf8')

    await expect(
      captureConsoleOutput(() =>
        runExecuteCommand({
          projectRoot,
          args: ['.friday/output/plan-prompt.md', '--provider', 'local'],
          localProvider: {
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
              responseText: 'This should not be called.',
            }),
            async checkAvailability() {
              return {
                available: false,
                message: 'LM Studio is not running.',
              }
            },
          },
        }),
      ),
    ).rejects.toThrow('Local provider unavailable:')

    await expect(readFile(promptPath, 'utf8')).resolves.toBe(originalPrompt)
  })
})
