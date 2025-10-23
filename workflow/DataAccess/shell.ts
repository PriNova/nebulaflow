import { exec } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'

export function expandHome(input: string): string {
    const homeDir = os.homedir() || process.env.HOME || process.env.USERPROFILE || ''
    return input.replaceAll(/(\s~\/)/g, ` ${homeDir}${path.sep}`)
}

export function execute(
    command: string,
    abortSignal?: AbortSignal,
    opts?: { cwd?: string }
): Promise<{ output: string; exitCode: string }> {
    return new Promise((resolve, reject) => {
        const proc = exec(
            command,
            { env: process.env, shell: process.env.SHELL || undefined, cwd: opts?.cwd },
            (error, stdout, stderr) => {
                const code = error && (error as any).code != null ? String((error as any).code) : '0'
                const output = stdout?.toString() + (stderr ? `\n${stderr.toString()}` : '')
                resolve({ output, exitCode: code })
            }
        )
        if (abortSignal) {
            if (abortSignal.aborted) {
                try {
                    proc.kill('SIGTERM')
                } catch {}
                return reject(new Error('aborted'))
            }
            const onAbort = () => {
                try {
                    proc.kill('SIGTERM')
                } catch {}
                reject(new Error('aborted'))
            }
            abortSignal.addEventListener('abort', onAbort, { once: true })
        }
    })
}
