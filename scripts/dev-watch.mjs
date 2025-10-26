import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function run(name, cmd, args) {
    const child = spawn(cmd, args, {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    const prefix = `${name} | `

    const pipe = (stream, write) => {
        stream.on('data', buf => {
            const text = buf.toString()
            const lines = text.split('\n')
            for (const line of lines) {
                if (line.length === 0) continue
                write(prefix + line + '\n')
            }
        })
    }

    pipe(child.stdout, s => process.stdout.write(s))
    pipe(child.stderr, s => process.stderr.write(s))

    child.on('close', code => {
        console.log(`${name} exited with code ${code}`)
    })
    return child
}

const procs = [
    run('web', 'npm', ['run', 'watch:webview']),
    run('ext', 'node', ['scripts/bundle-ext.mjs', '--watch']),
]

function shutdown() {
    for (const p of procs) {
        if (!p.killed) p.kill('SIGTERM')
    }
    process.exit()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('Watching webview and extension…')
