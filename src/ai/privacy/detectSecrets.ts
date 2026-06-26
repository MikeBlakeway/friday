import type { SecretKind, SecretMatch } from './privacyClassification.js'

interface SecretPattern {
  kind: SecretKind
  label: string
  pattern: RegExp
  resolveLabel?: (match: string) => string
}

const secretPatterns: SecretPattern[] = [
  {
    kind: 'api-key',
    label: 'OpenAI API key',
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    kind: 'access-token',
    label: 'GitHub token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    kind: 'access-token',
    label: 'GitHub fine-grained token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  },
  {
    kind: 'api-key',
    label: 'AWS access key ID',
    pattern: /\bA(?:KIA|SIA)[A-Z0-9]{16}\b/g,
    resolveLabel: (match) => (match.startsWith('ASIA') ? 'AWS temporary access key ID' : 'AWS access key ID'),
  },
  {
    kind: 'private-key',
    label: 'Private key block',
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    kind: 'database-url',
    label: 'Database URL',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s'"<>]+/g,
  },
  {
    kind: 'env-assignment',
    label: 'Risky environment assignment',
    pattern: /(?:^|\n)\s*(?:DATABASE_URL|API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*[^\s#]+/g,
  },
  {
    kind: 'auth-header',
    label: 'Authorization bearer token',
    pattern: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  },
]

export function redactSecret(value: string): string {
  if (value.length <= 8) {
    return '********'
  }

  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

export function detectSecrets(content: string): SecretMatch[] {
  const matches: SecretMatch[] = []

  for (const secretPattern of secretPatterns) {
    for (const match of content.matchAll(secretPattern.pattern)) {
      const value = match[0]
      const index = match.index ?? 0

      matches.push({
        kind: secretPattern.kind,
        label: secretPattern.resolveLabel?.(value) ?? secretPattern.label,
        index,
        length: value.length,
        preview: redactSecret(value),
      })
    }
  }

  return matches.sort((left, right) => left.index - right.index)
}
