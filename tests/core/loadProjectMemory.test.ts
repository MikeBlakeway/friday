import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureDir } from '../../src/core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../src/core/fridayProject.js'
import { loadProjectMemory } from '../../src/core/loadProjectMemory.js'

const tempDirs: string[] = []

async function createTempDir(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-project-memory-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('loadProjectMemory', () => {
  it('loads existing Friday project memory files', async () => {
    const projectRoot = await createTempDir()
    const fridayDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR)
    await ensureDir(fridayDirPath)
    await writeFile(path.join(fridayDirPath, 'project.md'), '# My project', 'utf8')

    const memory = await loadProjectMemory(projectRoot)

    expect(memory.projectRoot).toBe(projectRoot)
    expect(memory.files).toContainEqual({
      fileName: 'project.md',
      filePath: path.join(fridayDirPath, 'project.md'),
      exists: true,
      content: '# My project',
    })
  })

  it('includes missing expected files without throwing', async () => {
    const projectRoot = await createTempDir()
    await ensureDir(path.join(projectRoot, FRIDAY_PROJECT_DIR))

    const memory = await loadProjectMemory(projectRoot)

    expect(memory.files).toHaveLength(6)
    expect(memory.files).toContainEqual({
      fileName: 'architecture.md',
      filePath: path.join(projectRoot, FRIDAY_PROJECT_DIR, 'architecture.md'),
      exists: false,
      content: '',
    })
  })
})
