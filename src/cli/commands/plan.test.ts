import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { runPlanCommand } from './plan.js'

const tempDirs: string[] = []

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-plan-command-'))
  tempDirs.push(projectRoot)
  await mkdir(path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence'), { recursive: true })
  await writeFile(
    path.join(projectRoot, FRIDAY_PROJECT_DIR, 'project.md'),
    '# Project\n\nA TypeScript CLI project.',
    'utf8',
  )
  return projectRoot
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

describe('runPlanCommand', () => {
  it('reports memory, evidence, privacy, route, warnings, and estimated cost', async () => {
    const projectRoot = await createTempProject()
    await writeFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'evidence', 'manual.md'),
      `# Manual Evidence

## Medium - Existing decision

Use local-first project memory.`,
      'utf8',
    )

    const output = await captureConsoleOutput(() =>
      runPlanCommand({ projectRoot, goal: 'Plan the next release milestone' }),
    )

    await expect(
      readFile(path.join(projectRoot, FRIDAY_PROJECT_DIR, 'output', 'plan-prompt.md'), 'utf8'),
    ).resolves.toContain('Plan the next release milestone')
    expect(output).toContain('Loaded project memory:')
    expect(output).toContain('✓ .friday/project.md')
    expect(output).toContain('✓ manual evidence loaded: 1 item(s)')
    expect(output).toContain('AI policy:')
    expect(output).toContain('Privacy level: internal')
    expect(output).toContain('Route decision: use-strong-hosted')
    expect(output).toContain('Provider/model: deepseek/deepseek-v4-pro')
    expect(output).toContain('Warnings:')
    expect(output).toContain('Estimated cost:')
    expect(output).toContain('Estimated total cost:')
  })

  it('blocks secret planning context before suggesting a hosted route', async () => {
    const projectRoot = await createTempProject()

    const output = await captureConsoleOutput(() =>
      runPlanCommand({
        projectRoot,
        goal: 'Plan with OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789',
      }),
    )

    expect(output).toContain('Privacy level: secret')
    expect(output).toContain('Blocked: yes')
    expect(output).toContain('Route decision: blocked')
    expect(output).toContain('Provider/model: none/none')
    expect(output).toContain('Not estimated because the route is blocked.')
    expect(output).toContain('Remove or redact blocked context before using any AI model route.')
  })
})
