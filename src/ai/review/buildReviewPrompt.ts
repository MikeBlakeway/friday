import type { EvidenceSeverity, EvidenceSource } from '../evidence/evidence.js'
import type { ReviewPromptInput, ReviewPromptResult } from './reviewPrompt.js'

function toHeadingCase(value: EvidenceSource | EvidenceSeverity): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`
}

export function buildReviewPrompt(input: ReviewPromptInput): ReviewPromptResult {
  const memoryFiles = input.projectMemory.files.filter(
    (file) => file.exists && file.content.trim().length > 0,
  )
  const loadedMemoryFiles = memoryFiles.map((file) => file.fileName)
  const missingMemoryFiles = input.projectMemory.files
    .filter((file) => !file.exists)
    .map((file) => file.fileName)

  const changedFileSections = input.changedFiles.map(
    (file) => `### ${file.filePath}\n\n\`\`\`diff\n${file.diff.trim()}\n\`\`\``,
  )
  const memorySections = memoryFiles.map((file) => `### ${file.fileName}\n\n${file.content.trim()}`)
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
    'Use the changed files, project memory, and evidence below.',
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
    '## Project Memory',
    '',
    memorySections.length > 0 ? memorySections.join('\n\n') : 'No project memory was provided.',
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
    loadedMemoryFiles,
    missingMemoryFiles,
    changedFileCount: input.changedFiles.length,
    evidenceCount: input.evidence.length,
  }
}
