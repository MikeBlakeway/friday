import type { EvidenceSummary } from '../evidence/evidence.js'
import type { GlobalMemory } from '../../core/globalMemory.js'
import type { ProjectMemory } from '../../core/loadProjectMemory.js'
import type { PrivacyLevel } from '../privacy/privacyClassification.js'

export interface ChangedFileContext {
  filePath: string
  diff: string
}

export interface ReviewPromptInput {
  changedFiles: ChangedFileContext[]
  projectMemory: ProjectMemory
  globalMemory?: GlobalMemory
  evidence: EvidenceSummary[]
}

export interface ReviewPromptResult {
  prompt: string
  effectivePrivacyLevel: PrivacyLevel
  loadedGlobalMemoryFiles: string[]
  missingGlobalMemoryFiles: string[]
  loadedMemoryFiles: string[]
  missingMemoryFiles: string[]
  skippedDuplicateMemoryFiles: string[]
  policyWarnings: string[]
  changedFileCount: number
  evidenceCount: number
}
