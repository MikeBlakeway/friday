import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseDoctorArgs } from '../../src/cli/commands/doctor.js'
import { parseEvidenceArgs } from '../../src/cli/commands/evidence.js'
import { runInitCommand } from '../../src/cli/commands/init.js'
import { parseLocalSetupArgs } from '../../src/cli/commands/localSetup.js'
import { parseRunArgs } from '../../src/cli/commands/run.js'
import { getFridayProjectStatus } from '../../src/core/getFridayProjectStatus.js'

const tempDirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('documented quick start', () => {
  it('accepts the setup, doctor, init, evidence, and run command sequence', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'friday-quick-start-'))
    tempDirs.push(projectRoot)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    expect(parseLocalSetupArgs([])).toEqual({ startServer: false, testProvider: false })
    expect(parseDoctorArgs([])).toEqual({ testProvider: false })

    await runInitCommand({ projectRoot })
    expect((await getFridayProjectStatus(projectRoot)).hasFridayProjectDir).toBe(true)

    expect(parseEvidenceArgs(['--collect'])).toMatchObject({ collect: true })
    expect(parseRunArgs(['plan', 'Recommend the next useful improvement'])).toMatchObject({
      workflow: 'plan',
      goal: 'Recommend the next useful improvement',
    })
  })
})
