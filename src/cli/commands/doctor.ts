import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadGlobalProviderConfiguration,
  type GlobalProviderConfiguration,
} from '../../ai/providers/globalProviderConfig.js'
import {
  discoverLmStudioProvider,
  type LmStudioDiscoveryResult,
} from '../../ai/providers/localProviderDiscovery.js'
import { createLmStudioProvider, type LmStudioFetch } from '../../ai/providers/lmStudioProvider.js'
import { testLocalProvider } from '../../ai/providers/testLocalProvider.js'
import { pathExists } from '../../core/fileSystem.js'
import { loadGlobalMemory } from '../../core/globalMemory.js'
import { loadProjectMemory } from '../../core/loadProjectMemory.js'

export const MIN_SUPPORTED_NODE_MAJOR = 18

export type DoctorCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped'

export interface DoctorCheck {
  status: DoctorCheckStatus
  label: string
  detail?: string
  action?: string
}

export interface DoctorSection {
  title: string
  checks: DoctorCheck[]
}

export interface DoctorReport {
  sections: DoctorSection[]
  ready: boolean
}

export interface DoctorOptions {
  projectRoot: string
  args: string[]
  homeDir?: string
  nodeVersion?: string
  cliEntryPath?: string
  packageJsonPath?: string
  providerFetch?: LmStudioFetch
}

interface DoctorFlags {
  testProvider: boolean
}

interface InstallationResult {
  status: 'valid' | 'invalid'
  message: string
}

const statusMarkers: Record<DoctorCheckStatus, string> = {
  passed: '✓',
  warning: '!',
  failed: '✗',
  skipped: '○',
}

function parseNodeMajor(version: string): number | undefined {
  const [major] = version.replace(/^v/, '').split('.')

  if (major === undefined || !/^\d+$/.test(major)) {
    return undefined
  }

  return Number(major)
}

export function parseDoctorArgs(args: string[]): DoctorFlags {
  let testProvider = false

  for (const arg of args) {
    if (arg === '--test-provider') {
      testProvider = true
      continue
    }

    throw new Error(`Unknown friday doctor option: ${arg}. Usage: friday doctor [--test-provider]`)
  }

  return { testProvider }
}

async function checkInstallation(
  cliEntryPath: string,
  packageJsonPath: string,
): Promise<InstallationResult> {
  try {
    await access(cliEntryPath)
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as unknown

    if (
      typeof packageJson !== 'object' ||
      packageJson === null ||
      !('name' in packageJson) ||
      packageJson.name !== 'friday' ||
      !('version' in packageJson) ||
      typeof packageJson.version !== 'string'
    ) {
      return {
        status: 'invalid',
        message: `Friday package metadata is invalid at ${packageJsonPath}. Reinstall or rebuild Friday.`,
      }
    }

    return {
      status: 'valid',
      message: `Friday ${packageJson.version} entry point found at ${cliEntryPath}.`,
    }
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : ''

    return {
      status: 'invalid',
      message: `Friday CLI entry point or package metadata could not be read.${detail}`,
    }
  }
}

function runtimeSection(nodeVersion: string, installation: InstallationResult): DoctorSection {
  const nodeMajor = parseNodeMajor(nodeVersion)
  const runtimeSupported = nodeMajor !== undefined && nodeMajor >= MIN_SUPPORTED_NODE_MAJOR

  return {
    title: 'Runtime and installation',
    checks: [
      runtimeSupported
        ? {
            status: 'passed',
            label: `Node.js ${nodeVersion} is supported`,
          }
        : {
            status: 'failed',
            label: `Node.js ${nodeVersion} is not supported`,
            action: `Install Node.js ${MIN_SUPPORTED_NODE_MAJOR} or newer and rerun "friday doctor".`,
          },
      installation.status === 'valid'
        ? {
            status: 'passed',
            label: 'Friday build/install is readable',
            detail: installation.message,
          }
        : {
            status: 'failed',
            label: 'Friday build/install is invalid',
            detail: installation.message,
            action: 'Run "npm run build" in a checkout or reinstall the Friday package.',
          },
    ],
  }
}

