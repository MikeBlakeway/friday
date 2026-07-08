import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureDir } from '../../core/fileSystem.js'
import { buildEvidencePack } from './buildEvidencePack.js'
import { FRIDAY_EVIDENCE_DIR } from './evidenceFiles.js'

const tempDirs: string[] = []

async function createTempEvidenceDir(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-evidence-pack-'))
  tempDirs.push(projectRoot)

  const evidenceDirPath = path.join(projectRoot, FRIDAY_EVIDENCE_DIR)
  await ensureDir(evidenceDirPath)

  return projectRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('buildEvidencePack', () => {
  it('loads structured manual evidence and provider summary evidence', async () => {
    const projectRoot = await createTempEvidenceDir()
    const evidenceDirPath = path.join(projectRoot, FRIDAY_EVIDENCE_DIR)

    await writeFile(
      path.join(evidenceDirPath, 'manual.md'),
      `# Manual Evidence

## High - Auth gap

Auth has no integration tests.`,
      'utf8',
    )
    await writeFile(
      path.join(evidenceDirPath, 'typescript-summary.md'),
      `# TypeScript Evidence

Typecheck passes locally.`,
      'utf8',
    )

    const pack = await buildEvidencePack({
      projectRoot,
      evidenceDirPath,
      createdAt: '2026-07-07T12:00:00.000Z',
    })

    expect(pack).toEqual({
      createdAt: '2026-07-07T12:00:00.000Z',
      projectRoot,
      summaries: [
        {
          source: 'manual',
          title: 'Auth gap',
          content: 'Auth has no integration tests.',
          severity: 'high',
        },
        {
          source: 'typescript',
          title: 'TypeScript summary',
          content: '# TypeScript Evidence\n\nTypecheck passes locally.',
          severity: 'info',
        },
      ],
    })
  })

  it('ignores provider placeholder files', async () => {
    const projectRoot = await createTempEvidenceDir()
    const evidenceDirPath = path.join(projectRoot, FRIDAY_EVIDENCE_DIR)

    await writeFile(
      path.join(evidenceDirPath, 'git-summary.md'),
      `# Git Evidence

Replace this placeholder with local Git evidence.`,
      'utf8',
    )

    const pack = await buildEvidencePack({
      projectRoot,
      evidenceDirPath,
      createdAt: '2026-07-07T12:00:00.000Z',
    })

    expect(pack.summaries).toEqual([])
  })
})
