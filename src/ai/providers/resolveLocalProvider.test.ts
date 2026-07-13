import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { LmStudioFetch } from './lmStudioProvider.js'
import { resolveLocalModelProvider } from './resolveLocalProvider.js'

const tempDirs: string[] = []

async function createTempHome(): Promise<string> {
  const homeDir = await mkdtemp(path.join(os.tmpdir(), 'friday-resolve-provider-'))
  tempDirs.push(homeDir)
  return homeDir
}

function createModelsFetch(models: string[], contextWindowTokens?: number): LmStudioFetch {
  return async (url) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return {
        data: models.map((id) => ({
          id,
          ...(url.includes('/api/v0/') && contextWindowTokens !== undefined
            ? { max_context_length: contextWindowTokens }
            : {}),
        })),
      }
    },
  })
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dirPath) => rm(dirPath, { recursive: true, force: true })))
  tempDirs.length = 0
})

describe('resolveLocalModelProvider', () => {
  it('discovers and selects a single model when configuration is missing', async () => {
    const homeDir = await createTempHome()

    const result = await resolveLocalModelProvider({
      homeDir,
      fetch: createModelsFetch(['qwen3-coder-14b'], 32_768),
    })

    expect(result.configurationStatus).toBe('missing')
    expect(result.discovery).toMatchObject({
      status: 'ready',
      selection: 'only-available',
      selectedModel: 'qwen3-coder-14b',
    })
    expect(result.provider.capabilities).toMatchObject({
      provider: 'lm-studio',
      model: 'qwen3-coder-14b',
      contextWindowTokens: 32_768,
      maxOutputTokens: 32_768,
    })
  })

  it('uses the configured default provider endpoint and model', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, '.friday')
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'providers.json'),
      JSON.stringify({
        schemaVersion: 1,
        defaultProvider: 'lm-studio',
        providers: {
          'lm-studio': {
            baseUrl: 'http://localhost:4321/v1',
            model: 'codestral-22b',
            autoStart: false,
            contextWindowTokens: 16_384,
            maxOutputTokens: 6_000,
          },
        },
      }),
      'utf8',
    )

    const result = await resolveLocalModelProvider({
      homeDir,
      fetch: createModelsFetch(['qwen3-coder-14b', 'codestral-22b']),
    })

    expect(result.configurationStatus).toBe('loaded')
    expect(result.discovery).toMatchObject({
      status: 'ready',
      baseUrl: 'http://localhost:4321/v1',
      selection: 'configured',
      selectedModel: 'codestral-22b',
    })
    expect(result.provider.capabilities).toMatchObject({
      model: 'codestral-22b',
      contextWindowTokens: 16_384,
      maxOutputTokens: 6_000,
    })
  })

  it('surfaces discovery states as actionable execution errors', async () => {
    const homeDir = await createTempHome()

    await expect(
      resolveLocalModelProvider({
        homeDir,
        fetch: createModelsFetch(['qwen3-coder-14b', 'codestral-22b']),
      }),
    ).rejects.toThrow(
      'LM Studio has multiple loaded models: qwen3-coder-14b, codestral-22b. Set providers.lm-studio.model in ~/.friday/providers.json.',
    )
  })

  it('rejects configured provider types that Friday cannot discover yet', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, '.friday')
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'providers.json'),
      JSON.stringify({
        schemaVersion: 1,
        defaultProvider: 'ollama',
        providers: {
          ollama: { baseUrl: 'http://localhost:11434/v1', autoStart: false },
        },
      }),
      'utf8',
    )

    await expect(
      resolveLocalModelProvider({ homeDir, fetch: createModelsFetch(['qwen']) }),
    ).rejects.toThrow(
      'Configured default provider "ollama" is not supported yet. Run "friday local setup" to configure the supported LM Studio provider.',
    )
  })

  it('allows an explicit supported provider and loaded model to override defaults', async () => {
    const homeDir = await createTempHome()
    const globalDirPath = path.join(homeDir, '.friday')
    await mkdir(globalDirPath, { recursive: true })
    await writeFile(
      path.join(globalDirPath, 'providers.json'),
      JSON.stringify({
        schemaVersion: 1,
        defaultProvider: 'ollama',
        providers: {
          ollama: { baseUrl: 'http://localhost:11434/v1', autoStart: false },
          'lm-studio': { baseUrl: 'http://localhost:4321/v1', model: 'codestral-22b' },
        },
      }),
      'utf8',
    )

    const result = await resolveLocalModelProvider({
      homeDir,
      provider: 'lm-studio',
      model: 'qwen3-coder-14b',
      fetch: createModelsFetch(['qwen3-coder-14b', 'codestral-22b']),
    })

    expect(result.discovery).toMatchObject({
      baseUrl: 'http://localhost:4321/v1',
      selection: 'configured',
      selectedModel: 'qwen3-coder-14b',
    })
  })
})
