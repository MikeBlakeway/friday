import { access, mkdir, readFile, writeFile } from 'node:fs/promises'

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function writeFileIfMissing(
  filePath: string,
  content: string,
): Promise<'created' | 'skipped'> {
  try {
    await writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })
    return 'created'
  } catch (error) {
    const isAlreadyExists = error instanceof Error && 'code' in error && error.code === 'EEXIST'

    if (isAlreadyExists) {
      return 'skipped'
    }

    throw error
  }
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, { encoding: 'utf8' })
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, { encoding: 'utf8' })
}
