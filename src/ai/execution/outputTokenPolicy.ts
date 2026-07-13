import type { AiTaskType } from '../routing/modelRouting.js'
import { detectSecrets } from '../privacy/detectSecrets.js'

export const workflowOutputTokenDefaults = {
  plan: 4_000,
  review: 3_000,
  explicitTask: 2_000,
} as const

export interface AssistantDisplayPolicy {
  maxLines: number
  maxChars: number
}

export interface FormattedAssistantResponse {
  content: string
  truncated: boolean
  redactedSecretCount: number
  policy: AssistantDisplayPolicy
}

export const assistantDisplayDefaults: AssistantDisplayPolicy = {
  maxLines: 120,
  maxChars: 12_000,
}

interface RedactionRange {
  start: number
  end: number
}

function validateDisplayPolicy(policy: AssistantDisplayPolicy): void {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Assistant display ${name} must be a positive integer.`)
    }
  }
}

function redactDetectedSecrets(content: string): {
  content: string
  redactedSecretCount: number
} {
  const ranges: RedactionRange[] = detectSecrets(content).map((secret) => {
    if (secret.kind !== 'private-key') {
      return { start: secret.index, end: secret.index + secret.length }
    }

    const remainingContent = content.slice(secret.index + secret.length)
    const endMarker = remainingContent.match(/-----END [A-Z0-9 ]*PRIVATE KEY-----/)
    return {
      start: secret.index,
      end:
        endMarker?.index === undefined
          ? content.length
          : secret.index + secret.length + endMarker.index + endMarker[0].length,
    }
  })
  const additionalPatterns = [
    /\b(?:DATABASE_URL|API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*[^\s#]+/g,
  ]

  for (const pattern of additionalPatterns) {
    for (const match of content.matchAll(pattern)) {
      const start = match.index ?? 0
      ranges.push({ start, end: start + match[0].length })
    }
  }

  if (ranges.length === 0) {
    return { content, redactedSecretCount: 0 }
  }

  for (const range of ranges) {
    while (range.start < range.end && /\s/.test(content[range.start] ?? '')) {
      range.start += 1
    }
  }

  ranges.sort((left, right) => left.start - right.start || left.end - right.end)
  const merged: RedactionRange[] = []

  for (const range of ranges) {
    const previous = merged.at(-1)
    if (previous !== undefined && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }

  let redacted = content
  for (const range of [...merged].reverse()) {
    redacted = `${redacted.slice(0, range.start)}[REDACTED BY FRIDAY]${redacted.slice(range.end)}`
  }

  return { content: redacted, redactedSecretCount: merged.length }
}

export function formatAssistantResponseForDisplay(
  content: string,
  policy: AssistantDisplayPolicy = assistantDisplayDefaults,
): FormattedAssistantResponse {
  validateDisplayPolicy(policy)
  const redacted = redactDetectedSecrets(content.trim())
  const lines = redacted.content.split(/\r?\n/)
  let displayed = lines.slice(0, policy.maxLines).join('\n')
  const linesTruncated = lines.length > policy.maxLines
  const charsTruncated = displayed.length > policy.maxChars

  if (charsTruncated) {
    displayed = displayed.slice(0, policy.maxChars)
  }

  return {
    content: displayed,
    truncated: linesTruncated || charsTruncated,
    redactedSecretCount: redacted.redactedSecretCount,
    policy: { ...policy },
  }
}

export function getDefaultMaxOutputTokens(taskType: AiTaskType): number {
  if (taskType === 'plan') {
    return workflowOutputTokenDefaults.plan
  }

  if (taskType === 'review') {
    return workflowOutputTokenDefaults.review
  }

  return workflowOutputTokenDefaults.explicitTask
}
