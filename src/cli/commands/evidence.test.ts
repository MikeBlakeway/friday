import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { FRIDAY_EVIDENCE_FILES } from '../../ai/evidence/evidenceFiles.js'
import { runEvidenceCommand } from './evidence.js'

const tempDirs: string[] = []

async function createTempProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-evidence-command-'))
  tempDirs.push(projectRoot)
  return projectRoot
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

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
})
