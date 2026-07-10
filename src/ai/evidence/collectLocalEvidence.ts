import { execFile } from 'node:child_process'
import path from 'node:path'

import { pathExists, readTextFile, writeTextFile } from '../../core/fileSystem.js'
import type { EvidenceSource } from './evidence.js'
import type { FridayEvidenceFile } from './evidenceFiles.js'
import { isEvidenceTemplate } from './evidenceTemplates.js'

const MAX_CAPTURED_OUTPUT_LENGTH = 12_000

export interface EvidenceCommandResult {
  command: string
  args: string[]
  exitCode: number
  stdout: string
  stderr: string
}

export type EvidenceCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<EvidenceCommandResult>

interface EvidenceProviderDefinition {
  source: EvidenceSource
  title: string
  fileName: FridayEvidenceFile
  commands: Array<{
    command: string
    args: string[]
  }>
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

function formatCommandResult(result: EvidenceCommandResult): string {
  const sections = [
    `## \`${formatCommand(result.command, result.args)}\``,
    '',
    `Status: ${result.exitCode === 0 ? 'passed' : 'failed'}`,
    `Exit code: ${result.exitCode}`,
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

export const runLocalEvidenceCommand: EvidenceCommandRunner = async (command, args, cwd) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode =
          error && 'code' in error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        const errorMessage = error && exitCode === 1 && !stderr ? error.message : ''

        resolve({
          command,
          args,
          exitCode,
          stdout,
          stderr: [stderr, errorMessage].filter(Boolean).join('\n'),
        })
      },
    )
  })

export async function collectLocalEvidence(options: {
  projectRoot: string
  evidenceDirPath: string
  runCommand?: EvidenceCommandRunner
}): Promise<{ collected: FridayEvidenceFile[]; preserved: FridayEvidenceFile[] }> {
  const runCommand = options.runCommand ?? runLocalEvidenceCommand
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
        await runCommand(providerCommand.command, providerCommand.args, options.projectRoot),
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
