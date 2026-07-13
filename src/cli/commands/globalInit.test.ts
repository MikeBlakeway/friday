import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureDir, pathExists, writeTextFile } from '../../core/fileSystem.js'
import { FRIDAY_GLOBAL_FILES } from '../../core/globalMemory.js'
import { getGlobalMemoryTemplate } from '../../core/globalMemoryTemplates.js'
import { parseGlobalInitArgs, runGlobalInitCommand, type GlobalInitPrompter } from './globalInit.js'

const tempDirs: string[] = []

async function createTempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-global-init-'))
  tempDirs.push(homeDir)
  return homeDir
}

function createPrompter(answers: string[]): GlobalInitPrompter & { questions: string[] } {
  const questions: string[] = []

  return {
    questions,
    async ask(question) {
      questions.push(question)
      return answers.shift() ?? ''
    },
    close() {},
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('parseGlobalInitArgs', () => {
  it('parses explicit minimal unattended setup flags', () => {
    expect(parseGlobalInitArgs([])).toEqual({ minimal: false, yes: false })
    expect(parseGlobalInitArgs(['--minimal', '--yes'])).toEqual({ minimal: true, yes: true })
    expect(() => parseGlobalInitArgs(['--yes'])).toThrow('--yes requires --minimal')
    expect(() => parseGlobalInitArgs(['--unknown'])).toThrow(
      'Unknown friday global init option: --unknown',
    )
  })
})

describe('runGlobalInitCommand', () => {
  it('requires an explicit minimal policy outside an interactive terminal', async () => {
    await expect(
      runGlobalInitCommand({ args: [], homeDir: await createTempHome(), interactive: false }),
    ).rejects.toThrow('Non-interactive global init requires --minimal --yes.')
  })

  it('creates every missing minimal file without overwriting authored memory', async () => {
    const homeDir = await createTempHome()
    const globalDir = path.join(homeDir, '.friday')
    const profilePath = path.join(globalDir, 'profile.md')

    await ensureDir(globalDir)
    await writeTextFile(profilePath, '# My Profile\n\nKeep this content.\n')

    const result = await runGlobalInitCommand({
      args: ['--minimal', '--yes'],
      homeDir,
      interactive: false,
      output: () => undefined,
    })

    expect(result).toEqual({
      status: 'configured',
      globalMemoryDirPath: globalDir,
      created: FRIDAY_GLOBAL_FILES.filter((fileName) => fileName !== 'profile.md'),
      skipped: ['profile.md'],
    })
    await expect(readFile(profilePath, 'utf8')).resolves.toBe(
      '# My Profile\n\nKeep this content.\n',
    )

    for (const fileName of FRIDAY_GLOBAL_FILES.filter((name) => name !== 'profile.md')) {
      await expect(readFile(path.join(globalDir, fileName), 'utf8')).resolves.toBe(
        getGlobalMemoryTemplate(fileName),
      )
    }
  })

  it('lets an interactive user select files and previews exact content before writing', async () => {
    const homeDir = await createTempHome()
    const prompter = createPrompter(['y', 'n', 'n', 'n', 'n', 'y'])
    const output: string[] = []

    const result = await runGlobalInitCommand({
      args: [],
      homeDir,
      interactive: true,
      prompter,
      output: (line) => output.push(line),
    })

    expect(result).toMatchObject({ status: 'configured', created: ['profile.md'] })
    expect(prompter.questions).toHaveLength(6)
    expect(output).toContain('--- ~/.friday/profile.md ---')
    expect(output.join('\n')).toContain(getGlobalMemoryTemplate('profile.md').trim())
    await expect(pathExists(path.join(homeDir, '.friday', 'profile.md'))).resolves.toBe(true)
    await expect(pathExists(path.join(homeDir, '.friday', 'coding-standards.md'))).resolves.toBe(
      false,
    )
  })

  it('does not write selected files when final confirmation is declined', async () => {
    const homeDir = await createTempHome()
    const prompter = createPrompter(['y', 'n', 'n', 'n', 'n', 'n'])

    await expect(
      runGlobalInitCommand({
        args: [],
        homeDir,
        interactive: true,
        prompter,
        output: () => undefined,
      }),
    ).resolves.toEqual({ status: 'cancelled' })
    await expect(pathExists(path.join(homeDir, '.friday'))).resolves.toBe(false)
  })
})
