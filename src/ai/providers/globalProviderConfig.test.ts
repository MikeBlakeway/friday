import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION,
  GlobalProviderConfigurationError,
  loadGlobalProviderConfiguration,
} from './globalProviderConfig.js'

const tempDirs: string[] = []

async function createTempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-provider-config-'))
  tempDirs.push(homeDir)
  return homeDir
}

async function writeConfiguration(homeDir: string, value: unknown): Promise<void> {
  const globalDirPath = path.join(homeDir, '.friday')
  await mkdir(globalDirPath, { recursive: true })
  await writeFile(path.join(globalDirPath, 'providers.json'), JSON.stringify(value), 'utf8')
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('loadGlobalProviderConfiguration', () => {
  it('returns a missing result when global provider configuration does not exist', async () => {
    const homeDir = await createTempHome()

    await expect(loadGlobalProviderConfiguration(homeDir)).resolves.toEqual({
      status: 'missing',
      filePath: path.join(homeDir, '.friday', 'providers.json'),
    })
  })

  it('loads a typed versioned local provider configuration', async () => {
    const homeDir = await createTempHome()
    await writeConfiguration(homeDir, {
      schemaVersion: GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION,
      defaultProvider: 'lm-studio',
      providers: {
        'lm-studio': {
          baseUrl: 'http://127.0.0.1:1234/v1',
          model: 'qwen3-coder-14b',
          autoStart: false,
          contextWindowTokens: 32_768,
          maxOutputTokens: 8_192,
        },
      },
    })

    await expect(loadGlobalProviderConfiguration(homeDir)).resolves.toEqual({
      status: 'loaded',
      filePath: path.join(homeDir, '.friday', 'providers.json'),
      configuration: {
        schemaVersion: 1,
        defaultProvider: 'lm-studio',
        providers: {
          'lm-studio': {
            baseUrl: 'http://127.0.0.1:1234/v1',
            model: 'qwen3-coder-14b',
            autoStart: false,
            contextWindowTokens: 32_768,
            maxOutputTokens: 8_192,
          },
        },
      },
    })
  })

  it.each([
    ['invalid JSON', '{'],
    ['an unsupported schema version', { schemaVersion: 2, providers: {} }],
    [
      'a non-local base URL',
      {
        schemaVersion: 1,
        providers: { 'lm-studio': { baseUrl: 'https://models.example.com/v1' } },
      },
    ],
    [
      'credential fields',
      {
        schemaVersion: 1,
        providers: { 'lm-studio': { apiKey: 'not-supported' } },
      },
    ],
    [
      'invalid token limits',
      {
        schemaVersion: 1,
        providers: { 'lm-studio': { contextWindowTokens: 0, maxOutputTokens: 1.5 } },
      },
    ],
  ])('rejects %s with an actionable error', async (_description, value) => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, '.friday')
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'providers.json'),
      typeof value === 'string' ? value : JSON.stringify(value),
      'utf8',
    )

    await expect(loadGlobalProviderConfiguration(homeDir)).rejects.toBeInstanceOf(
      GlobalProviderConfigurationError,
    )
    await expect(loadGlobalProviderConfiguration(homeDir)).rejects.toThrow(
      'Invalid global provider configuration',
    )
  })
})
