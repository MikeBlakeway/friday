import path from 'node:path'

import { buildPlanningPrompt } from '../../ai/planning/buildPlanningPrompt.js'
import { FRIDAY_EVIDENCE_DIR } from '../../ai/evidence/evidenceFiles.js'
import { parseManualEvidence } from '../../ai/evidence/loadManualEvidence.js'
import { ensureDir, pathExists, readTextFile, writeTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { loadGlobalMemory } from '../../core/globalMemory.js'
import { loadProjectMemory } from '../../core/loadProjectMemory.js'
import { buildAiWorkflowSummary, printAiWorkflowSummary } from './aiWorkflowSummary.js'
import { getDefaultMaxOutputTokens } from '../../ai/execution/outputTokenPolicy.js'
import {
  createStatusReporter,
  withStatusPhase,
  workflowPhaseLabels,
  type StatusReporter,
} from '../ui/statusReporter.js'

const FRIDAY_OUTPUT_DIR = 'output'
const PLAN_PROMPT_FILE = 'plan-prompt.md'

export async function runPlanCommand(options: {
  projectRoot: string
  goal: string
  homeDir?: string
  statusReporter?: StatusReporter
}): Promise<void> {
  const goal = options.goal.trim()

  if (goal.length === 0) {
    throw new Error('A planning goal is required. Usage: friday plan <goal...>')
  }

  const fridayProjectDirPath = path.join(options.projectRoot, FRIDAY_PROJECT_DIR)
  if (!(await pathExists(fridayProjectDirPath))) {
    throw new Error('Friday project memory is not initialized. Run "friday init" first.')
  }

  const statusReporter = options.statusReporter ?? createStatusReporter()
  const result = await withStatusPhase(
    statusReporter,
    workflowPhaseLabels.promptBuild,
    async () => {
      const manualEvidencePath = path.join(fridayProjectDirPath, FRIDAY_EVIDENCE_DIR, 'manual.md')
      const evidence = (await pathExists(manualEvidencePath))
        ? parseManualEvidence(await readTextFile(manualEvidencePath))
        : []
      const projectMemory = await loadProjectMemory(options.projectRoot)
      const globalMemory = await loadGlobalMemory(options.homeDir)
      return buildPlanningPrompt({ goal, projectMemory, globalMemory, evidence })
    },
  )
  const aiWorkflowSummary = await withStatusPhase(
    statusReporter,
    workflowPhaseLabels.privacyClassification,
    () =>
      buildAiWorkflowSummary({
        prompt: result.prompt,
        declaredPrivacyLevel: result.effectivePrivacyLevel,
        taskType: 'plan',
        complexity: 'high',
        confidenceRequirement: 'standard',
        costPreference: 'balanced',
        estimatedOutputTokens: getDefaultMaxOutputTokens('plan'),
      }),
  )
  await withStatusPhase(statusReporter, workflowPhaseLabels.providerRouting, () =>
    Promise.resolve(aiWorkflowSummary.routeSummary.recommendation.route),
  )

  const outputDirPath = path.join(fridayProjectDirPath, FRIDAY_OUTPUT_DIR)
  const outputPath = path.join(outputDirPath, PLAN_PROMPT_FILE)
  await withStatusPhase(statusReporter, workflowPhaseLabels.outputWriting, async () => {
    await ensureDir(outputDirPath)
    await writeTextFile(outputPath, result.prompt)
  })

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
  console.log('Global memory:')
  if (result.loadedGlobalMemoryFiles.length === 0) {
    console.log('  loaded: (none)')
  } else {
    for (const fileName of result.loadedGlobalMemoryFiles) {
      console.log(`✓ ~/.friday/${fileName}`)
    }
  }
  console.log(
    result.missingGlobalMemoryFiles.length > 0
      ? `  missing: ${result.missingGlobalMemoryFiles.map((fileName) => `~/.friday/${fileName}`).join(', ')}`
      : '  missing: (none)',
  )
  if (result.skippedDuplicateMemoryFiles.length > 0) {
    console.log(
      `  skipped duplicate project memory: ${result.skippedDuplicateMemoryFiles.join(', ')}`,
    )
  }
  console.log('')
  if (result.policyWarnings.length > 0) {
    console.log('Memory policy:')
    for (const warning of result.policyWarnings) {
      console.log(`- ${warning}`)
    }
    console.log('')
  }
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
  printAiWorkflowSummary(aiWorkflowSummary)
  console.log('')
  console.log('Next step:')
  if (aiWorkflowSummary.routeSummary.recommendation.route.blocked) {
    console.log('Remove or redact blocked context before using any AI model route.')
  } else {
    console.log('Inspect this prompt and route summary before using the recommended model route.')
  }
}
