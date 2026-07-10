import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { promisify } from 'node:util'

import {
  GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION,
  loadGlobalProviderConfiguration,
  saveGlobalProviderConfiguration,
  validateGlobalProviderConfiguration,
  type GlobalProviderConfiguration,
  type LocalProviderConfiguration,
} from '../../ai/providers/globalProviderConfig.js'
import {
  discoverLmStudioProvider,
  type LmStudioDiscoveryResult,
} from '../../ai/providers/localProviderDiscovery.js'
import { createLmStudioProvider, type LmStudioFetch } from '../../ai/providers/lmStudioProvider.js'
import { testLocalProvider } from '../../ai/providers/testLocalProvider.js'

const execFileAsync = promisify(execFile)

const localSetupUsage =
  'friday local setup [--provider lm-studio] [--base-url <url>] [--model <id>] [--start-server] [--test]'

export interface LocalSetupFlags {
  provider?: 'lm-studio'
  baseUrl?: string
  model?: string
  startServer: boolean
  testProvider: boolean
}

export interface LocalSetupPrompter {
  ask(question: string): Promise<string>
  close(): void
}

export type LocalSetupCommandRunner = (command: string, args: string[]) => Promise<void>
export type LocalSetupCliDetector = () => Promise<boolean>

export interface LocalSetupOptions {
  args: string[]
  homeDir?: string
  interactive?: boolean
  fetch?: LmStudioFetch
  commandRunner?: LocalSetupCommandRunner
  detectLmsCli?: LocalSetupCliDetector
  prompter?: LocalSetupPrompter
  output?: (line: string) => void
}

export type LocalSetupResult =
  | { status: 'cancelled' }
  | {
      status: 'configured'
      filePath: string
      baseUrl: string
      model: string
      testStatus: 'passed' | 'skipped'
    }

type SelectableDiscovery = Extract<LmStudioDiscoveryResult, { status: 'ready' | 'choice-required' }>

function parseRequiredValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1]

  if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
    throw new Error(`${flag} requires a value. Usage: ${localSetupUsage}`)
  }

  return value.trim()
}

export function parseLocalSetupArgs(args: string[]): LocalSetupFlags {
  const flags: LocalSetupFlags = { startServer: false, testProvider: false }

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]

    switch (flag) {
      case '--provider': {
        const provider = parseRequiredValue(args, index, flag)

        if (provider !== 'lm-studio') {
          throw new Error('friday local setup currently supports only --provider lm-studio.')
        }

        flags.provider = provider
        index += 1
        break
      }
      case '--base-url':
        flags.baseUrl = parseRequiredValue(args, index, flag)
        index += 1
        break
      case '--model':
        flags.model = parseRequiredValue(args, index, flag)
        index += 1
        break
      case '--start-server':
        flags.startServer = true
        break
      case '--test':
        flags.testProvider = true
        break
      default:
        throw new Error(`Unknown friday local setup option: ${flag}. Usage: ${localSetupUsage}`)
    }
  }

  return flags
}

function createDefaultPrompter(): LocalSetupPrompter {
  const readline = createInterface({ input: process.stdin, output: process.stdout })

  return {
    ask(question) {
      return readline.question(question)
    },
    close() {
      readline.close()
    },
  }
}

async function defaultCommandRunner(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, { timeout: 30_000 })
}

export async function detectLmsCliOnPath(): Promise<boolean> {
  const pathDirectories = (process.env.PATH ?? '')
    .split(path.delimiter)
    .map((directory) => directory.replace(/^"|"$/g, ''))
    .filter((directory) => directory.length > 0)
  const executableNames =
    process.platform === 'win32' ? ['lms.exe', 'lms.cmd', 'lms.bat', 'lms'] : ['lms']

  for (const directory of pathDirectories) {
    for (const executableName of executableNames) {
      try {
        await access(path.join(directory, executableName), constants.X_OK)
        return true
      } catch {
        // Continue checking the remaining PATH entries without executing a process.
      }
    }
  }

  return false
}

function isConfirmation(answer: string, defaultValue: boolean): boolean {
  const normalised = answer.trim().toLowerCase()

  if (normalised.length === 0) {
    return defaultValue
  }

  return normalised === 'y' || normalised === 'yes'
}

function buildDiscoveryConfiguration(
  existing: LocalProviderConfiguration | undefined,
  flags: LocalSetupFlags,
): LocalProviderConfiguration | undefined {
  const configuration: LocalProviderConfiguration = {
    ...(existing ?? {}),
    ...(flags.baseUrl === undefined ? {} : { baseUrl: flags.baseUrl }),
    ...(flags.model === undefined ? {} : { model: flags.model }),
    autoStart: false,
  }

  return Object.keys(configuration).length === 1 && configuration.autoStart === false
    ? undefined
    : configuration
}

