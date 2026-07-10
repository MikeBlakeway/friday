import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { buildReviewPrompt } from '../../ai/review/buildReviewPrompt.js'
import type { ChangedFileContext } from '../../ai/review/reviewPrompt.js'
import { FRIDAY_EVIDENCE_DIR } from '../../ai/evidence/evidenceFiles.js'
import { parseManualEvidence } from '../../ai/evidence/loadManualEvidence.js'
import { ensureDir, pathExists, readTextFile, writeTextFile } from '../../core/fileSystem.js'
import { FRIDAY_PROJECT_DIR } from '../../core/fridayProject.js'
import { loadProjectMemory } from '../../core/loadProjectMemory.js'
import { buildAiWorkflowSummary, printAiWorkflowSummary } from './aiWorkflowSummary.js'

const execFileAsync = promisify(execFile)
const FRIDAY_OUTPUT_DIR = 'output'
const REVIEW_PROMPT_FILE = 'review-prompt.md'

export interface ReviewArgs {
  changed: true
}

export function parseReviewArgs(args: string[]): ReviewArgs {
  if (args.length === 1 && args[0] === '--changed') {
    return { changed: true }
  }

  throw new Error('A review source is required. Usage: friday review --changed')
}

export function formatChangedFileContext(diff: string): ChangedFileContext[] {
  const trimmedDiff = diff.trim()

  if (trimmedDiff.length === 0) {
    return []
  }

  return trimmedDiff.split(/\n(?=diff --git )/).map((fileDiff) => {
    const firstLine = fileDiff.split('\n', 1)[0] ?? ''
    const match = firstLine.match(/^diff --git a\/(.+) b\/(.+)$/)
    const filePath = match?.[2] ?? firstLine.replace(/^diff --git /, '').trim()

    return {
      filePath,
      diff: fileDiff.trim(),
    }
  })
}

export function formatUntrackedFileContext(input: {
  filePath: string
  content: string
}): ChangedFileContext {
  const lines = input.content.replace(/\n$/, '').split(/\r?\n/)
  const addedLines = lines.map((line) => `+${line}`).join('\n')

  return {
    filePath: input.filePath,
    diff: [
      `diff --git a/${input.filePath} b/${input.filePath}`,
      'new file mode 100644',
      '--- /dev/null',
      `+++ b/${input.filePath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      addedLines,
    ].join('\n'),
  }
}

async function loadChangedFiles(projectRoot: string): Promise<ChangedFileContext[]> {
  const diffResult = await execFileAsync('git', ['diff', 'HEAD', '--'], {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
  })
  const untrackedResult = await execFileAsync(
    'git',
    ['ls-files', '--others', '--exclude-standard'],
    {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024,
    },
  )
  const untrackedFiles = await Promise.all(
    untrackedResult.stdout
      .trim()
      .split(/\r?\n/)
      .filter((filePath) => filePath.length > 0)
      .map(async (filePath) =>
        formatUntrackedFileContext({
          filePath,
          content: await readTextFile(path.join(projectRoot, filePath)),
        }),
      ),
  )

  return [...formatChangedFileContext(diffResult.stdout), ...untrackedFiles]
}

export async function runReviewCommand(options: {
  projectRoot: string
  args: string[]
}): Promise<void> {
  parseReviewArgs(options.args)

  const fridayProjectDirPath = path.join(options.projectRoot, FRIDAY_PROJECT_DIR)
  if (!(await pathExists(fridayProjectDirPath))) {
    throw new Error('Friday project memory is not initialized. Run "friday init" first.')
  }

  const manualEvidencePath = path.join(fridayProjectDirPath, FRIDAY_EVIDENCE_DIR, 'manual.md')
  const evidence = (await pathExists(manualEvidencePath))
    ? parseManualEvidence(await readTextFile(manualEvidencePath))
    : []
  const projectMemory = await loadProjectMemory(options.projectRoot)
  const changedFiles = await loadChangedFiles(options.projectRoot)
  const result = buildReviewPrompt({ changedFiles, projectMemory, evidence })
  const aiWorkflowSummary = buildAiWorkflowSummary({
    prompt: result.prompt,
    taskType: 'review',
    complexity: 'high',
    confidenceRequirement: 'high',
    costPreference: 'balanced',
    estimatedOutputTokens: 1000,
  })

  const outputDirPath = path.join(fridayProjectDirPath, FRIDAY_OUTPUT_DIR)
  const outputPath = path.join(outputDirPath, REVIEW_PROMPT_FILE)
  await ensureDir(outputDirPath)
  await writeTextFile(outputPath, result.prompt)

  console.log('Friday review prompt created.')
  console.log('')
  console.log('Changed files:')
  console.log(
    result.changedFileCount > 0
      ? `✓ git diff context loaded: ${result.changedFileCount} file(s)`
      : 'No changed files detected.',
  )
  console.log('')
  console.log('Loaded project memory:')
  if (result.loadedMemoryFiles.length === 0) {
    console.log('  (none)')
  } else {
    for (const fileName of result.loadedMemoryFiles) {
      console.log(`✓ .friday/${fileName}`)
    }
  }
  console.log('')
  console.log('Evidence:')
  console.log(
    result.evidenceCount > 0
      ? `✓ manual evidence loaded: ${result.evidenceCount} item(s)`
      : 'No additional evidence loaded.',
  )
  console.log('')
  console.log('Output:')
  console.log(`.friday/${FRIDAY_OUTPUT_DIR}/${REVIEW_PROMPT_FILE}`)
  console.log('')
  printAiWorkflowSummary(aiWorkflowSummary)
  console.log('')
  console.log('Next step:')
  if (aiWorkflowSummary.routeSummary.recommendation.route.blocked) {
    console.log('Remove or redact blocked context before using any AI model route.')
  } else {
    console.log('Inspect this prompt and route summary before using the recommended model route.')
  }
}
