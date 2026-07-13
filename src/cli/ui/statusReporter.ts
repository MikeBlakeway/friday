export const workflowPhaseLabels = {
  promptBuild: 'Prompt build',
  privacyClassification: 'Privacy classification',
  providerRouting: 'Provider routing',
  modelExecution: 'Model execution',
  outputWriting: 'Output writing',
} as const

export type StatusState = 'start' | 'success' | 'warn' | 'fail'

export interface StatusReporter {
  start(message: string): void
  success(message?: string): void
  warn(message: string): void
  fail(message?: string): void
}

interface StatusOutput {
  isTTY?: boolean
  write(chunk: string): unknown
}

interface StatusTimer {
  unref?: () => void
}

export interface CreateStatusReporterOptions {
  output?: StatusOutput
  env?: NodeJS.ProcessEnv
  now?: () => Date
  setInterval?: (callback: () => void, intervalMs: number) => StatusTimer
  clearInterval?: (timer: StatusTimer) => void
}

const spinnerFrames = ['·  ', '·· ', '···'] as const

function isCiEnvironment(env: NodeJS.ProcessEnv): boolean {
  const value = env.CI?.trim().toLowerCase()
  return value !== undefined && value !== '' && value !== '0' && value !== 'false'
}

function stateSymbol(state: Exclude<StatusState, 'start'>): string {
  if (state === 'success') {
    return '✓'
  }

  if (state === 'warn') {
    return '!'
  }

  return '✗'
}

export function createStatusReporter(options: CreateStatusReporterOptions = {}): StatusReporter {
  const output = options.output ?? process.stdout
  const env = options.env ?? process.env
  const now = options.now ?? (() => new Date())
  const animated = output.isTTY === true && !isCiEnvironment(env)
  const startTimer =
    options.setInterval ??
    ((callback: () => void, intervalMs: number): StatusTimer => setInterval(callback, intervalMs))
  const stopTimer =
    options.clearInterval ??
    ((timer: StatusTimer): void => clearInterval(timer as ReturnType<typeof setInterval>))
  let activeMessage: string | undefined
  let timer: StatusTimer | undefined
  let frameIndex = 0

  function writePlain(state: StatusState, message: string): void {
    output.write(`[${now().toISOString()}] [${state}] ${message}\n`)
  }

  function clearSpinner(): void {
    if (timer !== undefined) {
      stopTimer(timer)
      timer = undefined
    }
  }

  function finish(state: Exclude<StatusState, 'start'>, message?: string): void {
    const finalMessage = message ?? activeMessage
    clearSpinner()

    if (finalMessage === undefined) {
      return
    }

    if (animated) {
      output.write(`\r\u001B[2K${stateSymbol(state)} ${finalMessage}\n`)
    } else {
      writePlain(state, finalMessage)
    }

    activeMessage = undefined
  }

  return {
    start(message) {
      if (activeMessage !== undefined) {
        finish('warn', `${activeMessage} interrupted`)
      }

      activeMessage = message
      frameIndex = 0

      if (!animated) {
        writePlain('start', message)
        return
      }

      output.write(`\r${spinnerFrames[frameIndex]} ${message}`)
      timer = startTimer(() => {
        frameIndex = (frameIndex + 1) % spinnerFrames.length
        output.write(`\r${spinnerFrames[frameIndex]} ${message}`)
      }, 240)
      timer.unref?.()
    },
    success(message) {
      finish('success', message)
    },
    warn(message) {
      finish('warn', message)
    },
    fail(message) {
      finish('fail', message)
    },
  }
}

export async function withStatusPhase<T>(
  reporter: StatusReporter | undefined,
  message: string,
  action: () => T | Promise<T>,
): Promise<T> {
  reporter?.start(message)

  try {
    const result = await action()
    reporter?.success()
    return result
  } catch (error) {
    reporter?.fail()
    throw error
  }
}
