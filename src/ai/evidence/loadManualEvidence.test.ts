import { describe, expect, it } from 'vitest'

import type { EvidenceSummary } from './evidence.js'
import { parseManualEvidence } from './loadManualEvidence.js'

describe('parseManualEvidence', () => {
  it('parses a single evidence item', () => {
    const content = `# Manual Evidence

## High — Auth risk

The auth module currently has no integration tests.`

    const result = parseManualEvidence(content)
    const expected: EvidenceSummary[] = [
      {
        source: 'manual',
        title: 'Auth risk',
        content: 'The auth module currently has no integration tests.',
        severity: 'high',
      },
    ]

    expect(result).toEqual(expected)
  })

  it('parses multiple evidence items', () => {
    const content = `# Manual Evidence

## High — Auth risk

The auth module currently has no integration tests.

## Medium — Duplicate provider pattern

The provider setup has similar construction logic in multiple files.

## Info — Product note

The project is still in early foundation stage.`

    const result = parseManualEvidence(content)
    const expected: EvidenceSummary[] = [
      {
        source: 'manual',
        title: 'Auth risk',
        content: 'The auth module currently has no integration tests.',
        severity: 'high',
      },
      {
        source: 'manual',
        title: 'Duplicate provider pattern',
        content: 'The provider setup has similar construction logic in multiple files.',
        severity: 'medium',
      },
      {
        source: 'manual',
        title: 'Product note',
        content: 'The project is still in early foundation stage.',
        severity: 'info',
      },
    ]

    expect(result).toEqual(expected)
  })

  it('supports em dash separators', () => {
    const content = `## Low — Build warning

A single warning appears during CI builds.`

    const result = parseManualEvidence(content)

    expect(result).toEqual([
      {
        source: 'manual',
        title: 'Build warning',
        content: 'A single warning appears during CI builds.',
        severity: 'low',
      },
    ] satisfies EvidenceSummary[])
  })

  it('supports hyphen separators', () => {
    const content = `## Medium - Duplicate utility

A utility function is repeated in two modules.`

    const result = parseManualEvidence(content)

    expect(result).toEqual([
      {
        source: 'manual',
        title: 'Duplicate utility',
        content: 'A utility function is repeated in two modules.',
        severity: 'medium',
      },
    ] satisfies EvidenceSummary[])
  })

  it('handles severity case-insensitively', () => {
    const content = `## hIgH — Elevated risk

The migration path is currently untested.`

    const result = parseManualEvidence(content)

    expect(result).toEqual([
      {
        source: 'manual',
        title: 'Elevated risk',
        content: 'The migration path is currently untested.',
        severity: 'high',
      },
    ] satisfies EvidenceSummary[])
  })

  it('defaults invalid severity to info', () => {
    const content = `## Critical — Incident note

A non-standard severity should map to info.`

    const result = parseManualEvidence(content)

    expect(result).toEqual([
      {
        source: 'manual',
        title: 'Incident note',
        content: 'A non-standard severity should map to info.',
        severity: 'info',
      },
    ] satisfies EvidenceSummary[])
  })

  it('ignores empty sections', () => {
    const content = `## High — Empty


## Info — Useful note

This section has content.`

    const result = parseManualEvidence(content)

    expect(result).toEqual([
      {
        source: 'manual',
        title: 'Useful note',
        content: 'This section has content.',
        severity: 'info',
      },
    ] satisfies EvidenceSummary[])
  })
})
