import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import {
  type EvidenceCommandResult,
  runLocalEvidenceCommand,
} from '../../ai/evidence/collectLocalEvidence.js'
import { FRIDAY_EVIDENCE_FILES } from '../../ai/evidence/evidenceFiles.js'
import { parseEvidenceArgs, runEvidenceCommand } from './evidence.js'

const tempDirs: string[] = []

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-evidence-command-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
  vi.restoreAllMocks()
})

function commandResult(
  input: Omit<EvidenceCommandResult, 'timedOut' | 'timeoutMs'> &
    Partial<Pick<EvidenceCommandResult, 'timedOut' | 'timeoutMs'>>,
): EvidenceCommandResult {
  return {
    timedOut: false,
    timeoutMs: 120_000,
    ...input,
  }
}

describe('runEvidenceCommand', () => {
  it('requires initialized Friday project memory', async () => {
    const projectRoot = await createTempProject()

    await expect(runEvidenceCommand({ projectRoot })).rejects.toThrow(
      'Friday project memory is not initialized. Run "friday init" first.',
    )
  })

  it('creates evidence provider files and a local evidence pack', async () => {
    const projectRoot = await createTempProject()
    await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR))

    await runEvidenceCommand({ projectRoot, createdAt: '2026-07-07T12:00:00.000Z' })

    for (const fileName of FRIDAY_EVIDENCE_FILES) {
      await expect(
        readFile(path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence', fileName), 'utf8'),
      ).resolves.toContain('#')
    }

    const evidencePack = JSON.parse(
      await readFile(
        path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence', 'evidence-pack.json'),
        'utf8',
      ),
    )

    expect(evidencePack).toEqual({
      createdAt: '2026-07-07T12:00:00.000Z',
      projectRoot,
      summaries: [],
    })
  })

  it('preserves existing manual evidence and includes it in the pack', async () => {
    const projectRoot = await createTempProject()
    const evidenceDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence')
    await mkdir(evidenceDirPath, { recursive: true })
    await writeFile(
      path.join(evidenceDirPath, 'manual.md'),
      `# Manual Evidence

## Medium - Important note

Keep this existing note.`,
      'utf8',
    )

    await runEvidenceCommand({ projectRoot, createdAt: '2026-07-07T12:00:00.000Z' })

    const manualEvidence = await readFile(path.join(evidenceDirPath, 'manual.md'), 'utf8')
    expect(manualEvidence).toContain('Keep this existing note.')

    const evidencePack = JSON.parse(
      await readFile(path.join(evidenceDirPath, 'evidence-pack.json'), 'utf8'),
    )
    expect(evidencePack.summaries).toEqual([
      {
        source: 'manual',
        title: 'Important note',
        content: 'Keep this existing note.',
        severity: 'medium',
      },
    ])
  })

  it('collects deterministic local provider output into the evidence pack', async () => {
    const projectRoot = await createTempProject()
    await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR))
    const runCommand = vi.fn(async (command: string, args: string[]) =>
      commandResult({
        command,
        args,
        exitCode: 0,
        stdout: `${command} ${args.join(' ')} passed\n`,
        stderr: '',
      }),
    )

    await runEvidenceCommand({
      projectRoot,
      args: ['--collect'],
      createdAt: '2026-07-07T12:00:00.000Z',
      runCommand,
    })

    expect(runCommand).toHaveBeenCalledTimes(5)
    expect(runCommand).toHaveBeenCalledWith(
      'git',
      ['status', '-sb'],
      projectRoot,
      expect.objectContaining({ timeoutMs: 120_000 }),
    )

    const evidencePack = JSON.parse(
      await readFile(
        path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence', 'evidence-pack.json'),
        'utf8',
      ),
    )
    expect(evidencePack.summaries).toHaveLength(4)
    expect(evidencePack.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'git',
          content: expect.stringContaining('git status -sb passed'),
        }),
        expect.objectContaining({
          source: 'typescript',
          content: expect.stringContaining('Status: passed'),
        }),
      ]),
    )
  })

  it('captures provider command failures without aborting collection', async () => {
    const projectRoot = await createTempProject()
    await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR))

    await runEvidenceCommand({
      projectRoot,
      args: ['--collect'],
      createdAt: '2026-07-07T12:00:00.000Z',
      runCommand: async (command, args) =>
        commandResult({
          command,
          args,
          exitCode: command === 'npm' && args.includes('typecheck') ? 2 : 0,
          stdout: '',
          stderr: command === 'npm' && args.includes('typecheck') ? 'Type error\n' : '',
        }),
    })

    const typeScriptSummary = await readFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence', 'typescript-summary.md'),
      'utf8',
    )
    expect(typeScriptSummary).toContain('Status: failed')
    expect(typeScriptSummary).toContain('Exit code: 2')
    expect(typeScriptSummary).toContain('Type error')
  })

  it('records timed-out commands and continues collecting remaining providers', async () => {
    const projectRoot = await createTempProject()
    await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR))

    await runEvidenceCommand({
      projectRoot,
      args: ['--collect', '--timeout-ms', '25'],
      runCommand: async (command, args, _cwd, runOptions) =>
        commandResult({
          command,
          args,
          exitCode: command === 'npm' && args.includes('typecheck') ? 124 : 0,
          stdout: '',
          stderr:
            command === 'npm' && args.includes('typecheck')
              ? `Command exceeded timeout after ${runOptions.timeoutMs} ms and was terminated.`
              : '',
          timedOut: command === 'npm' && args.includes('typecheck'),
          timeoutMs: runOptions.timeoutMs,
        }),
    })

    const evidenceDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence')
    const typeScriptSummary = await readFile(
      path.join(evidenceDirPath, 'typescript-summary.md'),
      'utf8',
    )
    const testSummary = await readFile(path.join(evidenceDirPath, 'test-summary.md'), 'utf8')

    expect(typeScriptSummary).toContain('Status: timed out')
    expect(typeScriptSummary).toContain('Timeout: 25 ms')
    expect(typeScriptSummary).toContain('Command exceeded timeout after 25 ms')
    expect(testSummary).toContain('Status: passed')
  })

  it('prints the local command execution plan before collection', async () => {
    const projectRoot = await createTempProject()
    await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR))
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runEvidenceCommand({
      projectRoot,
      args: ['--collect', '--timeout-ms', '5000'],
      runCommand: async (command, args) =>
        commandResult({
          command,
          args,
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        }),
    })

    expect(log.mock.calls.map(([message]) => message).join('\n')).toContain(
      `Collection will execute these local commands:
  $ git status -sb
  $ git diff --stat
  $ npm run typecheck
  $ npm test
  $ npm run fallow
Per-command timeout: 5000 ms`,
    )
  })

  it('preserves user-authored provider summaries during collection', async () => {
    const projectRoot = await createTempProject()
    const evidenceDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence')
    await mkdir(evidenceDirPath, { recursive: true })
    await writeFile(
      path.join(evidenceDirPath, 'git-summary.md'),
      '# Git Evidence\n\nKeep this authored summary.\n',
      'utf8',
    )

    await runEvidenceCommand({
      projectRoot,
      args: ['--collect'],
      runCommand: async (command, args) =>
        commandResult({
          command,
          args,
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
        }),
    })

    await expect(readFile(path.join(evidenceDirPath, 'git-summary.md'), 'utf8')).resolves.toBe(
      '# Git Evidence\n\nKeep this authored summary.\n',
    )
  })
})