async function projectSection(projectRoot: string): Promise<DoctorSection> {
  try {
    const projectMemory = await loadProjectMemory(projectRoot)
    const fridayDirPath = path.join(projectRoot, '.friday')
    const hasFridayDir = await pathExists(fridayDirPath)

    if (!hasFridayDir) {
      return {
        title: 'Project',
        checks: [
          {
            status: 'warning',
            label: '.friday project memory not found',
            detail: `Checked ${fridayDirPath}. Friday diagnostics can run without project memory.`,
            action: 'Run "friday init" in this project to create local project memory.',
          },
        ],
      }
    }

    const missingFiles = projectMemory.files.filter((file) => !file.exists)

    return {
      title: 'Project',
      checks: [
        {
          status: 'passed',
          label: '.friday project memory found',
          detail: fridayDirPath,
        },
        missingFiles.length === 0
          ? {
              status: 'passed',
              label: 'Project memory is readable and complete',
            }
          : {
              status: 'warning',
              label: `Project memory is partial (${missingFiles.length} missing)`,
              detail: `Missing: ${missingFiles.map((file) => `.friday/${file.fileName}`).join(', ')}.`,
              action:
                'Run "friday init" to create missing memory files without overwriting existing files.',
            },
      ],
    }
  } catch (error) {
    return {
      title: 'Project',
      checks: [
        {
          status: 'failed',
          label: 'Project memory could not be read',
          detail: error instanceof Error ? error.message : String(error),
          action: 'Check permissions and file contents under .friday, then rerun "friday doctor".',
        },
      ],
    }
  }
}

async function globalConfiguration(
  homeDir: string,
): Promise<{ section: DoctorSection; configuration?: GlobalProviderConfiguration }> {
  const checks: DoctorCheck[] = []

  try {
    const globalMemory = await loadGlobalMemory(homeDir)
    const hasGlobalDir = await pathExists(globalMemory.globalMemoryDirPath)
    const existingFiles = globalMemory.files.filter((file) => file.exists)

    if (!hasGlobalDir) {
      checks.push({
        status: 'warning',
        label: '~/.friday global memory not found',
        detail: 'Global memory is optional; project workflows can continue without it.',
        action: `Create ${globalMemory.globalMemoryDirPath} if you want reusable developer memory.`,
      })
    } else if (existingFiles.length === globalMemory.files.length) {
      checks.push({
        status: 'passed',
        label: 'Global memory is readable and complete',
        detail: globalMemory.globalMemoryDirPath,
      })
    } else {
      checks.push({
        status: 'warning',
        label: `Global memory is partial (${existingFiles.length}/${globalMemory.files.length} files)`,
        detail: `Missing: ${globalMemory.files
          .filter((file) => !file.exists)
          .map((file) => file.fileName)
          .join(', ')}. Global memory remains optional.`,
        action: 'Add only the ~/.friday memory files you want Friday to reuse across projects.',
      })
    }
  } catch (error) {
    checks.push({
      status: 'failed',
      label: 'Global memory could not be read',
      detail: error instanceof Error ? error.message : String(error),
      action: 'Check permissions and file contents under ~/.friday, then rerun "friday doctor".',
    })
  }

  try {
    const result = await loadGlobalProviderConfiguration(homeDir)

    if (result.status === 'missing') {
      checks.push({
        status: 'skipped',
        label: 'Provider configuration not present; localhost defaults will be used',
        detail: result.filePath,
      })
      return { section: { title: 'Global configuration', checks } }
    }

    const defaultProvider = result.configuration.defaultProvider ?? 'lm-studio'
    checks.push({
      status: 'passed',
      label: `Provider configuration loaded; default local provider: ${defaultProvider}`,
      detail: result.filePath,
    })

    return {
      section: { title: 'Global configuration', checks },
      configuration: result.configuration,
    }
  } catch (error) {
    checks.push({
      status: 'failed',
      label: 'Provider configuration is invalid',
      detail: error instanceof Error ? error.message : String(error),
      action: 'Fix or remove ~/.friday/providers.json, then rerun "friday doctor".',
    })

    return { section: { title: 'Global configuration', checks } }
  }
}

function endpointCheck(discovery: LmStudioDiscoveryResult): DoctorCheck {
  if (discovery.status === 'unavailable') {
    return {
      status: 'failed',
      label: 'LM Studio endpoint is unavailable',
      detail: discovery.message,
      action: 'Start the LM Studio local server, load a model, and rerun "friday doctor".',
    }
  }

  if (discovery.status === 'invalid-response') {
    return {
      status: 'failed',
      label: `LM Studio returned an invalid response at ${discovery.baseUrl}`,
      detail: discovery.message,
      action: 'Verify the configured OpenAI-compatible base URL and restart LM Studio.',
    }
  }

  return {
    status: 'passed',
    label: `LM Studio server reachable at ${discovery.baseUrl}`,
  }
}

