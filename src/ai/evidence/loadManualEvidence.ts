import type { EvidenceSeverity, EvidenceSummary } from './evidence.js'

const EVIDENCE_SEVERITIES: readonly EvidenceSeverity[] = ['info', 'low', 'medium', 'high']

function isEvidenceSeverity(value: string): value is EvidenceSeverity {
  return (EVIDENCE_SEVERITIES as readonly string[]).includes(value)
}

function parseHeading(heading: string): {
  severity: EvidenceSeverity
  title: string
} {
  const trimmedHeading = heading.trim()
  const parts = trimmedHeading.split(/\s+[—-]\s+/, 2)

  if (parts.length !== 2) {
    return {
      severity: 'info',
      title: trimmedHeading,
    }
  }

  const severityPart = parts[0]
  const titlePart = parts[1]

  if (!severityPart || !titlePart) {
    return {
      severity: 'info',
      title: trimmedHeading,
    }
  }

  const severityCandidate = severityPart.toLowerCase().trim()

  return {
    severity: isEvidenceSeverity(severityCandidate) ? severityCandidate : 'info',
    title: titlePart.trim(),
  }
}

export function parseManualEvidence(content: string): EvidenceSummary[] {
  const summaries: EvidenceSummary[] = []
  const lines = content.split(/\r?\n/)

  let activeHeading: string | undefined
  let activeSectionLines: string[] = []

  function flushSection(): void {
    if (!activeHeading) {
      return
    }

    const sectionContent = activeSectionLines.join('\n').trim()
    if (sectionContent.length === 0) {
      return
    }

    const { severity, title } = parseHeading(activeHeading)
    summaries.push({
      source: 'manual',
      title,
      content: sectionContent,
      severity,
    })
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/)

    if (headingMatch) {
      flushSection()
      activeHeading = headingMatch[1]
      activeSectionLines = []
      continue
    }

    if (!activeHeading) {
      continue
    }

    activeSectionLines.push(line)
  }

  flushSection()

  return summaries
}