async function discover(
  configuration: LocalProviderConfiguration | undefined,
  fetch: LmStudioFetch | undefined,
): Promise<LmStudioDiscoveryResult> {
  return discoverLmStudioProvider({
    ...(configuration === undefined ? {} : { configuration }),
    ...(fetch === undefined ? {} : { fetch }),
  })
}

async function selectModel(
  discovery: SelectableDiscovery,
  interactive: boolean,
  prompter: LocalSetupPrompter | undefined,
  output: (line: string) => void,
): Promise<string | undefined> {
  if (discovery.status === 'ready') {
    return discovery.selectedModel
  }

  if (!interactive || prompter === undefined) {
    throw new Error(
      `${discovery.message} Pass --model <id> with one of the loaded model identifiers.`,
    )
  }

  output('')
  output('Select a default model:')
  discovery.models.forEach((model, index) => output(`${index + 1}. ${model}`))

  while (true) {
    const answer = (await prompter.ask('Enter a model number (or q to cancel): ')).trim()

    if (answer.toLowerCase() === 'q') {
      return undefined
    }

    if (/^\d+$/.test(answer)) {
      const selected = discovery.models[Number(answer) - 1]

      if (selected !== undefined) {
        return selected
      }
    }

    output(`Choose a number from 1 to ${discovery.models.length}, or q to cancel.`)
  }
}

function createSavedConfiguration(
  existing: GlobalProviderConfiguration | undefined,
  baseUrl: string,
  model: string,
): GlobalProviderConfiguration {
  return {
    schemaVersion: GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION,
    defaultProvider: 'lm-studio',
    providers: {
      ...(existing?.providers ?? {}),
      'lm-studio': { baseUrl, model, autoStart: false },
    },
  }
}

function validateDiscoveryConfiguration(
  configuration: LocalProviderConfiguration | undefined,
  homeDir: string,
): LocalProviderConfiguration | undefined {
  if (configuration === undefined) {
    return undefined
  }

  return validateGlobalProviderConfiguration(
    {
      schemaVersion: GLOBAL_PROVIDER_CONFIG_SCHEMA_VERSION,
      providers: { 'lm-studio': configuration },
    },
    homeDir,
  ).providers['lm-studio']
}

function serverStartArgs(configuration: LocalProviderConfiguration | undefined): string[] {
  const port = configuration?.baseUrl === undefined ? '' : new URL(configuration.baseUrl).port

  return port.length === 0 ? ['server', 'start'] : ['server', 'start', '--port', port]
}

interface LocalSetupContext {
  flags: LocalSetupFlags
  interactive: boolean
  output: (line: string) => void
  commandRunner: LocalSetupCommandRunner
  prompter?: LocalSetupPrompter
  fetch?: LmStudioFetch
}

async function reportLmsAvailability(
  detectLmsCli: LocalSetupCliDetector,
  output: (line: string) => void,
): Promise<boolean> {
  const lmsAvailable = await detectLmsCli()

  output(
    lmsAvailable
      ? '✓ LM Studio CLI detected'
      : '! lms CLI not found; a running LM Studio server can still be configured',
  )

  return lmsAvailable
}

async function confirmServerStart(context: LocalSetupContext): Promise<boolean> {
  if (context.flags.startServer) {
    return true
  }

  if (!context.interactive || context.prompter === undefined) {
    return false
  }

  return isConfirmation(
    await context.prompter.ask('Start it now with "lms server start"? [y/N] '),
    false,
  )
}

async function discoverWithOptionalServerStart(
  context: LocalSetupContext,
  configuration: LocalProviderConfiguration | undefined,
  lmsAvailable: boolean,
): Promise<Exclude<LmStudioDiscoveryResult, { status: 'unavailable' }> | undefined> {
  let discovery = await discover(configuration, context.fetch)

  if (discovery.status !== 'unavailable') {
    return discovery
  }

  if (!lmsAvailable) {
    throw new Error(
      'LM Studio was not detected. Install and launch LM Studio, make the lms CLI available, load a model, and retry.',
    )
  }

  context.output('! LM Studio local server is not running')

  if (!(await confirmServerStart(context))) {
    if (context.interactive) {
      context.output('Setup cancelled. No configuration was changed.')
      return undefined
    }

    throw new Error(
      'LM Studio server is not running. Start it manually or pass --start-server to explicitly allow Friday to run "lms server start".',
    )
  }

  try {
    await context.commandRunner('lms', serverStartArgs(configuration))
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : ''
    throw new Error(`LM Studio server could not be started.${detail}`)
  }

  context.output('✓ LM Studio server start completed')
  discovery = await discover(configuration, context.fetch)

  if (discovery.status === 'unavailable') {
    throw new Error(
      `${discovery.message} The server was started but its endpoint is still unavailable; check "lms server status" and retry.`,
    )
  }

  return discovery
}

