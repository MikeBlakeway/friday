import type { EvidenceSummary } from '../evidence/evidence.js'
import type { ProjectMemory } from '../../core/loadProjectMemory.js'

export interface ChangedFileContext {
  filePath: string
  diff: string
}

export interface ReviewPromptInput {
  changedFiles: ChangedFileContext[]
  projectMemory: ProjectMemory
  evidence: EvidenceSummary[]
}

export interface ReviewPromptResult {
  prompt: string
  loadedMemoryFiles: string[]
  missingMemoryFiles: string[]
  changedFileCount: number
  evidenceCount: number
}
