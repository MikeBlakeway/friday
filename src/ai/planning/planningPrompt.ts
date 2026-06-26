import type { EvidenceSummary } from '../evidence/evidence.js'
import type { ProjectMemory } from '../../core/loadProjectMemory.js'

export interface PlanningPromptInput {
  goal: string
  projectMemory: ProjectMemory
  evidence: EvidenceSummary[]
}

export interface PlanningPromptResult {
  prompt: string
  loadedMemoryFiles: string[]
  missingMemoryFiles: string[]
  evidenceCount: number
}
