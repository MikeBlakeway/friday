import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { formatChangedFileContext, formatUntrackedFileContext, parseReviewArgs } from './review.js'
import { runReviewCommand } from './review.js'

const execFileAsync = promisify(execFile)
const tempDirs: string[] = []

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-review-command-'))
  tempDirs.push(projectRoot)
  await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR), { recursive: true })
  await writeFile(
    path.join(projectRoot, FRIDAY_PROJECT_DIR, 'project.md'),
    '# Project\n\nA TypeScript CLI project.',
    'utf8',
  )
  await execFileAsync('git', ['init'], { cwd: projectRoot })
  await writeFile(path.join(projectRoot, 'README.md'), '# Test project\n', 'utf8')
  await execFileAsync('git', ['add', 'README.md', FRIDAY_PROJECT_DIR], { cwd: projectRoot })
  await execFileAsync(
    'git',
    ['-c', 'user.name=Friday Test', '-c', 'user.email=friday@example.test', 'commit', '-m', 'init'],
    { cwd: projectRoot },
  )

  return projectRoot
}

async function createTempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-review-home-'))
  tempDirs.push(homeDir)
  return homeDir
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

describe('parseReviewArgs', () => {
  it('accepts the changed-files workflow flag', () => {
    expect(parseReviewArgs(['--changed'])).toEqual({ changed: true })
  })

  it('rejects review commands without --changed', () => {
    expect(() => parseReviewArgs([])).toThrow(
      'A review source is required. Usage: friday review --changed',
    )
  })
})

describe('formatChangedFileContext', () => {
  it('groups git diff output by changed file path', () => {
    const changedFiles = formatChangedFileContext(`diff --git a/src/cli/index.ts b/src/cli/index.ts
index 1111111..2222222 100644
--- a/src/cli/index.ts
+++ b/src/cli/index.ts
@@ -1 +1,2 @@
 import { runHelpCommand } from './commands/help.js'
+import { runReviewCommand } from './commands/review.js'
diff --git a/src/cli/commands/review.ts b/src/cli/commands/review.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/cli/commands/review.ts
@@ -0,0 +1 @@
+export function runReviewCommand() {}
`)

    expect(changedFiles).toEqual([
      {
        filePath: 'src/cli/index.ts',
        diff: `diff --git a/src/cli/index.ts b/src/cli/index.ts
index 1111111..2222222 100644
--- a/src/cli/index.ts
+++ b/src/cli/index.ts
@@ -1 +1,2 @@
 import { runHelpCommand } from './commands/help.js'
+import { runReviewCommand } from './commands/review.js'`,
      },
      {
        filePath: 'src/cli/commands/review.ts',
        diff: `diff --git a/src/cli/commands/review.ts b/src/cli/commands/review.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/cli/commands/review.ts
@@ -0,0 +1 @@
+export function runReviewCommand() {}`,
      },
    ])
  })
})

describe('formatUntrackedFileContext', () => {
  it('formats untracked file contents as new-file diff context', () => {
    expect(
      formatUntrackedFileContext({
        filePath: 'src/ai/review/buildReviewPrompt.ts',
        content: "export function buildReviewPrompt() {\n  return 'prompt'\n}\n",
      }),
    ).toEqual({
      filePath: 'src/ai/review/buildReviewPrompt.ts',
      diff: `diff --git a/src/ai/review/buildReviewPrompt.ts b/src/ai/review/buildReviewPrompt.ts
new file mode 100644
--- /dev/null
+++ b/src/ai/review/buildReviewPrompt.ts
@@ -0,0 +1,3 @@
+export function buildReviewPrompt() {
+  return 'prompt'
+}`,
    })
  })
})

describe('runReviewCommand', () => {
  it('reports changed-file context, privacy, route, warnings, and estimated cost', async () => {
    const projectRoot = await createTempProject()
    const homeDir = await createTempHome()
    await mkdir(path.join(homeDir, '.friday'), { recursive: true })
    await writeFile(
      path.join(homeDir, '.friday', 'privacy-policy.md'),
      '# Privacy\n\nKeep project context local unless reviewed.',
      'utf8',
    )
    await writeFile(
      path.join(projectRoot, 'README.md'),
      '# Test project\n\nUpdated docs.\n',
      'utf8',
    )

    const output = await captureConsoleOutput(() =>
      runReviewCommand({ projectRoot, homeDir, args: ['--changed'] }),
    )

    expect(output).toContain('Changed files:')
    expect(output).toContain('✓ git diff context loaded: 1 file(s)')
    expect(output).toContain('Global memory:')
    expect(output).toContain('✓ ~/.friday/privacy-policy.md')
    expect(output).toContain('AI policy:')
    expect(output).toContain('Privacy level: internal')
    expect(output).toContain('Route decision: use-strong-hosted')
    expect(output).toContain('Provider/model: deepseek/deepseek-v4-pro')
    expect(output).toContain('Estimated cost:')
    expect(output).toContain('Estimated total cost:')
  })

  it('routes sensitive review context to local by default', async () => {
    const projectRoot = await createTempProject()
    const homeDir = await createTempHome()
    await writeFile(
      path.join(projectRoot, 'README.md'),
      '# Customer data\n\nPII and payroll.\n',
      'utf8',
    )

    const output = await captureConsoleOutput(() =>
      runReviewCommand({ projectRoot, homeDir, args: ['--changed'] }),
    )

    expect(output).toContain('Privacy level: sensitive')
    expect(output).toContain('Blocked: no')
    expect(output).toContain('Route decision: use-local')
    expect(output).toContain('Provider/model: local/local-coder')
    expect(output).toContain('Sensitive context is being kept local.')
    expect(output).toContain('Estimated total cost: 0.000000 USD')
  })
})
