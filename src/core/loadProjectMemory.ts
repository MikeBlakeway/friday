import path from 'node:path'

import { pathExists, readTextFile } from './fileSystem.js'
import {
  FRIDAY_PROJECT_DIR,
  FRIDAY_PROJECT_FILES,
  type FridayProjectFile,
} from './fridayProject.js'

export interface ProjectMemoryFile {
  fileName: FridayProjectFile
  filePath: string
  exists: boolean
  content: string
}

export interface ProjectMemory {
  projectRoot: string
  files: ProjectMemoryFile[]
}

export async function loadProjectMemory(projectRoot: string): Promise<ProjectMemory> {
  const fridayProjectDirPath = path.join(projectRoot, FRIDAY_PROJECT_DIR)
  const files = await Promise.all(
    FRIDAY_PROJECT_FILES.map(async (fileName) => {
      const filePath = path.join(fridayProjectDirPath, fileName)
      const exists = await pathExists(filePath)

      return {
        fileName,
        filePath,
        exists,
        content: exists ? await readTextFile(filePath) : '',
      }
    }),
  )

  return { projectRoot, files }
}
