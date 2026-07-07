import { describe, expect, it } from 'vitest'

import { formatRoutePreview, parseRoutePreviewArgs } from './route.js'

describe('parseRoutePreviewArgs', () => {
  it('builds routing input from route preview flags', () => {
    const input = parseRoutePreviewArgs([
      '--task',
      'review',
      '--privacy',
      'private-repo',
      '--complexity',
      'high',
      '--confidence',
      'standard',
      '--cost',
      'balanced',
    ])

    expect(input).toEqual({
      taskType: 'review',
      privacyLevel: 'private-repo',
      complexity: 'high',
      confidenceRequirement: 'standard',
      costPreference: 'balanced',
      allowHostedModels: true,
      allowPremiumModels: false,
    })
  })

  it('rejects unsupported flag values with the accepted values', () => {
    expect(() => parseRoutePreviewArgs(['--task', 'review', '--privacy', 'client'])).toThrow(
      'Invalid --privacy value "client". Expected one of: public, internal, private-repo, sensitive, secret.',
    )
  })
})

describe('formatRoutePreview', () => {
  it('prints the selected route and alternatives deterministically', () => {
    const output = formatRoutePreview({
      route: {
        decision: 'use-strong-hosted',
        provider: 'deepseek',
        modelTier: 'strong-hosted',
        model: 'deepseek-v4-pro',
        reason: 'This task type benefits from a strong hosted model by default.',
        requiresApproval: false,
        blocked: false,
      },
      warnings: [],
      alternatives: [
        {
          decision: 'use-cheap-hosted',
          provider: 'deepseek',
          modelTier: 'cheap-hosted',
          model: 'deepseek-v4-flash',
          reason: 'A cheaper hosted route is available for lower-risk work.',
          requiresApproval: false,
          blocked: false,
        },
      ],
    })

    expect(output).toBe(`Friday route preview
Decision: use-strong-hosted
Provider: deepseek
Model tier: strong-hosted
Model: deepseek-v4-pro
Requires approval: no
Blocked: no
Reason: This task type benefits from a strong hosted model by default.

Warnings:
- none

Alternatives:
- use-cheap-hosted: deepseek/deepseek-v4-flash (cheap-hosted) - A cheaper hosted route is available for lower-risk work.`)
  })
})
