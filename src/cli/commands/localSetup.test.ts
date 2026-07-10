import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { LmStudioFetch } from '../../ai/providers/lmStudioProvider.js'
import {
  parseLocalSetupArgs,
  runLocalSetupCommand,
  type LocalSetupCommandRunner,
  type LocalSetupPrompter,
} from './localSetup.js'

const tempDirs: string[] = []
const lmsAvailable = async () => true
const lmsUnavailable = async () => false

async function createTempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-local-setup-'))
  tempDirs.push(homeDir)
  return homeDir
}

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return body
    },
  }
}

function createPrompter(answers: string[]): LocalSetupPrompter {
  return {
    async ask() {
      const answer = answers.shift()

      if (answer === undefined) {
        throw new Error('Test prompter ran out of answers.')
      }

      return answer
    },
    close() {},
  }
}

function createCommandRunner(
  calls: Array<{ command: string; args: string[] }>,
  action?: (command: string, args: string[]) => Promise<void>,
): LocalSetupCommandRunner {
  return async (command, args) => {
    calls.push({ command, args })
    await action?.(command, args)
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('parseLocalSetupArgs', () => {
  it('parses explicit non-interactive provider settings and actions', () => {
    expect(
      parseLocalSetupArgs([
        '--provider',
        'lm-studio',
        '--base-url',
        'http://localhost:4321/v1',
        '--model',
        'qwen3-coder-14b',
        '--start-server',
        '--test',
      ]),
    ).toEqual({
      provider: 'lm-studio',
      baseUrl: 'http://localhost:4321/v1',
      model: 'qwen3-coder-14b',
      startServer: true,
      testProvider: true,
    })
  })

  it('rejects unsupported providers and unknown flags', () => {
    expect(() => parseLocalSetupArgs(['--provider', 'ollama'])).toThrow(
      'friday local setup currently supports only --provider lm-studio.',
    )
    expect(() => parseLocalSetupArgs(['--download'])).toThrow(
      'Unknown friday local setup option: --download.',
    )
  })
})

describe('runLocalSetupCommand', () => {
  it('automatically selects one loaded model, saves it globally, and runs an offered test', async () => {
    const homeDir = await createTempHome()
    const commandCalls: Array<{ command: string; args: string[] }> = []
    const fetchCalls: string[] = []
    const output: string[] = []
    const fetch: LmStudioFetch = async (url) => {
      fetchCalls.push(url)
      return url.endsWith('/models')
        ? response({ data: [{ id: 'qwen3-coder-14b' }] })
        : response({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10 },
          })
    }

    const result = await runLocalSetupCommand({
      args: [],
      homeDir,
      interactive: true,
      fetch,
      detectLmsCli: lmsAvailable,
      commandRunner: createCommandRunner(commandCalls),
      prompter: createPrompter(['y']),
      output: (line) => output.push(line),
    })

    expect(result).toMatchObject({
      status: 'configured',
      baseUrl: 'http://127.0.0.1:1234/v1',
      model: 'qwen3-coder-14b',
      testStatus: 'passed',
    })
    expect(commandCalls).toEqual([])
    expect(fetchCalls).toEqual([
      'http://127.0.0.1:1234/v1/models',
      'http://127.0.0.1:1234/v1/chat/completions',
    ])
    await expect(readFile(path.join(homeDir, '.friday', 'providers.json'), 'utf8')).resolves.toBe(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          defaultProvider: 'lm-studio',
          providers: {
            'lm-studio': {
              baseUrl: 'http://127.0.0.1:1234/v1',
              model: 'qwen3-coder-14b',
              autoStart: false,
            },
          },
        },
        null,
        2,
      )}\n`,
    )
    expect(output.join('\n')).toContain('✓ 1 loaded model found')
    expect(output.join('\n')).toContain('✓ Test request completed successfully')
    expect(output.at(-1)).toBe('Friday is ready to use local models.')
  })

  it('presents multiple models in discovery order and saves the selected model', async () => {
    const homeDir = await createTempHome()
    const output: string[] = []

    const result = await runLocalSetupCommand({
      args: [],
      homeDir,
      interactive: true,
      fetch: async () => response({ data: [{ id: 'qwen3-coder-14b' }, { id: 'gemma-3-12b' }] }),
      detectLmsCli: lmsAvailable,
      commandRunner: async () => undefined,
      prompter: createPrompter(['2', 'n']),
      output: (line) => output.push(line),
    })

    expect(result).toMatchObject({
      status: 'configured',
      model: 'gemma-3-12b',
      testStatus: 'skipped',
    })
    expect(output).toEqual(
      expect.arrayContaining(['Select a default model:', '1. qwen3-coder-14b', '2. gemma-3-12b']),
    )
    const configuration = JSON.parse(
      await readFile(path.join(homeDir, '.friday', 'providers.json'), 'utf8'),
    )
    expect(configuration.providers['lm-studio'].model).toBe('gemma-3-12b')
  })

  it('preserves other local provider entries when saving the LM Studio default', async () => {
    const homeDir = await createTempHome()
    const fridayDir = path.join(homeDir, '.friday')
    await mkdir(fridayDir, { recursive: true })
    await writeFile(
      path.join(fridayDir, 'providers.json'),
      JSON.stringify({
        schemaVersion: 1,
        defaultProvider: 'ollama',
        providers: {
          ollama: { baseUrl: 'http://localhost:11434/v1', autoStart: false },
        },
      }),
      'utf8',
    )

    await runLocalSetupCommand({
      args: [],
      homeDir,
      interactive: true,
      fetch: async () => response({ data: [{ id: 'qwen3-coder-14b' }] }),
      detectLmsCli: lmsAvailable,
      commandRunner: async () => undefined,
      prompter: createPrompter(['n']),
      output: () => undefined,
    })

    const configuration = JSON.parse(await readFile(path.join(fridayDir, 'providers.json'), 'utf8'))
    expect(configuration).toMatchObject({
      defaultProvider: 'lm-studio',
      providers: {
        ollama: { baseUrl: 'http://localhost:11434/v1', autoStart: false },
        'lm-studio': {
          baseUrl: 'http://127.0.0.1:1234/v1',
          model: 'qwen3-coder-14b',
          autoStart: false,
        },
      },
    })
  })

  it('does not start a stopped server or change configuration when the user cancels', async () => {
    const homeDir = await createTempHome()
    const commandCalls: Array<{ command: string; args: string[] }> = []
    const output: string[] = []

    const result = await runLocalSetupCommand({
      args: [],
      homeDir,
      interactive: true,
      fetch: async () => {
        throw new Error('connect ECONNREFUSED')
      },
      detectLmsCli: lmsAvailable,
      commandRunner: createCommandRunner(commandCalls),
      prompter: createPrompter(['n']),
      output: (line) => output.push(line),
    })

    expect(result).toEqual({ status: 'cancelled' })
    expect(commandCalls).toEqual([])
    await expect(
      readFile(path.join(homeDir, '.friday', 'providers.json'), 'utf8'),
    ).rejects.toThrow()
    expect(output.at(-1)).toBe('Setup cancelled. No configuration was changed.')
  })

  it('starts a stopped server only after confirmation and then repeats discovery', async () => {
    const homeDir = await createTempHome()
    const commandCalls: Array<{ command: string; args: string[] }> = []
    let serverStarted = false

    const result = await runLocalSetupCommand({
      args: [],
      homeDir,
      interactive: true,
      fetch: async () => {
        if (!serverStarted) {
          throw new Error('connect ECONNREFUSED')
        }

        return response({ data: [{ id: 'qwen3-coder-14b' }] })
      },
      detectLmsCli: lmsAvailable,
      commandRunner: createCommandRunner(commandCalls, async (_command, args) => {
        if (args.join(' ') === 'server start') {
          serverStarted = true
        }
      }),
      prompter: createPrompter(['y', 'n']),
      output: () => undefined,
    })

    expect(result).toMatchObject({ status: 'configured', model: 'qwen3-coder-14b' })
    expect(commandCalls).toEqual([{ command: 'lms', args: ['server', 'start'] }])
  })

  it('supports fully explicit non-interactive setup and test execution', async () => {
    const homeDir = await createTempHome()
    const calls: string[] = []

    const result = await runLocalSetupCommand({
      args: [
        '--provider',
        'lm-studio',
        '--base-url',
        'http://localhost:4321/v1',
        '--model',
        'codestral-22b',
        '--test',
      ],
      homeDir,
      interactive: false,
      fetch: async (url) => {
        calls.push(url)
        return url.endsWith('/models')
          ? response({ data: [{ id: 'codestral-22b' }, { id: 'qwen3-coder-14b' }] })
          : response({
              choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
            })
      },
      detectLmsCli: lmsAvailable,
      commandRunner: async () => undefined,
      output: () => undefined,
    })

    expect(result).toMatchObject({
      status: 'configured',
      baseUrl: 'http://localhost:4321/v1',
      model: 'codestral-22b',
      testStatus: 'passed',
    })
    expect(calls).toEqual([
      'http://localhost:4321/v1/models',
      'http://localhost:4321/v1/chat/completions',
    ])
  })

  it('rejects incomplete non-interactive setup with the exact required flags', async () => {
    await expect(
      runLocalSetupCommand({
        args: ['--model', 'qwen3-coder-14b'],
        homeDir: await createTempHome(),
        interactive: false,
        fetch: async () => response({ data: [] }),
        detectLmsCli: lmsAvailable,
        commandRunner: async () => undefined,
        output: () => undefined,
      }),
    ).rejects.toThrow(
      'Non-interactive setup requires --provider lm-studio, --base-url <url>, and --model <id>.',
    )
  })

  it('validates explicit endpoints before making a network request', async () => {
    let fetchWasCalled = false

    await expect(
      runLocalSetupCommand({
        args: [
          '--provider',
          'lm-studio',
          '--base-url',
          'https://models.example.com/v1',
          '--model',
          'qwen3-coder-14b',
        ],
        homeDir: await createTempHome(),
        interactive: false,
        fetch: async () => {
          fetchWasCalled = true
          return response({ data: [] })
        },
        detectLmsCli: lmsAvailable,
        commandRunner: async () => undefined,
        output: () => undefined,
      }),
    ).rejects.toThrow('must use http:// with localhost, 127.0.0.1, or ::1')

    expect(fetchWasCalled).toBe(false)
  })

  it('gives actionable guidance when neither LM Studio CLI nor its server is available', async () => {
    await expect(
      runLocalSetupCommand({
        args: [],
        homeDir: await createTempHome(),
        interactive: true,
        fetch: async () => {
          throw new Error('connect ECONNREFUSED')
        },
        detectLmsCli: lmsUnavailable,
        commandRunner: async () => undefined,
        prompter: createPrompter([]),
        output: () => undefined,
      }),
    ).rejects.toThrow(
      'LM Studio was not detected. Install and launch LM Studio, make the lms CLI available, load a model, and retry.',
    )
  })

  it('reports no-model and failed-test states with corrective guidance', async () => {
    const homeDir = await createTempHome()

    await expect(
      runLocalSetupCommand({
        args: [],
        homeDir,
        interactive: true,
        fetch: async () => response({ data: [] }),
        detectLmsCli: lmsAvailable,
        commandRunner: async () => undefined,
        prompter: createPrompter([]),
        output: () => undefined,
      }),
    ).rejects.toThrow('Load a model in LM Studio and retry "friday local setup".')

    await expect(
      runLocalSetupCommand({
        args: [],
        homeDir,
        interactive: true,
        fetch: async (url) => {
          if (url.endsWith('/models')) {
            return response({ data: [{ id: 'qwen3-coder-14b' }] })
          }

          throw new Error('generation failed')
        },
        detectLmsCli: lmsAvailable,
        commandRunner: async () => undefined,
        prompter: createPrompter(['y']),
        output: () => undefined,
      }),
    ).rejects.toThrow('Configuration was saved, but the test request failed:')
  })
})
