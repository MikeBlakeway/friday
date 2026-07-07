import type { FridayEvidenceFile } from './evidenceFiles.js'

export const EVIDENCE_PACK_FILE = 'evidence-pack.json' as const

export const EVIDENCE_FILE_TEMPLATES: Record<FridayEvidenceFile, string> = {
  'manual.md': `# Manual Evidence

Add evidence discovered by inspection. Use one section per item:

## Medium - Example finding

Describe the local evidence and why it matters.
`,
  'fallow-summary.md': `# Fallow Evidence

Replace this placeholder with local Fallow evidence.

Suggested commands:

\`\`\`bash
npm run fallow
npm run fallow:summary
\`\`\`
`,
  'git-summary.md': `# Git Evidence

Replace this placeholder with local Git evidence.

Suggested commands:

\`\`\`bash
git status -sb
git diff --stat
git log --oneline -5
\`\`\`
`,
  'typescript-summary.md': `# TypeScript Evidence

Replace this placeholder with local TypeScript evidence.

Suggested command:

\`\`\`bash
npm run typecheck
\`\`\`
`,
  'test-summary.md': `# Test Evidence

Replace this placeholder with local test evidence.

Suggested command:

\`\`\`bash
npm test
\`\`\`
`,
}

export function isEvidenceTemplate(fileName: FridayEvidenceFile, content: string): boolean {
  const trimmedContent = content.trim()

  return (
    trimmedContent === EVIDENCE_FILE_TEMPLATES[fileName].trim() ||
    trimmedContent.includes('Replace this placeholder with local')
  )
}
