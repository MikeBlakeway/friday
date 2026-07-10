import fs from 'node:fs/promises'
import path from 'node:path'

const distPath = path.join(process.cwd(), 'dist')

await fs.rm(distPath, { force: true, recursive: true })
