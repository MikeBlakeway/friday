export const FRIDAY_EVIDENCE_DIR = 'evidence' as const

export const FRIDAY_EVIDENCE_FILES = [
  'manual.md',
  'fallow-summary.md',
  'git-summary.md',
  'typescript-summary.md',
  'test-summary.md',
] as const

export type FridayEvidenceFile = (typeof FRIDAY_EVIDENCE_FILES)[number]
