import type { EvidenceSummary } from '../evidence/evidence.js'
import type { GlobalMemory } from '../../core/globalMemory.js'
import type { ProjectMemory } from '../../core/loadProjectMemory.js'
import type { PrivacyLevel } from '../privacy/privacyClassification.js'

export interface PlanningPromptInput {
  goal: string
  projectMemory: ProjectMemory
  globalMemory?: GlobalMemory
  evidence: EvidenceSummary[]
}

export interface PlanningPromptResult {
  prompt: string
  effectivePrivacyLevel: PrivacyLevel
  loadedGlobalMemoryFiles: string[]
  missingGlobalMemoryFiles: string[]
  loadedMemoryFiles: string[]
  missingMemoryFiles: string[]
  skippedDuplicateMemoryFiles: string[]
  policyWarnings: string[]
  evidenceCount: number
}
