import { spawnSync } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runNpm(args) {
  const result = spawnSync(npmCommand, args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    return false
  }

  return true
}

if (runNpm(['run', 'build']) && runNpm(['link'])) {
  console.log('')
  console.log('Friday is linked to this checkout and available as `friday`.')
  console.log('Run `npm run dev:linked` to rebuild automatically while files change.')
}
