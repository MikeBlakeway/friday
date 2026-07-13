import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { LmStudioFetch } from '../../ai/providers/lmStudioProvider.js'
import { FRIDAY_GLOBAL_FILES } from '../../core/globalMemory.js'
import { FRIDAY_PROJECT_FILES } from '../../core/fridayProject.js'
import {
  collectDoctorReport,
  formatDoctorReport,
  parseDoctorArgs,
  type DoctorCheck,
  type DoctorReport,
} from './doctor.js'

const tempDirs: string[] = []

async function createEnvironment(): Promise<{
  projectRoot: string
  homeDir: string
  packageJsonPath: string
  cliEntryPath: string
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'friday-doctor-'))
  tempDirs.push(root)
  const projectRoot = path.join(root, 'project')
  const homeDir = path.join(root, 'home')
  const packageJsonPath = path.join(root, 'package.json')
  const cliEntryPath = path.join(root, 'friday.js')

  await mkdir(projectRoot, { recursive: true })
  await mkdir(homeDir, { recursive: true })
  await writeFile(packageJsonPath, JSON.stringify({ name: 'friday', version: '0.1.0' }), 'utf8')
  await writeFile(cliEntryPath, '#!/usr/bin/env node', 'utf8')

  return { projectRoot, homeDir, packageJsonPath, cliEntryPath }
}

async function createCompleteProject(projectRoot: string): Promise<void> {
  const fridayDir = path.join(projectRoot, '.friday')
  await mkdir(fridayDir, { recursive: true })

  await Promise.all(
    FRIDAY_PROJECT_FILES.map((fileName) =>
      writeFile(path.join(fridayDir, fileName), `# ${fileName}`, 'utf8'),
    ),
  )
}

async function createCompleteGlobalConfiguration(homeDir: string, model = 'qwen-local') {
  const fridayDir = path.join(homeDir, '.friday')
  await mkdir(fridayDir, { recursive: true })
  await Promise.all(
    FRIDAY_GLOBAL_FILES.map((fileName) =>
      writeFile(path.join(fridayDir, fileName), `# ${fileName}`, 'utf8'),
    ),
  )
  await writeFile(
    path.join(fridayDir, 'providers.json'),
    JSON.stringify({
      schemaVersion: 1,
      defaultProvider: 'lm-studio',
      providers: { 'lm-studio': { baseUrl: 'http://127.0.0.1:1234/v1', model } },
    }),
    'utf8',
  )
}

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return body
    },
  }
}

