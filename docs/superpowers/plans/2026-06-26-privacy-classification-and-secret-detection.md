# Privacy Classification and Secret Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic local privacy safety gate that classifies prompt/context privacy and detects likely secrets before hosted model integrations exist.

**Architecture:** Add a focused `src/ai/privacy` domain layer that reuses the existing routing `PrivacyLevel` type, exposes typed privacy results, detects common secret patterns, and composes those detections with file-path and content hints. The layer is pure TypeScript with no provider calls, network calls, credential loading, CLI behavior, or routing behavior changes.

**Tech Stack:** TypeScript, Vitest, existing `npm` scripts, existing routing type from `src/ai/routing/modelRouting.ts`.

---

## File Structure

- Create `src/ai/privacy/privacyClassification.ts`: public privacy contracts and helper constants. Imports `PrivacyLevel` from routing and does not define a duplicate privacy-level union.
- Create `src/ai/privacy/detectSecrets.ts`: pure secret detection and redaction helpers.
- Create `src/ai/privacy/classifyPromptPrivacy.ts`: pure classifier that composes secret detection, declared privacy, path hints, and content hints.
- Create `src/ai/privacy/detectSecrets.test.ts`: deterministic coverage for every supported secret pattern and redaction guarantee.
- Create `src/ai/privacy/classifyPromptPrivacy.test.ts`: deterministic coverage for precedence, declared-level preservation, blocked secrets, path hints, content hints, signals, and reasons.
- Modify `README.md`: mention the safety gate foundation and current no-provider-call boundary.
- Create `docs/privacy-and-secrets.md`: concise reference for privacy levels, secret detection, limits, and future routing handoff.
- Modify `.friday/tasks.md`: mark the privacy and secret-detection foundation complete and identify the next likely follow-up.
- Modify `.friday/decisions.md`: add the decision record for adding privacy safety before provider integrations.

---

### Task 1: Secret detection domain

**Files:**

- Create: `src/ai/privacy/privacyClassification.ts`
- Create: `src/ai/privacy/detectSecrets.ts`
- Test: `src/ai/privacy/detectSecrets.test.ts`

- [ ] **Step 1: Write the failing secret detection tests**

