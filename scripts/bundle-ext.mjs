import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const buildOptions = {
    entryPoints: [path.join(rootDir, 'src', 'extension.ts')],
    outfile: path.join(rootDir, 'dist', 'src', 'extension.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
}

const isWatch = process.argv.includes('--watch')

if (isWatch) {
    const ctx = await esbuild.context(buildOptions)
    await ctx.watch()
    console.log('Extension watch started')
    process.stdin.resume()
} else {
    await esbuild.build(buildOptions)
    console.log('Extension build complete')
}
