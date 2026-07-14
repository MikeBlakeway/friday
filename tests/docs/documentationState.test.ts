import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()

async function readProjectFile(filePath: string): Promise<string> {
  return readFile(path.join(projectRoot, filePath), 'utf8')
}

describe('documented implementation state', () => {
  it('keeps primary capability inventories aligned on implemented commands and reporting', async () => {
    const [readme, architecture, roadmap, project, projectArchitecture] = await Promise.all([
      readProjectFile('README.md'),
      readProjectFile('docs/architecture.md'),
      readProjectFile('docs/roadmap.md'),
      readProjectFile('.friday/project.md'),
      readProjectFile('.friday/architecture.md'),
    ])

    const inventories = [readme, architecture, roadmap, project, projectArchitecture]
    const implementedCommands = [
      'init',
      'global init',
      'status',
      'doctor',
      'local setup',
      'evidence',
      'plan',
      'review',
      'run',
      'route',
      'cost',
      'usage',
      'outcome',
      'execute',
    ]

    for (const document of inventories) {
      for (const command of implementedCommands) {
        expect(document).toContain(`friday ${command}`)
      }
    }

    for (const document of [readme, architecture, roadmap]) {
      expect(document).toMatch(/metadata-only usage (?:history|logging|record)/i)
      expect(document).toMatch(/friday usage/i)
      expect(document).toMatch(/recorded\s+token/i)
      expect(document).toMatch(/cross-project/i)
      expect(document).toMatch(/friday usage\s+--budget/i)
      expect(document).toMatch(/hosted-provider\s+execution|hosted provider execution/i)
    }

    expect(readme).not.toContain('- [ ] Token usage logging (post-MVP)')
    expect(architecture).not.toContain('Planned: usage logging')
    expect(architecture).not.toContain('Planned: aggregate usage reporting')
    expect(architecture).not.toContain('until usage logging exists')
  })

  it('records recent outcome and budget delivery plus superseding decisions in project memory', async () => {
    const [decisions, tasks, project, projectArchitecture] = await Promise.all([
      readProjectFile('.friday/decisions.md'),
      readProjectFile('.friday/tasks.md'),
      readProjectFile('.friday/project.md'),
      readProjectFile('.friday/architecture.md'),
    ])

    for (const issue of ['FRI-053', 'FRI-056', 'FRI-058', 'FRI-061', 'FRI-062', 'FRI-063']) {
      expect(tasks).toContain(issue)
    }

    expect(decisions).toMatch(/superseded/i)
    expect(decisions).toMatch(/extended by separate outcome events/i)
    expect(decisions).toMatch(/hosted invocation is deferred/i)
    expect(decisions).toMatch(/metadata-only (?:local )?usage/i)
    expect(decisions).toMatch(/bounded adaptive retry/i)
    expect(decisions).toMatch(/generated.*\.friday\/output/is)
    expect(project).toMatch(/outcome events are append-only/i)
    expect(project).toMatch(/friday usage --budget/i)
    expect(projectArchitecture).toMatch(/latest-event-wins/i)
    expect(projectArchitecture).toMatch(/no hosted provider is currently invoked/i)
  })
})
