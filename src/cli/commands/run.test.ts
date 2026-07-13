import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMockModelProvider } from '../../ai/providers/mockModelProvider.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import type { StatusReporter } from '../ui/statusReporter.js'
import { parseRunArgs, runWorkflowCommand } from './run.js'

const execFileAsync = promisify(execFile)
const tempDirs: string[] = []

async function createProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-run-project-'))
  tempDirs.push(projectRoot)
  await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR), { recursive: true })
  await writeFile(
    path.join(projectRoot, FRIDAY_PROJECT_DIR, 'project.md'),
    '# Project\n\nA local TypeScript CLI.',
    'utf8',
  )
  await execFileAsync('git', ['init'], { cwd: projectRoot })
  await writeFile(path.join(projectRoot, 'README.md'), '# Test project\n', 'utf8')
  await execFileAsync('git', ['add', '.'], { cwd: projectRoot })
  await execFileAsync(
    'git',
    ['-c', 'user.name=Friday Test', '-c', 'user.email=friday@example.test', 'commit', '-m', 'init'],
    { cwd: projectRoot },
  )
  return projectRoot
}

async function createConfiguredHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-run-home-'))
  tempDirs.push(homeDir)
  await mkdir(path.join(homeDir, '.friday'), { recursive: true })
  await writeFile(
    path.join(homeDir, '.friday', 'providers.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      defaultProvider: 'lm-studio',
      providers: { 'lm-studio': { model: 'mock-coder' } },
    })}\n`,
    'utf8',
  )
  return homeDir
}

function createLocalProvider() {
  return createMockModelProvider({
    capabilities: {
      provider: 'lm-studio',
      model: 'mock-coder',
      hosted: false,
      supportsStreaming: false,
      supportsToolCalls: false,
      supportedInputModalities: ['text'],
      supportedOutputModalities: ['text'],
      maxInputTokens: 16_000,
      maxOutputTokens: 16_000,
      contextWindowTokens: 16_000,
    },
    responseText: 'Use the prepared local plan.',
  })
}

function createStatusRecorder(): { reporter: StatusReporter; events: string[] } {
  const events: string[] = []
  return {
    events,
    reporter: {
      start(message) {
        events.push(`start:${message}`)
      },
      success(message) {
        events.push(`success:${message ?? ''}`)
      },
      warn(message) {
        events.push(`warn:${message}`)
      },
      fail(message) {
        events.push(`fail:${message ?? ''}`)
      },
    },
  }
}

async function captureOutput(action: () => Promise<void>): Promise<string> {
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

describe('parseRunArgs', () => {
  it('uses shared workflow defaults and identifies explicit ceilings', () => {
    expect(parseRunArgs(['plan', 'Review the architecture', '--yes'])).toMatchObject({
      maxOutputTokens: 4_000,
      maxOutputTokensExplicit: false,
    })
    expect(parseRunArgs(['review', '--changed', '--yes'])).toMatchObject({
      maxOutputTokens: 3_000,
      maxOutputTokensExplicit: false,
    })
    expect(
      parseRunArgs(['plan', 'Review the architecture', '--max-output-tokens', '6000', '--yes']),
    ).toMatchObject({
      maxOutputTokens: 6_000,
      maxOutputTokensExplicit: true,
    })
    expect(
      parseRunArgs([
        'plan',
        'Review the architecture',
        '--display-max-lines',
        '25',
        '--display-max-chars',
        '2000',
        '--yes',
      ]),
    ).toMatchObject({ displayMaxLines: 25, displayMaxChars: 2000 })
  })

  it('parses plan and review workflows with explicit overrides', () => {
    expect(
      parseRunArgs([
        'plan',
        'Review the architecture',
        '--provider',
        'lm-studio',
        '--model',
        'qwen-local',
        '--yes',
      ]),
    ).toMatchObject({
      workflow: 'plan',
      goal: 'Review the architecture',
      provider: 'lm-studio',
      model: 'qwen-local',
      yes: true,
    })
    expect(parseRunArgs(['review', '--changed', '--yes'])).toMatchObject({
      workflow: 'review',
      changed: true,
      yes: true,
    })
  })
})

describe('runWorkflowCommand', () => {
  it('prepares and executes a planning workflow with inspectable artifacts', async () => {
    const projectRoot = await createProject()
    const homeDir = await createConfiguredHome()
    const provider = createLocalProvider()
    const status = createStatusRecorder()

    const output = await captureOutput(() =>
      runWorkflowCommand({
        projectRoot,
        homeDir,
        args: ['plan', 'Review the architecture', '--yes'],
        localProvider: provider,
        statusReporter: status.reporter,
        now: () => new Date('2026-07-10T12:00:00.000Z'),
      }),
    )

    await expect(
      readFile(path.join(projectRoot, '.friday/output/plan-prompt.md'), 'utf8'),
    ).resolves.toContain('Review the architecture')
    const executions = await readdir(path.join(projectRoot, '.friday/output/executions'))
    expect(executions).toEqual(['plan-prompt-2026-07-10T12-00-00-000Z.json'])
    expect(provider.requests).toHaveLength(1)
    expect(output).toContain('Friday run pre-execution summary')
    expect(output).toContain('Workflow: plan')
    expect(output).toContain('Provider/model: lm-studio/mock-coder')
    expect(output).toContain('Effective output allowance: 4000 tokens')
    expect(output).toContain('Adaptive retry: one retry up to 8000 tokens')
    expect(output).toContain('Expected output: .friday/output/executions/')
    expect(output).toContain('Assistant response:\nUse the prepared local plan.')
    expect(output).toContain('Result artefact: .friday/output/executions/')
    expect(status.events).toEqual([
      'start:Prompt build',
      'success:',
      'start:Privacy classification',
      'success:',
      'start:Provider routing',
      'success:',
      'start:Output writing',
      'success:',
      'start:Model execution',
      'success:',
      'start:Output writing',
      'success:',
    ])
  })

  it('reuses the changed-files review preparation workflow', async () => {
    const projectRoot = await createProject()
    const homeDir = await createConfiguredHome()
    const provider = createLocalProvider()
    await writeFile(path.join(projectRoot, 'README.md'), '# Test project\n\nChanged.\n', 'utf8')

    await captureOutput(() =>
      runWorkflowCommand({
        projectRoot,
        homeDir,
        args: ['review', '--changed', '--yes'],
        localProvider: provider,
      }),
    )

    await expect(
      readFile(path.join(projectRoot, '.friday/output/review-prompt.md'), 'utf8'),
    ).resolves.toContain('Changed Files')
    expect(provider.requests[0]?.taskType).toBe('review')
  })

  it('blocks secret-bearing input before provider invocation', async () => {
    const projectRoot = await createProject()
    const homeDir = await createConfiguredHome()
    const provider = createLocalProvider()

    await expect(
      captureOutput(() =>
        runWorkflowCommand({
          projectRoot,
          homeDir,
          args: ['plan', 'Use OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789', '--yes'],
          localProvider: provider,
        }),
      ),
    ).rejects.toThrow('blocked this prompt before provider invocation')
    expect(provider.requests).toEqual([])
  })

  it('fails clearly when global provider configuration is missing', async () => {
    const projectRoot = await createProject()
    const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-run-empty-home-'))
    tempDirs.push(homeDir)

    await expect(
      captureOutput(() =>
        runWorkflowCommand({
          projectRoot,
          homeDir,
          args: ['plan', 'Review the architecture', '--yes'],
          localProvider: createLocalProvider(),
        }),
      ),
    ).rejects.toThrow('No global provider configuration found')
  })

  it('requires approval before invoking the provider', async () => {
    const projectRoot = await createProject()
    const homeDir = await createConfiguredHome()
    const provider = createLocalProvider()
    const confirm = vi.fn().mockResolvedValue(false)

    await expect(
      captureOutput(() =>
        runWorkflowCommand({
          projectRoot,
          homeDir,
          args: ['plan', 'Review the architecture'],
          localProvider: provider,
          interactive: true,
          confirm,
        }),
      ),
    ).rejects.toThrow('Friday run cancelled before provider invocation')
    expect(confirm).toHaveBeenCalledOnce()
    expect(provider.requests).toEqual([])
  })

  it('reports an unavailable provider without writing an execution artifact', async () => {
    const projectRoot = await createProject()
    const homeDir = await createConfiguredHome()
    const provider = {
      ...createLocalProvider(),
      async checkAvailability() {
        return { available: false, message: 'LM Studio is not running.' }
      },
    }

    await expect(
      captureOutput(() =>
        runWorkflowCommand({
          projectRoot,
          homeDir,
          args: ['plan', 'Review the architecture', '--yes'],
          localProvider: provider,
        }),
      ),
    ).rejects.toThrow('Local provider unavailable: LM Studio is not running.')
    expect(provider.requests).toEqual([])
  })

  it('finishes the active model phase with failure when provider execution throws', async () => {
    const projectRoot = await createProject()
    const homeDir = await createConfiguredHome()
    const provider = createLocalProvider()
    const status = createStatusRecorder()
    provider.generateResponse = async () => {
      throw new Error('Local model crashed.')
    }

    await expect(
      captureOutput(() =>
        runWorkflowCommand({
          projectRoot,
          homeDir,
          args: ['plan', 'Review the architecture', '--yes'],
          localProvider: provider,
          statusReporter: status.reporter,
        }),
      ),
    ).rejects.toThrow('Local model crashed.')

    expect(status.events.at(-2)).toBe('start:Model execution')
    expect(status.events.at(-1)).toBe('fail:')
  })
})
