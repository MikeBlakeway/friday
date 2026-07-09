import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const exampleRoot = path.join(projectRoot, 'examples', 'basic-project')
const exampleMemoryRoot = path.join(exampleRoot, '.friday')

async function readRepoFile(...parts: string[]): Promise<string> {
  return readFile(path.join(projectRoot, ...parts), 'utf8')
}

describe('basic project example', () => {
  it('documents a complete, safe Friday memory and planning prompt example', async () => {
    const readme = await readRepoFile('README.md')
    const exampleReadme = await readRepoFile('examples', 'basic-project', 'README.md')
    const planningOutput = await readRepoFile('examples', 'basic-project', 'planning-output.md')
    const memoryFiles = await Promise.all(
      ['project.md', 'architecture.md', 'decisions.md', 'design.md', 'tasks.md', 'notes.md'].map(
        async (fileName) => ({
          fileName,
          content: await readFile(path.join(exampleMemoryRoot, fileName), 'utf8'),
        }),
      ),
    )

    expect(readme).toContain('[basic project example](./examples/basic-project/README.md)')
    expect(exampleReadme).toContain('examples/basic-project/.friday/')
    expect(exampleReadme).toContain('friday plan "Add recipe sharing"')
    expect(exampleReadme).toContain('Friday reads the Markdown files in `.friday/`')
    expect(exampleReadme).toContain('[sample planning prompt output](./planning-output.md)')

    expect(planningOutput).toContain('# Friday Planning Prompt')
    expect(planningOutput).toContain('## Project Memory')
    expect(planningOutput).toContain('### project.md')
    expect(planningOutput).toContain('## Required Output')

    for (const { fileName, content } of memoryFiles) {
      expect(content.trim(), `${fileName} should be easy to understand`).not.toBe('')
      expect(content).toContain('# ')
    }

    const combinedExample = [
      exampleReadme,
      planningOutput,
      ...memoryFiles.map((file) => file.content),
    ].join('\n')
    expect(combinedExample).not.toMatch(/api[_-]?key|token|password|secret/i)
  })
})
