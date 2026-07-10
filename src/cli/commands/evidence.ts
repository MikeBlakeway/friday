import path from 'node:path'

import { buildEvidencePack } from '../../ai/evidence/buildEvidencePack.js'
import {
  collectLocalEvidence,
  type EvidenceCommandRunner,
} from '../../ai/evidence/collectLocalEvidence.js'
import { FRIDAY_EVIDENCE_DIR, FRIDAY_EVIDENCE_FILES } from '../../ai/evidence/evidenceFiles.js'
import { EVIDENCE_FILE_TEMPLATES, EVIDENCE_PACK_FILE } from '../../ai/evidence/evidenceTemplates.js'
import { ensureDir, pathExists, writeFileIfMissing, writeTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'

export function parseEvidenceArgs(args: string[]): { collect: boolean } {
  let collect = false

  for (const arg of args) {
    if (arg === '--collect') {
      collect = true
      continue
    }

    throw new Error(`Unknown evidence option: ${arg}.`)
  }

  return { collect }
}

function logEvidenceFiles(heading: string, marker: '+' | '-', fileNames: readonly string[]): void {
  console.log(heading)
  if (fileNames.length === 0) {
    console.log('  (none)')
    return
  }

  for (const fileName of fileNames) {
    console.log(`  ${marker} .friday/${FRIDAY_EVIDENCE_DIR}/${fileName}`)
  }
}

function logCollectionResult(collection: {
  collected: readonly string[]
  preserved: readonly string[]
}): void {
  logEvidenceFiles('Collected provider files:', '+', collection.collected)
  console.log('')
  logEvidenceFiles('User-authored provider files preserved:', '-', collection.preserved)
  console.log('')
}

export async function runEvidenceCommand(options: {
  projectRoot: string
  args?: string[]
  createdAt?: string
  runCommand?: EvidenceCommandRunner
}): Promise<void> {
  const commandOptions = parseEvidenceArgs(options.args ?? [])
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

  const collection = commandOptions.collect
    ? await collectLocalEvidence({
        projectRoot: options.projectRoot,
        evidenceDirPath,
        ...(options.runCommand ? { runCommand: options.runCommand } : {}),
      })
    : { collected: [], preserved: [] }

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
  logEvidenceFiles('Created provider files:', '+', created)
  console.log('')
  logEvidenceFiles('Existing provider files preserved:', '-', skipped)
  console.log('')
  if (commandOptions.collect) {
    logCollectionResult(collection)
  }
  console.log(`Loaded evidence items: ${evidencePack.summaries.length}`)
  console.log('')
  console.log('Next step:')
  if (commandOptions.collect) {
    console.log('Inspect the collected provider files and evidence pack.')
  } else {
    console.log(
      'Edit the provider files manually, or rerun "friday evidence --collect" to collect them.',
    )
  }
}
