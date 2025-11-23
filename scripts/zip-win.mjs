import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const releaseDir = path.join(rootDir, 'dist', 'release')
const sourceDir = path.join(releaseDir, 'NebulaFlow-win32-x64')
const outputFile = path.join(releaseDir, 'NebulaFlow-win32-x64.zip')

if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory does not exist: ${sourceDir}`)
    process.exit(1)
}

const output = fs.createWriteStream(outputFile)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
    console.log(`✅ Created ${outputFile} (${archive.pointer()} bytes)`)
})

archive.on('error', err => {
    console.error('❌ Archive error:', err)
    process.exit(1)
})

archive.pipe(output)
archive.directory(sourceDir, 'NebulaFlow-win32-x64')
archive.finalize()