Create `src/ai/privacy/detectSecrets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { detectSecrets, redactSecret } from './detectSecrets.js'

describe('redactSecret', () => {
  it('fully masks short values', () => {
    expect(redactSecret('12345678')).toBe('********')
    expect(redactSecret('short')).toBe('********')
  })

  it('keeps only the first and last four characters for longer values', () => {
    expect(redactSecret('sk-abc123456789xyz')).toBe('sk-a********9xyz')
  })
})

describe('detectSecrets', () => {
  it('detects OpenAI-style API keys', () => {
    const matches = detectSecrets('OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789')

    expect(matches).toMatchObject([
      {
        kind: 'api-key',
        label: 'OpenAI API key',
      },
    ])
    expect(matches[0]?.preview).toBe('sk-a********6789')
  })

  it('detects GitHub classic tokens', () => {
    const matches = detectSecrets('token ghp_abcdefghijklmnopqrstuvwxyz1234567890')

    expect(matches).toMatchObject([
      {
        kind: 'access-token',
        label: 'GitHub token',
      },
    ])
  })

  it('detects GitHub fine-grained and scoped tokens', () => {
    const matches = detectSecrets(
      [
        'github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO',
        'gho_abcdefghijklmnopqrstuvwxyz1234567890',
        'ghu_abcdefghijklmnopqrstuvwxyz1234567890',
        'ghs_abcdefghijklmnopqrstuvwxyz1234567890',
        'ghr_abcdefghijklmnopqrstuvwxyz1234567890',
      ].join('\n'),
    )

    expect(matches).toHaveLength(5)
    expect(matches.every((match) => match.kind === 'access-token')).toBe(true)
  })

  it('detects AWS access key IDs', () => {
    const matches = detectSecrets(
      'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nTEMP_KEY=ASIAIOSFODNN7EXAMPLE',
    )

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'api-key', label: 'AWS access key ID' }),
        expect.objectContaining({ kind: 'api-key', label: 'AWS temporary access key ID' }),
      ]),
    )
  })

  it('detects private key block headers', () => {
    const matches = detectSecrets(
      '-----BEGIN OPENSSH PRIVATE KEY-----\nredacted\n-----END OPENSSH PRIVATE KEY-----',
    )

    expect(matches).toMatchObject([
      {
        kind: 'private-key',
        label: 'Private key block',
      },
    ])
  })

  it('detects database URLs', () => {
    const matches = detectSecrets(
      [
        'postgres://user:pass@example.com:5432/app',
        'postgresql://user:pass@example.com/app',
        'mysql://user:pass@example.com/app',
        'mongodb://user:pass@example.com/app',
        'redis://:pass@example.com:6379',
      ].join('\n'),
    )

    expect(matches.map((match) => match.kind)).toEqual([
      'database-url',
      'database-url',
      'database-url',
      'database-url',
      'database-url',
    ])
  })

  it('detects risky environment assignments', () => {
    const matches = detectSecrets(
      [
        'DATABASE_URL=postgres://user:pass@example.com/app',
        'API_KEY=abc1234567890secret',
        'SECRET=abc1234567890secret',
        'TOKEN=abc1234567890secret',
        'PASSWORD=abc1234567890secret',
        'PRIVATE_KEY=-----BEGIN PRIVATE KEY-----',
      ].join('\n'),
    )

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'env-assignment', label: 'Risky environment assignment' }),
      ]),
    )
  })

  it('detects Authorization Bearer headers', () => {
    const matches = detectSecrets('Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890')

    expect(matches).toMatchObject([
      {
        kind: 'auth-header',
        label: 'Authorization bearer token',
      },
    ])
  })

  it('returns multiple matches with index and length metadata', () => {
    const content =
      'one sk-abc123456789xyzDEF456789xyzDEF456789 two ghp_abcdefghijklmnopqrstuvwxyz1234567890'
    const matches = detectSecrets(content)

    expect(matches).toHaveLength(2)
    expect(matches[0]?.index).toBe(content.indexOf('sk-'))
    expect(matches[0]?.length).toBe('sk-abc123456789xyzDEF456789xyzDEF456789'.length)
    expect(matches[1]?.index).toBe(content.indexOf('ghp_'))
  })

  it('returns an empty list for safe text', () => {
    expect(detectSecrets('How should I structure a TypeScript domain module?')).toEqual([])
  })

  it('does not expose full matched secret values in previews', () => {
    const values = [
      'sk-abc123456789xyzDEF456789xyzDEF456789',
      'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    ]
    const matches = detectSecrets(values.join('\n'))

    for (const value of values) {
      expect(matches.map((match) => match.preview)).not.toContain(value)
    }
    expect(matches.every((match) => match.preview.includes('********'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test -- src/ai/privacy/detectSecrets.test.ts
```

Expected result: FAIL because `src/ai/privacy/detectSecrets.ts` does not exist.

- [ ] **Step 3: Add the public privacy contracts**

Create `src/ai/privacy/privacyClassification.ts`:

```ts
import type { PrivacyLevel } from '../routing/modelRouting.js'

export type { PrivacyLevel }

export type SecretKind =
  | 'api-key'
  | 'access-token'
  | 'private-key'
  | 'database-url'
  | 'env-assignment'
  | 'auth-header'
  | 'unknown-secret'

export type PrivacySignalKind =
  | 'secret-detected'
  | 'personal-data'
  | 'private-repo-context'
  | 'sensitive-keyword'
  | 'internal-context'
  | 'public-context'

export type PrivacySignalSeverity = 'low' | 'medium' | 'high'

export interface SecretMatch {
  kind: SecretKind
  label: string
  index: number
  length: number
  preview: string
}

export interface PrivacySignal {
  kind: PrivacySignalKind
  message: string
  severity: PrivacySignalSeverity
}

export interface PrivacyClassificationInput {
  content: string
  filePath?: string
  declaredPrivacyLevel?: PrivacyLevel
}

export interface PrivacyClassificationResult {
  privacyLevel: PrivacyLevel
  secrets: SecretMatch[]
  signals: PrivacySignal[]
  blocked: boolean
  reason: string
}

export const privacyLevelRank: Record<PrivacyLevel, number> = {
  public: 0,
  internal: 1,
  'private-repo': 2,
  sensitive: 3,
  secret: 4,
}

export function maxPrivacyLevel(left: PrivacyLevel, right: PrivacyLevel): PrivacyLevel {
  return privacyLevelRank[left] >= privacyLevelRank[right] ? left : right
}
```

