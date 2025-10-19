import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'extension.ts')],
    outfile: path.join(rootDir, 'dist', 'src', 'extension.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
})
