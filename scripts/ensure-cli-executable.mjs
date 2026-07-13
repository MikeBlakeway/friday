import { chmod } from 'node:fs/promises'

const cliPath = new URL('../dist/cli/index.js', import.meta.url)

await chmod(cliPath, 0o755)
