import { describe, expect, it, vi } from 'vitest'

import { createStatusReporter } from './statusReporter.js'

function createOutput(isTTY: boolean): {
  output: { isTTY: boolean; write: (chunk: string) => boolean }
  content: () => string
} {
  let written = ''

  return {
    output: {
      isTTY,
      write(chunk) {
        written += chunk
        return true
      },
    },
    content: () => written,
  }
}

describe('createStatusReporter', () => {
  it('prints stable timestamped phase lines without animation in non-TTY output', () => {
    const { output, content } = createOutput(false)
    const reporter = createStatusReporter({
      output,
      env: {},
      now: () => new Date('2026-07-13T12:34:56.000Z'),
    })

    reporter.start('Privacy classification')
    reporter.success()

    expect(content()).toBe(
      '[2026-07-13T12:34:56.000Z] [start] Privacy classification\n' +
        '[2026-07-13T12:34:56.000Z] [success] Privacy classification\n',
    )
  })

  it('disables animation in CI even when stdout is a TTY', () => {
    const { output, content } = createOutput(true)
    const setInterval = vi.fn()
    const reporter = createStatusReporter({
      output,
      env: { CI: 'true' },
      now: () => new Date('2026-07-13T12:34:56.000Z'),
      setInterval,
    })

    reporter.start('Provider routing')
    reporter.warn('Provider routing used the local fallback')

    expect(setInterval).not.toHaveBeenCalled()
    expect(content()).toContain('[start] Provider routing')
    expect(content()).toContain('[warn] Provider routing used the local fallback')
    expect(content()).not.toContain('\r')
  })

  it('clears the spinner and prints a final failure state', () => {
    const { output, content } = createOutput(true)
    let tick: (() => void) | undefined
    const timer = { unref: vi.fn() }
    const clearInterval = vi.fn()
    const reporter = createStatusReporter({
      output,
      env: {},
      setInterval(callback) {
        tick = callback
        return timer
      },
      clearInterval,
    })

    reporter.start('Model execution')
    tick?.()
    reporter.fail()

    expect(timer.unref).toHaveBeenCalledOnce()
    expect(clearInterval).toHaveBeenCalledWith(timer)
    expect(content()).toContain('\r')
    expect(content()).toMatch(/✗ Model execution\n$/)
  })
})