- [ ] **Step 4: Add the secret detector implementation**

Create `src/ai/privacy/detectSecrets.ts`:

```ts
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
    resolveLabel: (match) =>
      match.startsWith('ASIA') ? 'AWS temporary access key ID' : 'AWS access key ID',
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
```

- [ ] **Step 5: Run the secret detection tests**

Run:

```bash
npm run test -- src/ai/privacy/detectSecrets.test.ts
```

Expected result: PASS.

- [ ] **Step 6: Run typecheck for the new public contracts**

Run:

```bash
npm run typecheck
```

Expected result: PASS.

- [ ] **Step 7: Commit the secret detection domain**

Run:

```bash
git add src/ai/privacy/privacyClassification.ts src/ai/privacy/detectSecrets.ts src/ai/privacy/detectSecrets.test.ts
git commit -m "feat: add deterministic secret detection"
```

---

### Task 2: Privacy classification domain

**Files:**

- Create: `src/ai/privacy/classifyPromptPrivacy.ts`
- Test: `src/ai/privacy/classifyPromptPrivacy.test.ts`

- [ ] **Step 1: Write the failing privacy classification tests**

Create `src/ai/privacy/classifyPromptPrivacy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { classifyPromptPrivacy } from './classifyPromptPrivacy.js'

describe('classifyPromptPrivacy', () => {
  it('blocks secret content as secret', () => {
    const result = classifyPromptPrivacy({
      content: 'Use OPENAI_API_KEY=sk-abc123456789xyzDEF456789xyzDEF456789',
    })

    expect(result.privacyLevel).toBe('secret')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Hosted model use must be blocked')
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'secret-detected', severity: 'high' }),
      ]),
    )
  })

  it('blocks secret file paths even without detected secret values', () => {
    const result = classifyPromptPrivacy({
      content: 'DATABASE_URL is configured elsewhere',
      filePath: '.env.local',
    })

    expect(result.privacyLevel).toBe('secret')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('File path is likely to contain secrets')
  })

  it('respects declared sensitive privacy', () => {
    const result = classifyPromptPrivacy({
      content: 'Generic implementation note',
      declaredPrivacyLevel: 'sensitive',
    })

    expect(result.privacyLevel).toBe('sensitive')
    expect(result.blocked).toBe(false)
  })

  it('does not downgrade declared private repo privacy', () => {
    const result = classifyPromptPrivacy({
      content: 'What is the difference between arrays and tuples?',
      declaredPrivacyLevel: 'private-repo',
    })

    expect(result.privacyLevel).toBe('private-repo')
    expect(result.blocked).toBe(false)
  })

  it('classifies customer and PII context as sensitive', () => {
    const result = classifyPromptPrivacy({
      content: 'Customer data includes PII, payroll details, and medical notes.',
    })

    expect(result.privacyLevel).toBe('sensitive')
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'personal-data', severity: 'high' }),
      ]),
    )
  })

  it('classifies code-like content as private repo context', () => {
    const result = classifyPromptPrivacy({
      content: 'export const route = () => ({ file: "src/app.ts", package: "package.json" })',
    })

    expect(result.privacyLevel).toBe('private-repo')
    expect(result.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'private-repo-context' })]),
    )
  })

  it('classifies project planning context as internal', () => {
    const result = classifyPromptPrivacy({
      content: 'Project roadmap planning for the next Friday milestone and release sequencing.',
    })

    expect(result.privacyLevel).toBe('internal')
    expect(result.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'internal-context' })]),
    )
  })

  it('classifies generic public technical questions as public', () => {
    const result = classifyPromptPrivacy({
      content: 'What is dependency injection in TypeScript?',
    })

    expect(result.privacyLevel).toBe('public')
    expect(result.blocked).toBe(false)
    expect(result.signals).toEqual([
      expect.objectContaining({ kind: 'public-context', severity: 'low' }),
    ])
  })

  it('lets stronger content signals beat weaker declared privacy', () => {
    const result = classifyPromptPrivacy({
      content: 'interface CustomerRecord { pii: string; payroll: string }',
      declaredPrivacyLevel: 'internal',
    })

    expect(result.privacyLevel).toBe('sensitive')
  })

  it('preserves declared secret privacy as blocked', () => {
    const result = classifyPromptPrivacy({
      content: 'Secret material stored outside this prompt',
      declaredPrivacyLevel: 'secret',
    })

    expect(result.privacyLevel).toBe('secret')
    expect(result.blocked).toBe(true)
  })

  it('returns useful signals and a non-empty reason', () => {
    const result = classifyPromptPrivacy({
      content: 'function run() { throw new Error("failed") }\n    at src/index.ts:10:2',
      filePath: 'src/index.ts',
    })

    expect(result.signals.length).toBeGreaterThan(0)
    expect(result.reason.length).toBeGreaterThan(10)
  })
})
```