function modelCheck(discovery: LmStudioDiscoveryResult): DoctorCheck {
  if (discovery.status === 'ready') {
    return {
      status: 'passed',
      label: `Model selected: ${discovery.selectedModel}`,
      detail: `Discovered models: ${discovery.models.join(', ')}.`,
    }
  }

  if (discovery.status === 'no-models' || discovery.status === 'choice-required') {
    return {
      status: 'failed',
      label:
        discovery.status === 'no-models' ? 'No local model is loaded' : 'No local model selected',
      detail: discovery.message,
      action:
        discovery.status === 'no-models'
          ? 'Load a model in LM Studio and rerun "friday doctor".'
          : 'Select a loaded model in ~/.friday/providers.json and rerun "friday doctor".',
    }
  }

  return {
    status: 'skipped',
    label: 'Model discovery skipped because the provider endpoint is not usable',
  }
}

async function providerSection(input: {
  configuration?: GlobalProviderConfiguration
  fetch?: LmStudioFetch
  testProvider: boolean
}): Promise<DoctorSection> {
  const providerId = input.configuration?.defaultProvider ?? 'lm-studio'

  if (providerId !== 'lm-studio') {
    return {
      title: 'Local provider',
      checks: [
        {
          status: 'failed',
          label: `Configured default provider "${providerId}" is unsupported`,
          action: 'Set defaultProvider to "lm-studio" in ~/.friday/providers.json.',
        },
        { status: 'skipped', label: 'LM Studio endpoint check skipped' },
        { status: 'skipped', label: 'Model discovery skipped' },
        { status: 'skipped', label: 'Test generation skipped' },
      ],
    }
  }

  const configuration = input.configuration?.providers['lm-studio']
  const discovery = await discoverLmStudioProvider({
    ...(configuration === undefined ? {} : { configuration }),
    ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
  })
  const checks = [endpointCheck(discovery), modelCheck(discovery)]

  if (!input.testProvider) {
    checks.push({
      status: 'skipped',
      label: 'Test generation skipped',
      action: 'Run "friday doctor --test-provider" to perform a lightweight local generation.',
    })
  } else if (discovery.status !== 'ready') {
    checks.push({
      status: 'skipped',
      label: 'Test generation skipped because no provider model is ready',
    })
  } else {
    const provider = createLmStudioProvider({
      baseUrl: discovery.baseUrl,
      model: discovery.selectedModel,
      ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
    })

    try {
      const response = await testLocalProvider(provider, 'friday-doctor')

      checks.push({
        status: 'passed',
        label: 'Test generation succeeded',
        detail: `${response.provider}/${response.model} returned ${response.usage.totalTokens} tokens.`,
      })
    } catch (error) {
      checks.push({
        status: 'failed',
        label: 'Test generation failed',
        detail: error instanceof Error ? error.message : String(error),
        action: 'Check the loaded model and LM Studio server logs, then retry.',
      })
    }
  }

  return { title: 'Local provider', checks }
}

export async function collectDoctorReport(options: DoctorOptions): Promise<DoctorReport> {
  const flags = parseDoctorArgs(options.args)
  const homeDir = options.homeDir ?? os.homedir()
  const modulePath = fileURLToPath(import.meta.url)
  const cliEntryPath = options.cliEntryPath ?? process.argv[1] ?? modulePath
  const packageJsonPath =
    options.packageJsonPath ?? path.resolve(path.dirname(modulePath), '../../..', 'package.json')
  const installation = await checkInstallation(cliEntryPath, packageJsonPath)
  const global = await globalConfiguration(homeDir)
  const sections = [
    runtimeSection(options.nodeVersion ?? process.versions.node, installation),
    await projectSection(options.projectRoot),
    global.section,
    await providerSection({
      ...(global.configuration === undefined ? {} : { configuration: global.configuration }),
      ...(options.providerFetch === undefined ? {} : { fetch: options.providerFetch }),
      testProvider: flags.testProvider,
    }),
  ]

  return {
    sections,
    ready: sections.every((section) => section.checks.every((check) => check.status !== 'failed')),
  }
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ['Friday diagnostics']

  for (const section of report.sections) {
    lines.push('', section.title)

    for (const check of section.checks) {
      lines.push(`${statusMarkers[check.status]} ${check.label}`)

      if (check.detail !== undefined) {
        lines.push(`  ${check.detail}`)
      }

      if (check.action !== undefined) {
        lines.push(`  Action: ${check.action}`)
      }
    }
  }

  lines.push(
    '',
    report.ready
      ? 'Friday is ready for local execution.'
      : 'Friday needs attention before local execution.',
  )

  return lines.join('\n')
}

export async function runDoctorCommand(options: DoctorOptions): Promise<DoctorReport> {
  const report = await collectDoctorReport(options)
  console.log(formatDoctorReport(report))
  return report
}