function requireSelectableDiscovery(
  discovery: Exclude<LmStudioDiscoveryResult, { status: 'unavailable' }>,
  output: (line: string) => void,
): SelectableDiscovery {
  if (discovery.status === 'invalid-response') {
    throw new Error(
      `${discovery.message} Verify --base-url points to LM Studio's OpenAI-compatible /v1 endpoint.`,
    )
  }

  output(`✓ Local server found at ${discovery.baseUrl}`)

  if (discovery.status === 'no-models') {
    throw new Error(
      `No loaded models were found at ${discovery.baseUrl}. Load a model in LM Studio and retry "friday local setup". Friday will not download or load models automatically.`,
    )
  }

  output(
    `✓ ${discovery.models.length} loaded model${discovery.models.length === 1 ? '' : 's'} found`,
  )
  return discovery
}

async function shouldTestProvider(context: LocalSetupContext): Promise<boolean> {
  if (context.flags.testProvider) {
    return true
  }

  if (!context.interactive || context.prompter === undefined) {
    return false
  }

  return isConfirmation(await context.prompter.ask('Send a lightweight test request? [Y/n] '), true)
}

async function verifyProviderSelection(
  context: LocalSetupContext,
  baseUrl: string,
  model: string,
): Promise<'passed' | 'skipped'> {
  if (!(await shouldTestProvider(context))) {
    context.output(
      '○ Test request skipped; run "friday doctor --test-provider" later to verify generation',
    )
    return 'skipped'
  }

  const provider = createLmStudioProvider({
    baseUrl,
    model,
    ...(context.fetch === undefined ? {} : { fetch: context.fetch }),
  })

  try {
    await testLocalProvider(provider, 'friday-local-setup')
    context.output('✓ Test request completed successfully')
    return 'passed'
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Configuration was saved, but the test request failed: ${detail} Check the loaded model and LM Studio server logs, then retry with "friday local setup --provider lm-studio --base-url ${baseUrl} --model ${model} --test".`,
    )
  }
}

export async function runLocalSetupCommand(options: LocalSetupOptions): Promise<LocalSetupResult> {
  const flags = parseLocalSetupArgs(options.args)
  const homeDir = options.homeDir ?? os.homedir()
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  const output = options.output ?? console.log
  const commandRunner = options.commandRunner ?? defaultCommandRunner
  const detectLmsCli = options.detectLmsCli ?? detectLmsCliOnPath
  const ownsPrompter = interactive && options.prompter === undefined
  const prompter = interactive ? (options.prompter ?? createDefaultPrompter()) : undefined

  if (
    !interactive &&
    (flags.provider === undefined || flags.baseUrl === undefined || flags.model === undefined)
  ) {
    throw new Error(
      'Non-interactive setup requires --provider lm-studio, --base-url <url>, and --model <id>.',
    )
  }

  try {
    output('Friday local model setup')
    output('')

    const context: LocalSetupContext = {
      flags,
      interactive,
      output,
      commandRunner,
      ...(prompter === undefined ? {} : { prompter }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    }
    const lmsAvailable = await reportLmsAvailability(detectLmsCli, output)

    const loadedConfiguration = await loadGlobalProviderConfiguration(homeDir)
    const existingConfiguration =
      loadedConfiguration.status === 'loaded' ? loadedConfiguration.configuration : undefined
    const discoveryConfiguration = validateDiscoveryConfiguration(
      buildDiscoveryConfiguration(existingConfiguration?.providers['lm-studio'], flags),
      homeDir,
    )
    const discovery = await discoverWithOptionalServerStart(
      context,
      discoveryConfiguration,
      lmsAvailable,
    )

    if (discovery === undefined) {
      return { status: 'cancelled' }
    }

    const selectableDiscovery = requireSelectableDiscovery(discovery, output)
    const model = await selectModel(selectableDiscovery, interactive, prompter, output)

    if (model === undefined) {
      output('Setup cancelled. No configuration was changed.')
      return { status: 'cancelled' }
    }

    output(`✓ Default model selected: ${model}`)
    const saved = await saveGlobalProviderConfiguration(
      createSavedConfiguration(existingConfiguration, selectableDiscovery.baseUrl, model),
      homeDir,
    )
    output(`✓ Configuration saved to ${saved.filePath}`)
    const testStatus = await verifyProviderSelection(context, selectableDiscovery.baseUrl, model)

    output('')
    output('Friday is ready to use local models.')

    return {
      status: 'configured',
      filePath: saved.filePath,
      baseUrl: selectableDiscovery.baseUrl,
      model,
      testStatus,
    }
  } finally {
    if (ownsPrompter) {
      prompter?.close()
    }
  }
}
