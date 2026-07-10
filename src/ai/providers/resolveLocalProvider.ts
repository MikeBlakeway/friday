import os from 'node:os'

import {
  loadGlobalProviderConfiguration,
  type LoadGlobalProviderConfigurationResult,
} from './globalProviderConfig.js'
import { discoverLmStudioProvider, type LmStudioDiscoveryResult } from './localProviderDiscovery.js'
import {
  createLmStudioProvider,
  type LmStudioFetch,
  type LmStudioProvider,
} from './lmStudioProvider.js'

type ReadyLmStudioDiscovery = Extract<LmStudioDiscoveryResult, { status: 'ready' }>

export interface ResolveLocalModelProviderInput {
  homeDir?: string
  fetch?: LmStudioFetch
  provider?: string
  model?: string
}

export interface ResolvedLocalModelProvider {
  configurationStatus: LoadGlobalProviderConfigurationResult['status']
  discovery: ReadyLmStudioDiscovery
  provider: LmStudioProvider
}

export async function resolveLocalModelProvider(
  input: ResolveLocalModelProviderInput = {},
): Promise<ResolvedLocalModelProvider> {
  const configurationResult = await loadGlobalProviderConfiguration(input.homeDir ?? os.homedir())
  const configuration =
    configurationResult.status === 'loaded' ? configurationResult.configuration : undefined
  const providerId = input.provider ?? configuration?.defaultProvider ?? 'lm-studio'

  if (providerId !== 'lm-studio') {
    throw new Error(
      `Configured default provider "${providerId}" is not supported yet. Friday currently discovers lm-studio only.`,
    )
  }

  const configuredProvider = configuration?.providers['lm-studio']
  const providerConfiguration =
    input.model === undefined
      ? configuredProvider
      : {
          ...(configuredProvider?.baseUrl === undefined
            ? {}
            : { baseUrl: configuredProvider.baseUrl }),
          model: input.model,
          ...(configuredProvider?.autoStart === undefined
            ? {}
            : { autoStart: configuredProvider.autoStart }),
        }
  const discovery = await discoverLmStudioProvider({
    ...(providerConfiguration === undefined ? {} : { configuration: providerConfiguration }),
    ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
  })

  if (discovery.status !== 'ready') {
    throw new Error(discovery.message)
  }

  return {
    configurationStatus: configurationResult.status,
    discovery,
    provider: createLmStudioProvider({
      baseUrl: discovery.baseUrl,
      model: discovery.selectedModel,
      ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
    }),
  }
}
