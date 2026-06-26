import type { EvidenceSeverity, EvidenceSource } from '../evidence/evidence.js'
import type { PlanningPromptInput, PlanningPromptResult } from './planningPrompt.js'

function toHeadingCase(value: EvidenceSource | EvidenceSeverity): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`
}

export function buildPlanningPrompt(input: PlanningPromptInput): PlanningPromptResult {
  const memoryFiles = input.projectMemory.files.filter(
    (file) => file.exists && file.content.trim().length > 0,
  )
  const loadedMemoryFiles = memoryFiles.map((file) => file.fileName)
  const missingMemoryFiles = input.projectMemory.files
    .filter((file) => !file.exists)
    .map((file) => file.fileName)

  const memorySections = memoryFiles.map((file) => `### ${file.fileName}\n\n${file.content.trim()}`)
  const evidenceSections = input.evidence.map(
    (evidence) =>
      `### ${toHeadingCase(evidence.source)} — ${toHeadingCase(evidence.severity)} — ${evidence.title}\n\n${evidence.content.trim()}`,
  )

  const prompt = [
    '# Friday Planning Prompt',
    '',
    '## Goal',
    '',
    input.goal.trim(),
    '',
    '## Instructions',
    '',
    'You are helping plan the next step for this software project.',
    '',
    'Use the project memory and evidence below.',
    '',
    'Prioritise:',
    '',
    '- practical implementation steps',
    '- strongly typed TypeScript',
    '- privacy-aware design',
    '- cost-conscious AI usage',
    '- simple architecture',
    '- clear trade-offs',
    '- small incremental delivery',
    '',
    'Do not invent existing code or project decisions.',
    'If context is missing, say what is missing.',
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
    '1. Recommended approach',
    '2. Implementation steps',
    '3. Files likely to change',
    '4. Risks and trade-offs',
    '5. Questions to resolve',
    '6. Suggested first commit',
    '',
  ].join('\n')

  return {
    prompt,
    loadedMemoryFiles,
    missingMemoryFiles,
    evidenceCount: input.evidence.length,
  }
}
