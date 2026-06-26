export type EvidenceSource = 'fallow' | 'git' | 'typescript' | 'test-runner' | 'manual'

export type EvidenceSeverity = 'info' | 'low' | 'medium' | 'high'

export interface EvidenceSummary {
  source: EvidenceSource
  title: string
  content: string
  severity: EvidenceSeverity
}

export interface EvidencePack {
  createdAt: string
  projectRoot: string
  summaries: EvidenceSummary[]
}
