import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureDir } from '../../src/core/fileSystem.js'
import {
  FRIDAY_GLOBAL_DIR,
  combineMemoryContext,
  loadGlobalMemory,
} from '../../src/core/globalMemory.js'
import { FRIDAY_PROJECT_DIR } from '../../src/core/fridayProject.js'
import { loadProjectMemory } from '../../src/core/loadProjectMemory.js'

const tempDirs: string[] = []

async function createTempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-global-memory-'))
  tempDirs.push(homeDir)
  return homeDir
}

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-project-memory-'))
  tempDirs.push(projectRoot)
  await ensureDir(path.join(projectRoot, FRIDAY_PROJECT_DIR))
  return projectRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('loadGlobalMemory', () => {
  it('continues when the global Friday directory does not exist', async () => {
    const homeDir = await createTempHome()

    const memory = await loadGlobalMemory(homeDir)

    expect(memory.homeDir).toBe(homeDir)
    expect(memory.files).toHaveLength(5)
    expect(memory.files.every((file) => !file.exists && file.content === '')).toBe(true)
  })

  it('loads existing global files deterministically and reports missing files', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, FRIDAY_GLOBAL_DIR)
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'privacy-policy.md'),
      '# Privacy\n\nKeep PII local.',
      'utf8',
    )

    const memory = await loadGlobalMemory(homeDir)

    expect(memory.files.map((file) => file.fileName)).toEqual([
      'profile.md',
      'coding-standards.md',
      'privacy-policy.md',
      'model-policy.md',
      'cost-policy.md',
    ])
    expect(memory.files).toContainEqual({
      fileName: 'privacy-policy.md',
      filePath: path.join(globalDirPath, 'privacy-policy.md'),
      exists: true,
      content: '# Privacy\n\nKeep PII local.',
    })
    expect(memory.files.filter((file) => !file.exists).map((file) => file.fileName)).toEqual([
      'profile.md',
      'coding-standards.md',
      'model-policy.md',
      'cost-policy.md',
    ])
  })
})

describe('combineMemoryContext', () => {
  it('combines complete global memory with project memory in a stable order', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, FRIDAY_GLOBAL_DIR)
    await mkdir(globalDirPath, { recursive: true })

    for (const fileName of [
      'profile.md',
      'coding-standards.md',
      'privacy-policy.md',
      'model-policy.md',
      'cost-policy.md',
    ]) {
      await writeFile(path.join(globalDirPath, fileName), `# ${fileName}`, 'utf8')
    }

    const projectRoot = await createTempProject()
    await writeFile(path.join(projectRoot, FRIDAY_PROJECT_DIR, 'project.md'), '# Project', 'utf8')

    const context = combineMemoryContext({
      globalMemory: await loadGlobalMemory(homeDir),
      projectMemory: await loadProjectMemory(projectRoot),
    })

    expect(context.sections.map((section) => `${section.source}:${section.fileName}`)).toEqual([
      'global:profile.md',
      'global:coding-standards.md',
      'global:privacy-policy.md',
      'global:model-policy.md',
      'global:cost-policy.md',
      'project:project.md',
    ])
    expect(context.missingGlobalMemoryFiles).toEqual([])
  })

  it('does not duplicate identical global and project content', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, FRIDAY_GLOBAL_DIR)
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(path.join(globalDirPath, 'profile.md'), '# Shared memory', 'utf8')

    const projectRoot = await createTempProject()
    await writeFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'notes.md'),
      '# Shared memory\n',
      'utf8',
    )

    const context = combineMemoryContext({
      globalMemory: await loadGlobalMemory(homeDir),
      projectMemory: await loadProjectMemory(projectRoot),
    })

    expect(context.sections.map((section) => section.fileName)).toEqual(['profile.md'])
    expect(context.skippedDuplicateMemoryFiles).toEqual(['notes.md'])
  })

  it('keeps the stricter global privacy floor when project memory is weaker', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, FRIDAY_GLOBAL_DIR)
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'privacy-policy.md'),
      '# Privacy\n\nCustomer data, PII, payroll, and credentials must stay local.',
      'utf8',
    )

    const projectRoot = await createTempProject()
    await writeFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'project.md'),
      '# Public brochure',
      'utf8',
    )

    const context = combineMemoryContext({
      globalMemory: await loadGlobalMemory(homeDir),
      projectMemory: await loadProjectMemory(projectRoot),
    })

    expect(context.effectivePrivacyLevel).toBe('sensitive')
    expect(context.policyWarnings).toEqual([
      'Global memory sets a sensitive privacy floor; project memory cannot weaken it to public.',
    ])
  })

  it('allows project memory to strengthen global policy', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, FRIDAY_GLOBAL_DIR)
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'privacy-policy.md'),
      '# Privacy\n\nPublic notes are ok.',
      'utf8',
    )

    const projectRoot = await createTempProject()
    await writeFile(
      path.join(projectRoot, FRIDAY_PROJECT_DIR, 'notes.md'),
      'Credentials are mentioned in this project policy.',
      'utf8',
    )

    const context = combineMemoryContext({
      globalMemory: await loadGlobalMemory(homeDir),
      projectMemory: await loadProjectMemory(projectRoot),
    })

    expect(context.effectivePrivacyLevel).toBe('sensitive')
    expect(context.policyWarnings).toEqual([])
  })
})
