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