- [ ] **Step 2: Run the failing classifier tests**

Run:

```bash
npm run test -- src/ai/privacy/classifyPromptPrivacy.test.ts
```

Expected result: FAIL because `src/ai/privacy/classifyPromptPrivacy.ts` does not exist.

- [ ] **Step 3: Add the classifier implementation**

Create `src/ai/privacy/classifyPromptPrivacy.ts`:

```ts
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
```

- [ ] **Step 4: Run the classifier tests**

Run:

```bash
npm run test -- src/ai/privacy/classifyPromptPrivacy.test.ts
```

Expected result: PASS.

- [ ] **Step 5: Run the full privacy test set**

Run:

```bash
npm run test -- src/ai/privacy
```

Expected result: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected result: PASS.

- [ ] **Step 7: Commit the classifier domain**

Run:

```bash
git add src/ai/privacy/classifyPromptPrivacy.ts src/ai/privacy/classifyPromptPrivacy.test.ts
git commit -m "feat: classify prompt privacy"
```

---

### Task 3: Documentation and project memory updates

**Files:**

- Modify: `README.md`
- Create: `docs/privacy-and-secrets.md`
- Modify: `.friday/tasks.md`
- Modify: `.friday/decisions.md`

- [ ] **Step 1: Update README feature/status text**

In `README.md`, update the privacy planned-feature checklist entries from unchecked to checked when those lines exist:

```md
- [x] Privacy classification for prompts and project context
- [x] Secret detection guardrails before hosted-model routing
```

Add this paragraph near the current routing/domain status text:

```md
Friday now includes a deterministic privacy safety gate for future AI provider integrations. It classifies prompt or project context as public, internal, private-repo, sensitive, or secret, detects common secret patterns, and blocks secret context before any hosted model handoff. This foundation remains local and provider-agnostic: it does not load credentials, call model SDKs, or make network requests.
```

- [ ] **Step 2: Add the privacy and secrets document**

Create `docs/privacy-and-secrets.md`:

