import { describe, expect, it } from 'vitest'

import { buildReviewPrompt } from './buildReviewPrompt.js'

describe('buildReviewPrompt', () => {
  it('includes changed-file context, project memory, and manual evidence', () => {
    const result = buildReviewPrompt({
      changedFiles: [
        {
          filePath: 'src/cli/index.ts',
          diff: '@@ -1,2 +1,3 @@\n import { runHelpCommand } from "./commands/help.js"\n+import { runReviewCommand } from "./commands/review.js"',
        },
      ],
      projectMemory: {
        projectRoot: '/project',
        files: [
          {
            fileName: 'project.md',
            filePath: '/project/.friday/project.md',
            exists: true,
            content: '# Friday\n\nLocal-first project memory.',
          },
          {
            fileName: 'notes.md',
            filePath: '/project/.friday/notes.md',
            exists: false,
            content: '',
          },
        ],
      },
      evidence: [
        {
          source: 'manual',
          severity: 'medium',
          title: 'Review risk',
          content: 'Review workflows must stay inspectable.',
        },
      ],
    })

    expect(result.prompt).toContain('# Friday Review Prompt')
    expect(result.prompt).toContain('## Changed Files')
    expect(result.prompt).toContain('### src/cli/index.ts')
    expect(result.prompt).toContain('+import { runReviewCommand }')
    expect(result.prompt).toContain('### project.md\n\n# Friday')
    expect(result.prompt).toContain('### Manual - Medium - Review risk')
    expect(result.loadedMemoryFiles).toEqual(['project.md'])
    expect(result.missingMemoryFiles).toEqual(['notes.md'])
    expect(result.changedFileCount).toBe(1)
    expect(result.evidenceCount).toBe(1)
  })

  it('explains when there are no changed files', () => {
    const result = buildReviewPrompt({
      changedFiles: [],
      projectMemory: { projectRoot: '/project', files: [] },
      evidence: [],
    })

    expect(result.prompt).toContain('No changed files were detected.')
    expect(result.changedFileCount).toBe(0)
  })
})
