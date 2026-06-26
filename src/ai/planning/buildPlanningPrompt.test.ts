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
})
