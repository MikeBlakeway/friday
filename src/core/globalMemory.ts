import os from 'node:os'
import path from 'node:path'

import { classifyPromptPrivacy } from '../ai/privacy/classifyPromptPrivacy.js'
import {
  maxPrivacyLevel,
  privacyLevelRank,
  type PrivacyLevel,
} from '../ai/privacy/privacyClassification.js'
import type { ProjectMemory, ProjectMemoryFile } from './loadProjectMemory.js'
import { pathExists, readTextFile } from './fileSystem.js'

export const FRIDAY_GLOBAL_DIR = '.friday'

export const FRIDAY_GLOBAL_FILES = [
  'profile.md',
  'coding-standards.md',
  'privacy-policy.md',
  'model-policy.md',
  'cost-policy.md',
] as const

export type FridayGlobalFile = (typeof FRIDAY_GLOBAL_FILES)[number]

export interface GlobalMemoryFile {
  fileName: FridayGlobalFile
  filePath: string
  exists: boolean
  content: string
}

export interface GlobalMemory {
  homeDir: string
  globalMemoryDirPath: string
  files: GlobalMemoryFile[]
}

export interface CombinedMemorySection {
  source: 'global' | 'project'
  fileName: string
  filePath: string
  content: string
}

export interface CombinedMemoryContext {
  sections: CombinedMemorySection[]
  loadedGlobalMemoryFiles: FridayGlobalFile[]
  missingGlobalMemoryFiles: FridayGlobalFile[]
  loadedProjectMemoryFiles: string[]
  missingProjectMemoryFiles: string[]
  skippedDuplicateMemoryFiles: string[]
  effectivePrivacyLevel: PrivacyLevel
  policyWarnings: string[]
}

export interface CombineMemoryContextInput {
  globalMemory?: GlobalMemory
  projectMemory: ProjectMemory
}

export async function loadGlobalMemory(homeDir: string = os.homedir()): Promise<GlobalMemory> {
  const globalMemoryDirPath = path.join(homeDir, FRIDAY_GLOBAL_DIR)
  const files = await Promise.all(
    FRIDAY_GLOBAL_FILES.map(async (fileName) => {
      const filePath = path.join(globalMemoryDirPath, fileName)
      const exists = await pathExists(filePath)

      return {
        fileName,
        filePath,
        exists,
        content: exists ? await readTextFile(filePath) : '',
      }
    }),
  )

  return { homeDir, globalMemoryDirPath, files }
}

function nonEmptyGlobalFiles(globalMemory: GlobalMemory | undefined): GlobalMemoryFile[] {
  return globalMemory?.files.filter((file) => file.exists && file.content.trim().length > 0) ?? []
}

function nonEmptyProjectFiles(projectMemory: ProjectMemory): ProjectMemoryFile[] {
  return projectMemory.files.filter((file) => file.exists && file.content.trim().length > 0)
}

function classifyMemoryPrivacy(files: Array<{ filePath: string; content: string }>): PrivacyLevel {
  return files.reduce<PrivacyLevel>((privacyLevel, file) => {
    const classification = classifyPromptPrivacy({
      content: file.content,
      filePath: file.filePath,
    })

    return maxPrivacyLevel(privacyLevel, classification.privacyLevel)
  }, 'public')
}

export function combineMemoryContext(input: CombineMemoryContextInput): CombinedMemoryContext {
  const globalFiles = nonEmptyGlobalFiles(input.globalMemory)
  const projectFiles = nonEmptyProjectFiles(input.projectMemory)
  const seenContent = new Set<string>()
  const sections: CombinedMemorySection[] = []
  const skippedDuplicateMemoryFiles: string[] = []

  for (const file of globalFiles) {
    const trimmedContent = file.content.trim()
    seenContent.add(trimmedContent)
    sections.push({
      source: 'global',
      fileName: file.fileName,
      filePath: file.filePath,
      content: trimmedContent,
    })
  }

  for (const file of projectFiles) {
    const trimmedContent = file.content.trim()

    if (seenContent.has(trimmedContent)) {
      skippedDuplicateMemoryFiles.push(file.fileName)
      continue
    }

    seenContent.add(trimmedContent)
    sections.push({
      source: 'project',
      fileName: file.fileName,
      filePath: file.filePath,
      content: trimmedContent,
    })
  }

  const globalPrivacyLevel = classifyMemoryPrivacy(globalFiles)
  const projectPrivacyLevel = classifyMemoryPrivacy(projectFiles)
  const effectivePrivacyLevel = maxPrivacyLevel(globalPrivacyLevel, projectPrivacyLevel)
  const policyWarnings =
    privacyLevelRank[globalPrivacyLevel] > privacyLevelRank[projectPrivacyLevel]
      ? [
          `Global memory sets a ${globalPrivacyLevel} privacy floor; project memory cannot weaken it to ${projectPrivacyLevel}.`,
        ]
      : []

  return {
    sections,
    loadedGlobalMemoryFiles: globalFiles.map((file) => file.fileName),
    missingGlobalMemoryFiles:
      input.globalMemory?.files.filter((file) => !file.exists).map((file) => file.fileName) ?? [],
    loadedProjectMemoryFiles: projectFiles.map((file) => file.fileName),
    missingProjectMemoryFiles: input.projectMemory.files
      .filter((file) => !file.exists)
      .map((file) => file.fileName),
    skippedDuplicateMemoryFiles,
    effectivePrivacyLevel,
    policyWarnings,
  }
}