```md
# Privacy and Secret Safety Gate

Friday includes a deterministic local safety gate for prompt and project context before future hosted-model integrations are connected.

## Privacy levels

- `public`: generic technical or public information with no project, personal, sensitive, or secret signals.
- `internal`: project or product planning context that is not source code and does not contain sensitive or secret material.
- `private-repo`: repository code, stack traces, source-file paths, package metadata, or implementation details.
- `sensitive`: personal data, customer data, payroll, medical, credentials language, passwords, or production-database context.
- `secret`: detected secret values or file paths that are likely to contain secrets.

## Secret detection

The detector currently identifies common risky patterns:

- OpenAI-style `sk-...` keys
- GitHub classic, fine-grained, OAuth, user, server, and refresh tokens
- AWS access-key IDs beginning with `AKIA` or `ASIA`
- private-key block headers
- database URLs for PostgreSQL, MySQL, MongoDB, and Redis
- risky environment assignments such as `DATABASE_URL=...`, `API_KEY=...`, `SECRET=...`, `TOKEN=...`, `PASSWORD=...`, and `PRIVATE_KEY=...`
- `Authorization: Bearer ...` headers

Detected matches return kind, label, source index, length, and a redacted preview. Full matched secret values are not returned.

## Blocking behavior

Secret content is always classified as `secret` and `blocked: true`. Files named `.env`, `.env.local`, `.npmrc`, or `.netrc`, and paths containing `secrets`, `credentials`, or `keys`, are treated as secret even when the prompt text does not contain a detectable secret value.

## Current limits

This layer is deterministic and intentionally conservative. It is not a complete data-loss-prevention system, and it can miss novel secret formats or classify benign text conservatively. It does not call providers, load credentials, read environment variables, or make network requests.

## Future routing handoff

The classifier returns the same `PrivacyLevel` vocabulary used by the model-routing domain. A later change can compose `classifyPromptPrivacy` with `routeAiRequest` so hosted-model routes are blocked or constrained before any provider call is attempted.
```

- [ ] **Step 3: Update Friday task tracking**

In `.friday/tasks.md`, remove these entries from any backlog or in-progress section if present:

```md
- Add privacy classification for project context and prompts.
- Add secret detection and prevent unsafe hosted-model requests.
- Refine privacy classification for project context and prompts before provider integrations are introduced.
```

Add these entries under the done section:

```md
- Added deterministic privacy classification for prompts and project context.
- Added deterministic secret detection and secret-context blocking before hosted-model integrations.
```

Set the next likely task to one of these entries under the active or backlog section, matching the existing file structure:

```md
- Compose privacy classification with model routing so classified requests can be routed or blocked automatically.
- Add cost-estimation types and a transparent estimate for proposed routes.
```

- [ ] **Step 4: Add the decision record**

Append this decision to `.friday/decisions.md`:

```md
## 2026-06-26 — Add privacy safety before provider integrations

Decision: Friday classifies prompt and project context, detects common secrets, and blocks secret context before adding any hosted-model provider calls.

Rationale: Provider routing decisions need a deterministic privacy input before credentials, SDKs, or network calls exist. Building the safety gate first makes later integrations easier to test and reduces the chance that private repository context, sensitive data, or secrets are accidentally sent to hosted models.

Consequences:

- The privacy layer remains pure TypeScript with no runtime dependencies or provider behavior.
- `secret` context is blocked locally.
- Future routing composition can reuse the existing `PrivacyLevel` vocabulary instead of introducing a second policy model.
```

- [ ] **Step 5: Run documentation and formatting checks**

Run:

```bash
npm run format:check
```

Expected result: PASS.

- [ ] **Step 6: Commit the documentation updates**

Run:

```bash
git add README.md docs/privacy-and-secrets.md .friday/tasks.md .friday/decisions.md
git commit -m "docs: document privacy safety gate"
```

---

### Task 4: Final regression verification

**Files:**

- Verify: all files changed in Tasks 1-3

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected result: PASS.

- [ ] **Step 2: Run tests**

Run:

```bash
npm run test
```

Expected result: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected result: PASS.

- [ ] **Step 4: Run full project check**

Run:

```bash
npm run check
```

Expected result: PASS.

- [ ] **Step 5: Inspect changed files**

Run:

```bash
git diff --stat main...HEAD
```

Expected result: The diff only includes the privacy domain, privacy tests, README, privacy docs, Friday task tracking, and Friday decision record.

- [ ] **Step 6: Commit any verification-only fixes**

If Step 1-4 required fixes, commit only those fixes:

```bash
git add src/ai/privacy README.md docs/privacy-and-secrets.md .friday/tasks.md .friday/decisions.md
git commit -m "fix: polish privacy safety gate"
```

If Step 1-4 passed without fixes, do not create an empty commit.
