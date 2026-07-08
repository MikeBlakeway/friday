import path from 'node:path'

import { buildEvidencePack } from '../../ai/evidence/buildEvidencePack.js'
import { FRIDAY_EVIDENCE_DIR, FRIDAY_EVIDENCE_FILES } from '../../ai/evidence/evidenceFiles.js'
import { EVIDENCE_FILE_TEMPLATES, EVIDENCE_PACK_FILE } from '../../ai/evidence/evidenceTemplates.js'
import { ensureDir, pathExists, writeFileIfMissing, writeTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'

export async function runEvidenceCommand(options: {
  projectRoot: string
  createdAt?: string
}): Promise<void> {
  const fridayProjectDirPath = path.join(options.projectRoot, FRIDAY_PROJECT_DIR)
  if (!(await pathExists(fridayProjectDirPath))) {
    throw new Error('Friday project memory is not initialized. Run "friday init" first.')
  }

  const evidenceDirPath = path.join(fridayProjectDirPath, FRIDAY_EVIDENCE_DIR)
  await ensureDir(evidenceDirPath)

  const created: string[] = []
  const skipped: string[] = []

  for (const fileName of FRIDAY_EVIDENCE_FILES) {
    const filePath = path.join(evidenceDirPath, fileName)
    const result = await writeFileIfMissing(filePath, EVIDENCE_FILE_TEMPLATES[fileName])

    if (result === 'created') {
      created.push(fileName)
    } else {
      skipped.push(fileName)
    }
  }

  const evidencePack = await buildEvidencePack({
    projectRoot: options.projectRoot,
    evidenceDirPath,
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
  })
  const evidencePackPath = path.join(evidenceDirPath, EVIDENCE_PACK_FILE)
  await writeTextFile(evidencePackPath, `${JSON.stringify(evidencePack, null, 2)}\n`)

  console.log('Friday evidence prepared.')
  console.log('')
  console.log(`Evidence directory: .friday/${FRIDAY_EVIDENCE_DIR}`)
  console.log(`Evidence pack: .friday/${FRIDAY_EVIDENCE_DIR}/${EVIDENCE_PACK_FILE}`)
  console.log('')
  console.log('Created provider files:')
  if (created.length === 0) {
    console.log('  (none)')
  } else {
    for (const fileName of created) {
      console.log(`  + .friday/${FRIDAY_EVIDENCE_DIR}/${fileName}`)
    }
  }
  console.log('')
  console.log('Existing provider files preserved:')
  if (skipped.length === 0) {
    console.log('  (none)')
  } else {
    for (const fileName of skipped) {
      console.log(`  - .friday/${FRIDAY_EVIDENCE_DIR}/${fileName}`)
    }
  }
  console.log('')
  console.log(`Loaded evidence items: ${evidencePack.summaries.length}`)
  console.log('')
  console.log('Next step:')
  console.log('Edit the provider files with local findings, then rerun "friday evidence".')
}
