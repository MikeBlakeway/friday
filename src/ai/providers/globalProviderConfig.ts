import os from 'node:os'
import path from 'node:path'

import { pathExists, readTextFile } from '../../core/fileSystem.js'

export const GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION = 1
export const GLOBAL_PROVIDER_CONFIG_FILE = 'providers.json'

export interface LocalProviderConfiguration {
  baseUrl?: string
  model?: string
  autoStart?: boolean
}

export interface GlobalProviderConfiguration {
  schemaVersion: typeof GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION
  defaultProvider?: string
  providers: Record<string, LocalProviderConfiguration>
}

export type LoadGlobalProviderConfigurationResult =
  | {
      status: 'missing'
      filePath: string
    }
  | {
      status: 'loaded'
      filePath: string
      configuration: GlobalProviderConfiguration
    }

export class GlobalProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GlobalProviderConfigurationError'
  }
}

function configurationError(filePath: string, detail: string): GlobalProviderConfigurationError {
  return new GlobalProviderConfigurationError(
    `Invalid global provider configuration at ${filePath}: ${detail}`,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string,
  filePath: string,
): void {
  const unexpectedKey = Object.keys(value).find((key) => !allowedKeys.includes(key))

  if (unexpectedKey !== undefined) {
    throw configurationError(
      filePath,
      `${context} contains unsupported field "${unexpectedKey}". Provider configuration does not accept credentials or arbitrary fields.`,
    )
  }
}

function assertNonEmptyString(value: unknown, field: string, filePath: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw configurationError(filePath, `${field} must be a non-empty string.`)
  }

  return value.trim()
}

function assertLocalBaseUrl(value: unknown, field: string, filePath: string): string {
  const baseUrl = assertNonEmptyString(value, field, filePath)
  let parsed: URL

  try {
    parsed = new URL(baseUrl)
  } catch {
    throw configurationError(filePath, `${field} must be a valid URL.`)
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]'])

  if (parsed.protocol !== 'http:' || !localHosts.has(parsed.hostname)) {
    throw configurationError(
      filePath,
      `${field} must use http:// with localhost, 127.0.0.1, or ::1. Hosted endpoints are not supported.`,
    )
  }

  return baseUrl
}

function parseProviderConfiguration(
  value: unknown,
  providerId: string,
  filePath: string,
): LocalProviderConfiguration {
  if (!isRecord(value)) {
    throw configurationError(filePath, `providers.${providerId} must be an object.`)
  }

  assertOnlyKeys(value, ['baseUrl', 'model', 'autoStart'], `providers.${providerId}`, filePath)

  const configuration: LocalProviderConfiguration = {}

  if (value.baseUrl !== undefined) {
    configuration.baseUrl = assertLocalBaseUrl(
      value.baseUrl,
      `providers.${providerId}.baseUrl`,
      filePath,
    )
  }

  if (value.model !== undefined) {
    configuration.model = assertNonEmptyString(
      value.model,
      `providers.${providerId}.model`,
      filePath,
    )
  }

  if (value.autoStart !== undefined) {
    if (typeof value.autoStart !== 'boolean') {
      throw configurationError(filePath, `providers.${providerId}.autoStart must be a boolean.`)
    }

    if (value.autoStart) {
      throw configurationError(
        filePath,
        `providers.${providerId}.autoStart must be false because Friday does not silently start provider processes.`,
      )
    }

    configuration.autoStart = false
  }

  return configuration
}

function parseConfiguration(value: unknown, filePath: string): GlobalProviderConfiguration {
  if (!isRecord(value)) {
    throw configurationError(filePath, 'the root value must be an object.')
  }

  assertOnlyKeys(
    value,
    ['schemaVersion', 'defaultProvider', 'providers'],
    'the root object',
    filePath,
  )

  if (value.schemaVersion !== GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION) {
    throw configurationError(
      filePath,
      `schemaVersion must be ${GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION}.`,
    )
  }

  if (!isRecord(value.providers)) {
    throw configurationError(filePath, 'providers must be an object.')
  }

  const providers = Object.fromEntries(
    Object.entries(value.providers).map(([providerId, providerConfiguration]) => {
      const normalisedProviderId = assertNonEmptyString(providerId, 'provider id', filePath)
      return [
        normalisedProviderId,
        parseProviderConfiguration(providerConfiguration, normalisedProviderId, filePath),
      ]
    }),
  )
  const configuration: GlobalProviderConfiguration = {
    schemaVersion: GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION,
    providers,
  }

  if (value.defaultProvider !== undefined) {
    configuration.defaultProvider = assertNonEmptyString(
      value.defaultProvider,
      'defaultProvider',
      filePath,
    )
  }

  return configuration
}

export async function loadGlobalProviderConfiguration(
  homeDir: string = os.homedir(),
): Promise<LoadGlobalProviderConfigurationResult> {
  const filePath = path.join(homeDir, '.friday', GLOBAL_PROVIDER_CONFIG_FILE)

  if (!(await pathExists(filePath))) {
    return { status: 'missing', filePath }
  }

  const content = await readTextFile(filePath)
  let value: unknown

  try {
    value = JSON.parse(content)
  } catch {
    throw configurationError(filePath, 'the file must contain valid JSON.')
  }

  return {
    status: 'loaded',
    filePath,
    configuration: parseConfiguration(value, filePath),
  }
}
