import path from 'node:path'

import { pathExists, readTextFile } from '../../core/fileSystem.js'
import type { EvidencePack, EvidenceSource, EvidenceSummary } from './evidence.js'
import { FRIDAY_EVIDENCE_FILES, type FridayEvidenceFile } from './evidenceFiles.js'
import { isEvidenceTemplate } from './evidenceTemplates.js'
import { parseManualEvidence } from './loadManualEvidence.js'

const PROVIDER_SUMMARY_FILES = {
  'fallow-summary.md': {
    source: 'fallow',
    title: 'Fallow summary',
  },
  'git-summary.md': {
    source: 'git',
    title: 'Git summary',
  },
  'typescript-summary.md': {
    source: 'typescript',
    title: 'TypeScript summary',
  },
  'test-summary.md': {
    source: 'test-runner',
    title: 'Test summary',
  },
} as const satisfies Partial<
  Record<
    FridayEvidenceFile,
    {
      source: EvidenceSource
      title: string
    }
  >
>

export async function buildEvidencePack(options: {
  projectRoot: string
  evidenceDirPath: string
  createdAt?: string
}): Promise<EvidencePack> {
  const summaries: EvidenceSummary[] = []

  for (const fileName of FRIDAY_EVIDENCE_FILES) {
    const filePath = path.join(options.evidenceDirPath, fileName)

    if (!(await pathExists(filePath))) {
      continue
    }

    const content = await readTextFile(filePath)

    if (isEvidenceTemplate(fileName, content)) {
      continue
    }

    if (fileName === 'manual.md') {
      summaries.push(...parseManualEvidence(content))
      continue
    }

    const providerSummary = PROVIDER_SUMMARY_FILES[fileName]
    if (!providerSummary) {
      continue
    }

    const trimmedContent = content.trim()
    if (trimmedContent.length === 0) {
      continue
    }

    summaries.push({
      source: providerSummary.source,
      title: providerSummary.title,
      content: trimmedContent,
      severity: 'info',
    })
  }

  return {
    createdAt: options.createdAt ?? new Date().toISOString(),
    projectRoot: options.projectRoot,
    summaries,
  }
}
