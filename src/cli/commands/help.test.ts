import { describe, expect, it, vi } from 'vitest'

import { runHelpCommand } from './help.js'

describe('runHelpCommand', () => {
  it('groups commands around the documented first-run journey', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      runHelpCommand()
      const output = log.mock.calls.map((call) => call.join(' ')).join('\n')

      expect(output).toContain('Start here:')
      expect(output).toContain('friday local setup\n  friday doctor\n  friday init')
      expect(output).toContain('Setup:')
      expect(output).toContain('Preparation and inspection (no model call):')
      expect(output).toContain('Execution:')
      expect(output).toContain('Diagnostics:')
      expect(output).toContain('Advanced policy tools:')
    } finally {
      log.mockRestore()
    }
  })
})
