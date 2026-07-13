import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'

import { ensureDir, writeFileIfMissing } from '../../core/fileSystem.js'
import { loadGlobalMemory, type FridayGlobalFile } from '../../core/globalMemory.js'
import { getGlobalMemoryTemplate } from '../../core/globalMemoryTemplates.js'

const globalInitUsage = 'friday global init [--minimal] [--yes]'

export interface GlobalInitFlags {
  minimal: boolean
  yes: boolean
}

export interface GlobalInitPrompter {
  ask(question: string): Promise<string>
  close(): void
}

export interface GlobalInitOptions {
  args: string[]
  homeDir?: string
  interactive?: boolean
  prompter?: GlobalInitPrompter
  output?: (line: string) => void
}

export type GlobalInitResult =
  | { status: 'cancelled' }
  | {
      status: 'configured'
      globalMemoryDirPath: string
      created: FridayGlobalFile[]
      skipped: FridayGlobalFile[]
    }

const memoryDescriptions: Record<FridayGlobalFile, string> = {
  'profile.md': 'general developer working preferences',
  'coding-standards.md': 'coding and validation standards',
  'privacy-policy.md': 'privacy and secret-handling policy',
  'model-policy.md': 'model selection policy',
  'cost-policy.md': 'cost and approval policy',
}

export function parseGlobalInitArgs(args: string[]): GlobalInitFlags {
  const flags: GlobalInitFlags = { minimal: false, yes: false }

  for (const arg of args) {
    switch (arg) {
      case '--minimal':
        flags.minimal = true
        break
      case '--yes':
        flags.yes = true
        break
      default:
        throw new Error(`Unknown friday global init option: ${arg}. Usage: ${globalInitUsage}`)
    }
  }

  if (flags.yes && !flags.minimal) {
    throw new Error(`--yes requires --minimal. Usage: ${globalInitUsage}`)
  }

  return flags
}

function createDefaultPrompter(): GlobalInitPrompter {
  const readline = createInterface({ input: process.stdin, output: process.stdout })

  return {
    ask(question) {
      return readline.question(question)
    },
    close() {
      readline.close()
    },
  }
}

function isConfirmation(answer: string, defaultValue: boolean): boolean {
  const normalised = answer.trim().toLowerCase()

  if (normalised.length === 0) {
    return defaultValue
  }

  return normalised === 'y' || normalised === 'yes'
}

function printPreview(selected: FridayGlobalFile[], output: (line: string) => void): void {
  output('Proposed global memory:')

  for (const fileName of selected) {
    output('')
    output(`--- ~/.friday/${fileName} ---`)
    getGlobalMemoryTemplate(fileName)
      .trimEnd()
      .split('\n')
      .forEach((line) => output(line))
  }
}

async function selectInteractiveFiles(
  missing: FridayGlobalFile[],
  prompter: GlobalInitPrompter,
): Promise<FridayGlobalFile[]> {
  const selected: FridayGlobalFile[] = []

  for (const fileName of missing) {
    const answer = await prompter.ask(
      `Create ${fileName} with minimal ${memoryDescriptions[fileName]}? [Y/n] `,
    )

    if (isConfirmation(answer, true)) {
      selected.push(fileName)
    }
  }

  return selected
}

function printResult(
  globalMemoryDirPath: string,
  created: FridayGlobalFile[],
  skipped: FridayGlobalFile[],
  output: (line: string) => void,
): void {
  output('')
  output(`Global memory directory: ${globalMemoryDirPath}`)
  output(`Created: ${created.length === 0 ? '(none)' : created.join(', ')}`)
  output(`Preserved existing: ${skipped.length === 0 ? '(none)' : skipped.join(', ')}`)
  output('Review these files whenever your cross-project preferences change.')
}

export async function runGlobalInitCommand(options: GlobalInitOptions): Promise<GlobalInitResult> {
  const flags = parseGlobalInitArgs(options.args)
  const homeDir = options.homeDir ?? os.homedir()
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  const output = options.output ?? console.log
  const globalMemory = await loadGlobalMemory(homeDir)
  const existing = globalMemory.files.filter((file) => file.exists).map((file) => file.fileName)
  const missing = globalMemory.files.filter((file) => !file.exists).map((file) => file.fileName)

  output('Friday global memory setup')
  output('Global memory is local, optional, and reused across projects.')

  if (missing.length === 0) {
    output('All global memory files already exist. Nothing was changed.')
    printResult(globalMemory.globalMemoryDirPath, [], existing, output)
    return {
      status: 'configured',
      globalMemoryDirPath: globalMemory.globalMemoryDirPath,
      created: [],
      skipped: existing,
    }
  }

  if (!interactive && (!flags.minimal || !flags.yes)) {
    throw new Error(
      `Non-interactive global init requires --minimal --yes. Usage: ${globalInitUsage}`,
    )
  }

  const ownsPrompter = interactive && options.prompter === undefined
  const prompter = interactive ? (options.prompter ?? createDefaultPrompter()) : undefined

  try {
    const selected = flags.minimal
      ? missing
      : await selectInteractiveFiles(missing, prompter as GlobalInitPrompter)

    if (selected.length === 0) {
      output('Setup cancelled. No global memory files were selected.')
      return { status: 'cancelled' }
    }

    printPreview(selected, output)

    if (!flags.yes) {
      const confirmed = isConfirmation(
        await (prompter as GlobalInitPrompter).ask('Write these files? [y/N] '),
        false,
      )

      if (!confirmed) {
        output('Setup cancelled. No files were written.')
        return { status: 'cancelled' }
      }
    }

    await ensureDir(globalMemory.globalMemoryDirPath)
    const created: FridayGlobalFile[] = []
    const skipped = [...existing]

    for (const fileName of selected) {
      const result = await writeFileIfMissing(
        path.join(globalMemory.globalMemoryDirPath, fileName),
        getGlobalMemoryTemplate(fileName),
      )

      if (result === 'created') {
        created.push(fileName)
      } else {
        skipped.push(fileName)
      }
    }

    printResult(globalMemory.globalMemoryDirPath, created, skipped, output)

    return {
      status: 'configured',
      globalMemoryDirPath: globalMemory.globalMemoryDirPath,
      created,
      skipped,
    }
  } finally {
    if (ownsPrompter) {
      prompter?.close()
    }
  }
}
