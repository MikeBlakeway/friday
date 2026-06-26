export const FRIDAY_PROJECT_DIR = '.friday'

export const FRIDAY_PROJECT_FILES = [
  'project.md',
  'architecture.md',
  'decisions.md',
  'design.md',
  'tasks.md',
  'notes.md',
] as const

export type FridayProjectFile = (typeof FRIDAY_PROJECT_FILES)[number]

export interface FridayProjectFileStatus {
  fileName: FridayProjectFile
  filePath: string
  exists: boolean
}

export interface FridayProjectStatus {
  projectRoot: string
  fridayProjectDirPath: string
  hasFridayProjectDir: boolean
  files: FridayProjectFileStatus[]
}
