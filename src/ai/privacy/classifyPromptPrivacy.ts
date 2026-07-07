import { detectSecrets } from './detectSecrets.js'
import {
  maxPrivacyLevel,
  type PrivacyClassificationInput,
  type PrivacyClassificationResult,
  type PrivacyLevel,
  type PrivacySignal,
} from './privacyClassification.js'

const sensitivePatterns = [
  /\bcustomer data\b/i,
  /\bpersonal data\b/i,
  /\bpii\b/i,
  /\bpayroll\b/i,
  /\bmedical\b/i,
  /\bauth secret\b/i,
  /\bcredentials?\b/i,
  /\bpasswords?\b/i,
  /\bproduction database\b/i,
]

const privateRepoPatterns = [
  /\bfunction\s+[A-Za-z0-9_$]+\s*\(/,
  /\bexport\s+const\b/,
  /\binterface\s+[A-Za-z0-9_$]+\b/,
  /\bclass\s+[A-Za-z0-9_$]+\b/,
  /\bimport\s+.+\s+from\s+['"][^'"]+['"]/,
  /\bat\s+(?:[A-Za-z0-9_$./-]+)\.(?:ts|tsx|js|jsx):\d+:\d+/,
  /\bsrc\//,
  /\bpackage\.json\b/,
  /\btsconfig\.json\b/,
]

const internalPatterns = [
  /\bproject\b/i,
  /\bproduct\b/i,
  /\broadmap\b/i,
  /\bmilestone\b/i,
  /\brelease\b/i,
  /\bplanning\b/i,
]

const secretFileNames = new Set(['.env', '.npmrc', '.netrc'])
const secretPathParts = new Set(['secrets', 'credentials', 'keys'])

function hasSecretPathHint(filePath: string | undefined): boolean {
  if (filePath === undefined) {
    return false
  }

  const parts = filePath
    .split(/[\\/]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase())

  return parts.some(
    (part) => secretFileNames.has(part) || part.startsWith('.env.') || secretPathParts.has(part),
  )
}

function hasPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content))
}

function withBaseline(
  candidate: PrivacyLevel,
  declaredPrivacyLevel: PrivacyLevel | undefined,
): PrivacyLevel {
  return declaredPrivacyLevel === undefined
    ? candidate
    : maxPrivacyLevel(candidate, declaredPrivacyLevel)
}

function buildResult(
  privacyLevel: PrivacyLevel,
  signals: PrivacySignal[],
  reason: string,
  declaredPrivacyLevel: PrivacyLevel | undefined,
): PrivacyClassificationResult {
  const finalPrivacyLevel = withBaseline(privacyLevel, declaredPrivacyLevel)

  return {
    privacyLevel: finalPrivacyLevel,
    secrets: [],
    signals,
    blocked: finalPrivacyLevel === 'secret',
    reason:
      finalPrivacyLevel === privacyLevel
        ? reason
        : `Declared privacy level ${declaredPrivacyLevel} is stronger than detected ${privacyLevel} context.`,
  }
}

export function classifyPromptPrivacy(
  input: PrivacyClassificationInput,
): PrivacyClassificationResult {
  const secrets = detectSecrets(input.content)

  if (secrets.length > 0) {
    return {
      privacyLevel: 'secret',
      secrets,
      signals: [
        {
          kind: 'secret-detected',
          message: `${secrets.length} likely secret value${secrets.length === 1 ? '' : 's'} detected.`,
          severity: 'high',
        },
      ],
      blocked: true,
      reason:
        'Secrets detected. Hosted model use must be blocked until the content is removed or redacted.',
    }
  }

  if (hasSecretPathHint(input.filePath)) {
    return {
      privacyLevel: 'secret',
      secrets,
      signals: [
        {
          kind: 'sensitive-keyword',
          message: 'File path is likely to contain secrets.',
          severity: 'high',
        },
      ],
      blocked: true,
      reason: 'File path is likely to contain secrets. Hosted model use must be blocked.',
    }
  }

  if (hasPattern(input.content, sensitivePatterns)) {
    return buildResult(
      'sensitive',
      [
        {
          kind: /\b(?:customer data|personal data|pii|payroll|medical)\b/i.test(input.content)
            ? 'personal-data'
            : 'sensitive-keyword',
          message:
            'Content contains sensitive business, personal, credential, or production-data language.',
          severity: 'high',
        },
      ],
      'Sensitive content should avoid hosted models unless an explicit policy allows it.',
      input.declaredPrivacyLevel,
    )
  }

  if (
    hasPattern(input.content, privateRepoPatterns) ||
    hasPattern(input.filePath ?? '', privateRepoPatterns)
  ) {
    return buildResult(
      'private-repo',
      [
        {
          kind: 'private-repo-context',
          message:
            'Content appears to include repository code, stack traces, or source-file references.',
          severity: 'medium',
        },
      ],
      'Repository context should be treated as private project context.',
      input.declaredPrivacyLevel,
    )
  }

  if (hasPattern(input.content, internalPatterns)) {
    return buildResult(
      'internal',
      [
        {
          kind: 'internal-context',
          message: 'Content appears to describe project or product planning.',
          severity: 'medium',
        },
      ],
      'Project planning context should be treated as internal.',
      input.declaredPrivacyLevel,
    )
  }

  return buildResult(
    'public',
    [
      {
        kind: 'public-context',
        message: 'No private, sensitive, or secret signals were detected.',
        severity: 'low',
      },
    ],
    'No private, sensitive, or secret signals were detected.',
    input.declaredPrivacyLevel,
  )
}
