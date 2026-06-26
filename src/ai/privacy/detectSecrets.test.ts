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
    const matches = detectSecrets('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nTEMP_KEY=ASIAIOSFODNN7EXAMPLE')

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'api-key', label: 'AWS access key ID' }),
        expect.objectContaining({ kind: 'api-key', label: 'AWS temporary access key ID' }),
      ]),
    )
  })

  it('detects private key block headers', () => {
    const matches = detectSecrets('-----BEGIN OPENSSH PRIVATE KEY-----\nredacted\n-----END OPENSSH PRIVATE KEY-----')

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
    const content = 'one sk-abc123456789xyzDEF456789xyzDEF456789 two ghp_abcdefghijklmnopqrstuvwxyz1234567890'
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
    const values = ['sk-abc123456789xyzDEF456789xyzDEF456789', 'ghp_abcdefghijklmnopqrstuvwxyz1234567890']
    const matches = detectSecrets(values.join('\n'))

    for (const value of values) {
      expect(matches.map((match) => match.preview)).not.toContain(value)
    }
    expect(matches.every((match) => match.preview.includes('********'))).toBe(true)
  })
})
