import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

async function readProjectFile(filePath: string): Promise<string> {
  return readFile(path.join(projectRoot, filePath), 'utf8')
}

describe('documented implementation state', () => {
  it('keeps public docs aligned on usage logging and hosted-provider boundaries', async () => {
    const [readme, architecture, roadmap] = await Promise.all([
      readProjectFile('README.md'),
      readProjectFile('docs/architecture.md'),
      readProjectFile('docs/roadmap.md'),
    ])

    for (const document of [readme, architecture, roadmap]) {
      expect(document).toMatch(/metadata-only usage (?:history|logging|record)/i)
      expect(document).toMatch(/aggregate usage reporting/i)
      expect(document).toMatch(/budget/i)
      expect(document).toMatch(/hosted-provider\s+execution|hosted provider execution/i)
    }

    expect(readme).not.toContain('- [ ] Token usage logging (post-MVP)')
    expect(architecture).not.toContain('Planned: usage logging')
    expect(architecture).not.toContain('until usage logging exists')
  })

  it('records recent workflow delivery and superseding decisions in project memory', async () => {
    const [decisions, tasks] = await Promise.all([
      readProjectFile('.friday/decisions.md'),
      readProjectFile('.friday/tasks.md'),
    ])

    for (const issue of ['FRI-053', 'FRI-056', 'FRI-058']) {
      expect(tasks).toContain(issue)
    }

    expect(decisions).toMatch(/superseded/i)
    expect(decisions).toMatch(/metadata-only (?:local )?usage/i)
    expect(decisions).toMatch(/bounded adaptive retry/i)
    expect(decisions).toMatch(/generated.*\.friday\/output/is)
  })
})