describe('runLocalEvidenceCommand', () => {
  it('terminates long-running commands and records timeout evidence', async () => {
    const projectRoot = await createTempProject()

    const result = await runLocalEvidenceCommand(
      process.execPath,
      ['-e', 'setTimeout(() => undefined, 10_000)'],
      projectRoot,
      { timeoutMs: 25 },
    )

    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
    expect(result.timeoutMs).toBe(25)
    expect(result.stderr).toContain('Command exceeded timeout after 25 ms and was terminated.')
  })
})

describe('parseEvidenceArgs', () => {
  it('enables deterministic collection explicitly', () => {
    expect(parseEvidenceArgs(['--collect'])).toEqual({ collect: true, timeoutMs: 120_000 })
    expect(parseEvidenceArgs([])).toEqual({ collect: false, timeoutMs: 120_000 })
  })

  it('configures the per-command timeout', () => {
    expect(parseEvidenceArgs(['--collect', '--timeout-ms', '30000'])).toEqual({
      collect: true,
      timeoutMs: 30_000,
    })
  })

  it('rejects unknown evidence options', () => {
    expect(() => parseEvidenceArgs(['--overwrite'])).toThrow(
      'Unknown evidence option: --overwrite.',
    )
  })

  it('rejects invalid timeout values', () => {
    expect(() => parseEvidenceArgs(['--timeout-ms', '0'])).toThrow(
      '--timeout-ms must be a positive integer.',
    )
    expect(() => parseEvidenceArgs(['--timeout-ms'])).toThrow('Missing value for --timeout-ms.')
  })
})
