import type { EvidenceSeverity, EvidenceSource } from '../evidence/evidence.js'
import { combineMemoryContext } from '../../core/globalMemory.js'
import type { ReviewPromptInput, ReviewPromptResult } from './reviewPrompt.js'

function toHeadingCase(value: EvidenceSource | EvidenceSeverity): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`
}

export function buildReviewPrompt(input: ReviewPromptInput): ReviewPromptResult {
  const memoryContext = combineMemoryContext({
    projectMemory: input.projectMemory,
    ...(input.globalMemory === undefined ? {} : { globalMemory: input.globalMemory }),
  })

  const changedFileSections = input.changedFiles.map(
    (file) => `### ${file.filePath}\n\n\`\`\`diff\n${file.diff.trim()}\n\`\`\``,
  )
  const memorySections = memoryContext.sections.map((file) =>
    file.source === 'global'
      ? `### Global: ${file.fileName}\n\n${file.content}`
      : `### ${file.fileName}\n\n${file.content}`,
  )
  const evidenceSections = input.evidence.map(
    (evidence) =>
      `### ${toHeadingCase(evidence.source)} - ${toHeadingCase(evidence.severity)} - ${evidence.title}\n\n${evidence.content.trim()}`,
  )

  const prompt = [
    '# Friday Review Prompt',
    '',
    '## Instructions',
    '',
    'You are reviewing local software changes from deterministic git diff context.',
    '',
    'Use the changed files, global memory, project memory, and evidence below.',
    '',
    'Prioritise:',
    '',
    '- correctness bugs and regressions',
    '- missing or weak tests',
    '- privacy and secret-handling risks',
    '- local-first, inspectable workflows',
    '- simple fixes with clear trade-offs',
    '',
    'Do not invent files, commits, pull requests, or runtime behavior not shown here.',
    'If context is missing, say what is missing.',
    '',
    '## Changed Files',
    '',
    changedFileSections.length > 0
      ? changedFileSections.join('\n\n')
      : 'No changed files were detected.',
    '',
    '## Memory',
    '',
    memorySections.length > 0 ? memorySections.join('\n\n') : 'No memory was provided.',
    '',
    '## Evidence',
    '',
    evidenceSections.length > 0
      ? evidenceSections.join('\n\n')
      : 'No additional evidence was provided.',
    '',
    '## Required Output',
    '',
    'Return:',
    '',
    '1. Findings ordered by severity',
    '2. Missing context or assumptions',
    '3. Suggested tests or verification',
    '4. Smallest practical fixes',
    '',
  ].join('\n')

  return {
    prompt,
    effectivePrivacyLevel: memoryContext.effectivePrivacyLevel,
    loadedGlobalMemoryFiles: memoryContext.loadedGlobalMemoryFiles,
    missingGlobalMemoryFiles: memoryContext.missingGlobalMemoryFiles,
    loadedMemoryFiles: memoryContext.loadedProjectMemoryFiles,
    missingMemoryFiles: memoryContext.missingProjectMemoryFiles,
    skippedDuplicateMemoryFiles: memoryContext.skippedDuplicateMemoryFiles,
    policyWarnings: memoryContext.policyWarnings,
    changedFileCount: input.changedFiles.length,
    evidenceCount: input.evidence.length,
  }
}
