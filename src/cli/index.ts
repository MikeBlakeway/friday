#!/usr/bin/env node

import { runHelpCommand } from './commands/help.js'
import { runInitCommand } from './commands/init.js'
import { runStatusCommand } from './commands/status.js'

async function main(): Promise<void> {
  const command = process.argv[2]
  const projectRoot = process.cwd()

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    runHelpCommand()
    return
  }

  switch (command) {
    case 'init':
      await runInitCommand({ projectRoot })
      return
    case 'status':
      await runStatusCommand({ projectRoot })
      return
    default:
      throw new Error(`Unknown command: ${command}. Run "friday help" for usage.`)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Friday error: ${message}`)
  process.exitCode = 1
})
