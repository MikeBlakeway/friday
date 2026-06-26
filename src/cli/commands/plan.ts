import path from 'node:path'

import { buildPlanningPrompt } from '../../ai/planning/buildPlanningPrompt.js'
import { FRIDAY_EVIDENCE_DIR } from '../../ai/evidence/evidenceFiles.js'
import { parseManualEvidence } from '../../ai/evidence/loadManualEvidence.js'
import { ensureDir, pathExists, readTextFile, writeTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { loadProjectMemory } from '../../core/loadProjectMemory.js'

const FRIDAY_OUTPUT_DIR = 'output'
const PLAN_PROMPT_FILE = 'plan-prompt.md'

export async function runPlanCommand(options: {
  projectRoot: string
  goal: string
}): Promise<void> {
  const goal = options.goal.trim()

  if (goal.length === 0) {
    throw new Error('A planning goal is required. Usage: friday plan <goal...>')
  }

  const fridayProjectDirPath = path.join(options.projectRoot, FRIDAY_PROJECT_DIR)
  if (!(await pathExists(fridayProjectDirPath))) {
    throw new Error('Friday project memory is not initialized. Run "friday init" first.')
  }

  const manualEvidencePath = path.join(fridayProjectDirPath, FRIDAY_EVIDENCE_DIR, 'manual.md')
  const evidence = (await pathExists(manualEvidencePath))
    ? parseManualEvidence(await readTextFile(manualEvidencePath))
    : []
  const projectMemory = await loadProjectMemory(options.projectRoot)
  const result = buildPlanningPrompt({ goal, projectMemory, evidence })

  const outputDirPath = path.join(fridayProjectDirPath, FRIDAY_OUTPUT_DIR)
  const outputPath = path.join(outputDirPath, PLAN_PROMPT_FILE)
  await ensureDir(outputDirPath)
  await writeTextFile(outputPath, result.prompt)

  console.log('Friday planning prompt created.')
  console.log('')
  console.log('Goal:')
  console.log(goal)
  console.log('')
  console.log('Loaded project memory:')
  if (result.loadedMemoryFiles.length === 0) {
    console.log('  (none)')
  } else {
    for (const fileName of result.loadedMemoryFiles) {
      console.log(`✓ .friday/${fileName}`)
    }
  }
  console.log('')
  console.log('Evidence:')
  console.log(
    result.evidenceCount > 0
      ? `✓ manual evidence loaded: ${result.evidenceCount} item(s)`
      : 'No additional evidence loaded.',
  )
  console.log('')
  console.log('Output:')
  console.log(`.friday/${FRIDAY_OUTPUT_DIR}/${PLAN_PROMPT_FILE}`)
  console.log('')
  console.log('Next step:')
  console.log('Paste this prompt into your chosen AI model, or use a future Friday model route.')
}