function allChecks(report: DoctorReport): DoctorCheck[] {
  return report.sections.flatMap((section) => section.checks)
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('parseDoctorArgs', () => {
  it('only enables provider generation through the explicit flag', () => {
    expect(parseDoctorArgs([])).toEqual({ testProvider: false })
    expect(parseDoctorArgs(['--test-provider'])).toEqual({ testProvider: true })
    expect(() => parseDoctorArgs(['--repair'])).toThrow(
      'Unknown friday doctor option: --repair. Usage: friday doctor [--test-provider]',
    )
  })
})

describe('collectDoctorReport', () => {
  it('reports a healthy installation and performs an explicitly requested test generation', async () => {
    const environment = await createEnvironment()
    await createCompleteProject(environment.projectRoot)
    await createCompleteGlobalConfiguration(environment.homeDir)
    const calls: string[] = []
    const providerFetch: LmStudioFetch = async (url) => {
      calls.push(url)
      return url.endsWith('/models')
        ? response({ data: [{ id: 'qwen-local' }] })
        : response({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10 },
          })
    }

    const report = await collectDoctorReport({
      ...environment,
      args: ['--test-provider'],
      nodeVersion: '22.0.0',
      providerFetch,
    })

    expect(report.ready).toBe(true)
    expect(allChecks(report)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'passed',
          label: 'Project memory is readable and complete',
        }),
        expect.objectContaining({ status: 'passed', label: 'Model selected: qwen-local' }),
        expect.objectContaining({ status: 'passed', label: 'Test generation succeeded' }),
      ]),
    )
    expect(calls).toEqual([
      'http://127.0.0.1:1234/v1/models',
      'http://127.0.0.1:1234/api/v0/models',
      'http://127.0.0.1:1234/v1/chat/completions',
    ])
  })

  it('adapts the diagnostic allowance when a reasoning response exhausts the first limit', async () => {
    const environment = await createEnvironment()
    await createCompleteProject(environment.projectRoot)
    await createCompleteGlobalConfiguration(environment.homeDir)
    const outputAllowances: number[] = []
    const providerFetch: LmStudioFetch = async (url, init) => {
      if (url.endsWith('/models')) {
        return response({ data: [{ id: 'qwen-local' }] })
      }

      const body = JSON.parse(String(init?.body)) as { max_tokens: number }
      outputAllowances.push(body.max_tokens)

      return outputAllowances.length === 1
        ? response({
            choices: [
              {
                message: { content: '', reasoning_content: 'Internal reasoning.' },
                finish_reason: 'length',
              },
            ],
            usage: { prompt_tokens: 21, completion_tokens: 64, total_tokens: 85 },
          })
        : response({
            choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 21, completion_tokens: 8, total_tokens: 29 },
          })
    }

    const report = await collectDoctorReport({
      ...environment,
      args: ['--test-provider'],
      providerFetch,
    })

    expect(report.ready).toBe(true)
    expect(outputAllowances).toEqual([64, 256])
    expect(allChecks(report)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'passed',
          label: 'Test generation succeeded',
          detail:
            'lm-studio/qwen-local returned 29 tokens with a 256-token output allowance after 2 adaptive attempts.',
        }),
      ]),
    )
  })

  it('reports partial optional memory and missing required run configuration', async () => {
    const environment = await createEnvironment()
    await mkdir(path.join(environment.projectRoot, '.friday'), { recursive: true })
    await writeFile(
      path.join(environment.projectRoot, '.friday', 'project.md'),
      '# Project',
      'utf8',
    )
    await mkdir(path.join(environment.homeDir, '.friday'), { recursive: true })
    await writeFile(path.join(environment.homeDir, '.friday', 'profile.md'), '# Profile', 'utf8')
    const calls: string[] = []

    const report = await collectDoctorReport({
      ...environment,
      args: [],
      providerFetch: async (url) => {
        calls.push(url)
        return response({ data: [{ id: 'qwen-local' }] })
      },
    })

    expect(report.ready).toBe(false)
    expect(allChecks(report)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'warning',
          label: 'Project memory is partial (5 missing)',
        }),
        expect.objectContaining({
          status: 'warning',
          label: 'Global memory is partial (1/5 files)',
          action: expect.stringContaining('friday global init'),
        }),
        expect.objectContaining({
          status: 'failed',
          label: 'Local provider configuration not found',
          action: expect.stringContaining('friday local setup'),
        }),
        expect.objectContaining({ status: 'skipped', label: 'Test generation skipped' }),
      ]),
    )
    expect(calls.every((url) => url.endsWith('/models'))).toBe(true)
  })

  it('reports an unavailable provider with corrective actions', async () => {
    const environment = await createEnvironment()
    const report = await collectDoctorReport({
      ...environment,
      args: ['--test-provider'],
      providerFetch: async () => {
        throw new Error('connect ECONNREFUSED')
      },
    })
    const checks = allChecks(report)

    expect(report.ready).toBe(false)
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'failed',
          label: 'LM Studio endpoint is unavailable',
          action: expect.stringContaining('Start the LM Studio local server'),
        }),
        expect.objectContaining({
          status: 'skipped',
          label: 'Model discovery skipped because the provider endpoint is not usable',
        }),
        expect.objectContaining({
          status: 'skipped',
          label: 'Test generation skipped because no provider model is ready',
        }),
      ]),
    )
  })

  it('reports a reachable provider with no loaded model', async () => {
    const environment = await createEnvironment()
    const report = await collectDoctorReport({
      ...environment,
      args: [],
      providerFetch: async () => response({ data: [] }),
    })

    expect(report.ready).toBe(false)
    expect(allChecks(report)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'passed',
          label: expect.stringContaining('server reachable'),
        }),
        expect.objectContaining({
          status: 'failed',
          label: 'No local model is loaded',
          action: expect.stringContaining('Load a model'),
        }),
      ]),
    )
  })

  it('diagnoses repositories without project memory and keeps the check non-fatal', async () => {
    const environment = await createEnvironment()
    const report = await collectDoctorReport({
      ...environment,
      args: [],
      providerFetch: async () => response({ data: [{ id: 'qwen-local' }] }),
    })

    expect(report.ready).toBe(false)
    expect(allChecks(report)).toContainEqual(
      expect.objectContaining({
        status: 'warning',
        label: '.friday project memory not found',
        action: expect.stringContaining('friday init'),
      }),
    )
    expect(formatDoctorReport(report)).toContain('Friday needs attention before local execution.')
  })
})
