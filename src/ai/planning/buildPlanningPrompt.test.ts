import { describe, expect, it } from 'vitest'

import { buildPlanningPrompt } from './buildPlanningPrompt.js'

describe('buildPlanningPrompt', () => {
  it('includes the goal and non-empty project memory, and reports missing files', () => {
    const result = buildPlanningPrompt({
      goal: 'Build the model routing layer',
      projectMemory: {
        projectRoot: '/project',
        files: [
          {
            fileName: 'project.md',
            filePath: '/project/.friday/project.md',
            exists: true,
            content: '# Friday',
          },
          {
            fileName: 'architecture.md',
            filePath: '/project/.friday/architecture.md',
            exists: true,
            content: '',
          },
          {
            fileName: 'decisions.md',
            filePath: '/project/.friday/decisions.md',
            exists: false,
            content: '',
          },
        ],
      },
      evidence: [],
    })

    expect(result.prompt).toContain('# Friday Planning Prompt')
    expect(result.prompt).toContain('Build the model routing layer')
    expect(result.prompt).toContain('### project.md\n\n# Friday')
    expect(result.prompt).not.toContain('### architecture.md')
    expect(result.prompt).toContain('No additional evidence was provided.')
    expect(result.loadedMemoryFiles).toEqual(['project.md'])
    expect(result.missingMemoryFiles).toEqual(['decisions.md'])
    expect(result.evidenceCount).toBe(0)
  })

  it('includes manual evidence with source, severity, and title', () => {
    const result = buildPlanningPrompt({
      goal: 'Plan authentication',
      projectMemory: { projectRoot: '/project', files: [] },
      evidence: [
        {
          source: 'manual',
          severity: 'high',
          title: 'Auth risk',
          content: 'Authentication has no integration tests.',
        },
      ],
    })

    expect(result.prompt).toContain('### Manual — High — Auth risk')
    expect(result.prompt).toContain('Authentication has no integration tests.')
    expect(result.evidenceCount).toBe(1)
  })

  it('includes global memory before project memory and exposes policy warnings', () => {
    const result = buildPlanningPrompt({
      goal: 'Plan safe routing',
      globalMemory: {
        homeDir: '/home/dev',
        globalMemoryDirPath: '/home/dev/.friday',
        files: [
          {
            fileName: 'privacy-policy.md',
            filePath: '/home/dev/.friday/privacy-policy.md',
            exists: true,
            content: '# Privacy\n\nCustomer data and PII must stay local.',
          },
          {
            fileName: 'profile.md',
            filePath: '/home/dev/.friday/profile.md',
            exists: false,
            content: '',
          },
        ],
      },
      projectMemory: {
        projectRoot: '/project',
        files: [
          {
            fileName: 'project.md',
            filePath: '/project/.friday/project.md',
            exists: true,
            content: '# Public website',
          },
        ],
      },
      evidence: [],
    })

    expect(result.prompt).toContain('### Global: privacy-policy.md\n\n# Privacy')
    expect(result.prompt.indexOf('### Global: privacy-policy.md')).toBeLessThan(
      result.prompt.indexOf('### project.md'),
    )
    expect(result.loadedGlobalMemoryFiles).toEqual(['privacy-policy.md'])
    expect(result.missingGlobalMemoryFiles).toEqual(['profile.md'])
    expect(result.effectivePrivacyLevel).toBe('sensitive')
    expect(result.policyWarnings).toEqual([
      'Global memory sets a sensitive privacy floor; project memory cannot weaken it to public.',
    ])
  })
})
