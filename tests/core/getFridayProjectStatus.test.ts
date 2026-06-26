import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureDir } from '../../src/core/fileSystem.js'
import { FRIDAY_PROJECT_DIR, FRIDAY_PROJECT_FILES } from '../../src/core/fridayProject.js'
import { getFridayProjectStatus } from '../../src/core/getFridayProjectStatus.js'

const tempDirs: string[] = []

async function createTempDir(prefix: string): Promise<string> {
  const dirPath = await mkdtemp(path.join(os.tmpdir(), prefix))
  tempDirs.push(dirPath)
  return dirPath
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('getFridayProjectStatus', () => {
  it('reports missing .friday directory correctly', async () => {
    const projectRoot = await createTempDir('friday-status-')

    const status = await getFridayProjectStatus(projectRoot)

    expect(status.projectRoot).toBe(projectRoot)
    expect(status.hasFridayProjectDir).toBe(false)
    expect(status.files).toHaveLength(FRIDAY_PROJECT_FILES.length)
    expect(status.files.every((file) => file.exists === false)).toBe(true)
  })

  it('reports expected files correctly after creating them', async () => {
    const projectRoot = await createTempDir('friday-status-')
    const fridayDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR)
    await ensureDir(fridayDirPath)

    for (const fileName of FRIDAY_PROJECT_FILES) {
      await writeFile(path.join(fridayDirPath, fileName), 'template', {
        encoding: 'utf8',
      })
    }

    const status = await getFridayProjectStatus(projectRoot)

    expect(status.hasFridayProjectDir).toBe(true)
    expect(status.files).toHaveLength(FRIDAY_PROJECT_FILES.length)
    expect(status.files.every((file) => file.exists === true)).toBe(true)
    expect(status.files.map((file) => file.fileName)).toEqual([...FRIDAY_PROJECT_FILES])
  })
})
