import type { EvidenceSeverity, EvidenceSource } from '../evidence/evidence.js'
import { combineMemoryContext } from '../../core/globalMemory.js'
import type { PlanningPromptInput, PlanningPromptResult } from './planningPrompt.js'

function toHeadingCase(value: EvidenceSource | EvidenceSeverity): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`
}

export function buildPlanningPrompt(input: PlanningPromptInput): PlanningPromptResult {
  const memoryContext = combineMemoryContext({
    projectMemory: input.projectMemory,
    ...(input.globalMemory === undefined ? {} : { globalMemory: input.globalMemory }),
  })

  const memorySections = memoryContext.sections.map((file) =>
    file.source === 'global'
      ? `### Global: ${file.fileName}\n\n${file.content}`
      : `### ${file.fileName}\n\n${file.content}`,
  )
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
    'Use the global memory, project memory, and evidence below.',
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
    effectivePrivacyLevel: memoryContext.effectivePrivacyLevel,
    loadedGlobalMemoryFiles: memoryContext.loadedGlobalMemoryFiles,
    missingGlobalMemoryFiles: memoryContext.missingGlobalMemoryFiles,
    loadedMemoryFiles: memoryContext.loadedProjectMemoryFiles,
    missingMemoryFiles: memoryContext.missingProjectMemoryFiles,
    skippedDuplicateMemoryFiles: memoryContext.skippedDuplicateMemoryFiles,
    policyWarnings: memoryContext.policyWarnings,
    evidenceCount: input.evidence.length,
  }
}
