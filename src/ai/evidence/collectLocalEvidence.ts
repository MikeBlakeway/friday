import { execFile } from 'node:child_process'
import path from 'node:path'

import { pathExists, readTextFile, writeTextFile } from '../../core/fileSystem.js'
import type { EvidenceSource } from './evidence.js'
import type { FridayEvidenceFile } from './evidenceFiles.js'
import { isEvidenceTemplate } from './evidenceTemplates.js'

const MAX_CAPTURED_OUTPUT_LENGTH = 12_000
const DEFAULT_COMMAND_TIMEOUT_MS = 120_000
const TERMINATION_GRACE_MS = 500

export interface EvidenceCommand {
  command: string
  args: string[]
}

export interface EvidenceCommandRunOptions {
  timeoutMs: number
  signal?: AbortSignal
}

export interface EvidenceCommandResult {
  command: string
  args: string[]
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  timeoutMs: number
}

export type EvidenceCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
  options: EvidenceCommandRunOptions,
) => Promise<EvidenceCommandResult>

interface EvidenceProviderDefinition {
  source: EvidenceSource
  title: string
  fileName: FridayEvidenceFile
  commands: EvidenceCommand[]
}

const EVIDENCE_PROVIDERS: EvidenceProviderDefinition[] = [
  {
    source: 'git',
    title: 'Git Evidence',
    fileName: 'git-summary.md',
    commands: [
      { command: 'git', args: ['status', '-sb'] },
      { command: 'git', args: ['diff', '--stat'] },
    ],
  },
  {
    source: 'typescript',
    title: 'TypeScript Evidence',
    fileName: 'typescript-summary.md',
    commands: [{ command: 'npm', args: ['run', 'typecheck'] }],
  },
  {
    source: 'test-runner',
    title: 'Test Evidence',
    fileName: 'test-summary.md',
    commands: [{ command: 'npm', args: ['test'] }],
  },
  {
    source: 'fallow',
    title: 'Fallow Evidence',
    fileName: 'fallow-summary.md',
    commands: [{ command: 'npm', args: ['run', 'fallow'] }],
  },
]

function normalizeOutput(output: string): string {
  const normalized = output.replaceAll('\r\n', '\n').trim()

  if (normalized.length === 0) {
    return '(no output)'
  }

  if (normalized.length <= MAX_CAPTURED_OUTPUT_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, MAX_CAPTURED_OUTPUT_LENGTH)}\n\n[output truncated by Friday]`
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(' ')
}

export function formatEvidenceCommand(command: EvidenceCommand): string {
  return formatCommand(command.command, command.args)
}

export function listLocalEvidenceCommands(): EvidenceCommand[] {
  return EVIDENCE_PROVIDERS.flatMap((provider) => provider.commands)
}

function formatCommandResult(result: EvidenceCommandResult): string {
  const sections = [
    `## \`${formatCommand(result.command, result.args)}\``,
    '',
    `Status: ${result.timedOut ? 'timed out' : result.exitCode === 0 ? 'passed' : 'failed'}`,
    `Exit code: ${result.exitCode}`,
    `Timeout: ${result.timeoutMs} ms`,
    '',
    '### Standard output',
    '',
    '````text',
    normalizeOutput(result.stdout),
    '````',
  ]

  if (result.stderr.trim().length > 0) {
    sections.push('', '### Standard error', '', '````text', normalizeOutput(result.stderr), '````')
  }

  return sections.join('\n')
}

function createTimedOutResult(
  command: string,
  args: string[],
  stdout: string,
  stderr: string,
  timeoutMs: number,
): EvidenceCommandResult {
  return {
    command,
    args,
    exitCode: 124,
    stdout,
    stderr: [stderr, `Command exceeded timeout after ${timeoutMs} ms and was terminated.`]
      .filter(Boolean)
      .join('\n'),
    timedOut: true,
    timeoutMs,
  }
}

export const runLocalEvidenceCommand: EvidenceCommandRunner = async (command, args, cwd, options) =>
  new Promise((resolve) => {
    let timedOut = false
    let resolved = false
    let latestStdout = ''
    let latestStderr = ''
    let forceKillTimer: NodeJS.Timeout | undefined

    const child = execFile(
      command,
      args,
      { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, signal: options.signal },
      (error, stdout, stderr) => {
        if (resolved) {
          return
        }
        resolved = true
        clearTimeout(timeoutTimer)
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
        }

        if (timedOut) {
          resolve(createTimedOutResult(command, args, stdout, stderr, options.timeoutMs))
          return
        }

        const exitCode =
          error && 'code' in error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        const errorMessage = error && exitCode === 1 && !stderr ? error.message : ''

        resolve({
          command,
          args,
          exitCode,
          stdout,
          stderr: [stderr, errorMessage].filter(Boolean).join('\n'),
          timedOut: false,
          timeoutMs: options.timeoutMs,
        })
      },
    )

    child.stdout?.on('data', (chunk: string | Buffer) => {
      latestStdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: string | Buffer) => {
      latestStderr += chunk.toString()
    })

    const timeoutTimer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), TERMINATION_GRACE_MS)
    }, options.timeoutMs)

    options.signal?.addEventListener(
      'abort',
      () => {
        if (resolved) {
          return
        }
        resolved = true
        clearTimeout(timeoutTimer)
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
        }
        child.kill('SIGTERM')
        resolve({
          command,
          args,
          exitCode: 130,
          stdout: latestStdout,
          stderr: [latestStderr, 'Command interrupted and was terminated.']
            .filter(Boolean)
            .join('\n'),
          timedOut: false,
          timeoutMs: options.timeoutMs,
        })
      },
      { once: true },
    )
  })

export async function collectLocalEvidence(options: {
  projectRoot: string
  evidenceDirPath: string
  runCommand?: EvidenceCommandRunner
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<{ collected: FridayEvidenceFile[]; preserved: FridayEvidenceFile[] }> {
  const runCommand = options.runCommand ?? runLocalEvidenceCommand
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
  const collected: FridayEvidenceFile[] = []
  const preserved: FridayEvidenceFile[] = []

  for (const provider of EVIDENCE_PROVIDERS) {
    const filePath = path.join(options.evidenceDirPath, provider.fileName)

    if (await pathExists(filePath)) {
      const existingContent = await readTextFile(filePath)
      if (!isEvidenceTemplate(provider.fileName, existingContent)) {
        preserved.push(provider.fileName)
        continue
      }
    }

    const results: EvidenceCommandResult[] = []
    for (const providerCommand of provider.commands) {
      results.push(
        await runCommand(providerCommand.command, providerCommand.args, options.projectRoot, {
          timeoutMs,
          ...(options.signal ? { signal: options.signal } : {}),
        }),
      )
    }

    const content = [
      `# ${provider.title}`,
      '',
      `Source: ${provider.source}`,
      'Collected locally by `friday evidence --collect`.',
      '',
      results.map(formatCommandResult).join('\n\n'),
      '',
    ].join('\n')
    await writeTextFile(filePath, content)
    collected.push(provider.fileName)
  }

  return { collected, preserved }
}
