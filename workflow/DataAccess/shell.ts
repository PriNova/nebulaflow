import { type ChildProcess, exec, spawn } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'

const MAX_OUTPUT_CHARS = Number.parseInt(process.env.NEBULAFLOW_SHELL_MAX_OUTPUT || '1000000', 10)
const RESERVED_ENV_UPPER = new Set([
    'PATH',
    'HOME',
    'SHELL',
    'USERPROFILE',
    'COMSPEC',
    'SYSTEMROOT',
    'WINDIR',
    'APPDATA',
    'LOCALAPPDATA',
    'TMP',
    'TEMP',
    'PWD',
    'OLDPWD',
    'PATHEXT',
])

function normalizeEnvKeys(env: Record<string, any>): Record<string, string> {
    const out: Record<string, string> = {}
    if (process.platform === 'win32') {
        for (const [k, v] of Object.entries(env || {})) {
            out[k.toUpperCase()] = String(v ?? '')
        }
    } else {
        for (const [k, v] of Object.entries(env || {})) {
            out[k] = String(v ?? '')
        }
    }
    return out
}

function terminateProcess(child: ChildProcess): void {
    try {
        if (process.platform === 'win32') {
            try {
                child.kill('SIGINT')
            } catch {}
            try {
                child.kill('SIGTERM')
            } catch {}
            try {
                spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)])
            } catch {}
        } else {
            try {
                child.kill('SIGTERM')
            } catch {}
            try {
                child.kill('SIGINT')
            } catch {}
        }
    } catch {}
}

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
                let out = stdout?.toString() + (stderr ? `\n${stderr.toString()}` : '')
                if (out.length > MAX_OUTPUT_CHARS) {
                    out = out.slice(0, MAX_OUTPUT_CHARS) + '\n... (truncated)'
                }
                resolve({ output: out, exitCode: code })
            }
        )
        if (abortSignal) {
            if (abortSignal.aborted) {
                try {
                    terminateProcess(proc as unknown as ChildProcess)
                } catch {}
                return reject(new Error('aborted'))
            }
            const onAbort = () => {
                try {
                    terminateProcess(proc as unknown as ChildProcess)
                } catch {}
                reject(new Error('aborted'))
            }
            abortSignal.addEventListener('abort', onAbort, { once: true })
        }
    })
}

export function executeCommandSpawn(
    command: string,
    abortSignal?: AbortSignal,
    opts?: { cwd?: string }
): Promise<{ output: string; exitCode: string }> {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32'
        const cmd = isWindows ? process.env.ComSpec || 'cmd.exe' : process.env.SHELL || '/bin/sh'
        const args = isWindows ? ['/d', '/s', '/c', command] : ['-c', command]
        const child = spawn(cmd, args, {
            cwd: opts?.cwd,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdoutBuf = ''
        let stderrBuf = ''
        let truncated = false

        const onAbort = () => {
            try {
                terminateProcess(child)
            } catch {}
            reject(new Error('aborted'))
        }
        if (abortSignal) {
            if (abortSignal.aborted) return onAbort()
            abortSignal.addEventListener('abort', onAbort, { once: true })
        }
        child.stdout.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            const remain = MAX_OUTPUT_CHARS - stdoutBuf.length
            if (remain > 0) {
                if (s.length > remain) {
                    stdoutBuf += s.slice(0, remain)
                    truncated = true
                } else {
                    stdoutBuf += s
                }
            } else {
                truncated = true
            }
        })
        child.stderr.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            const remain = MAX_OUTPUT_CHARS - stderrBuf.length
            if (remain > 0) {
                if (s.length > remain) {
                    stderrBuf += s.slice(0, remain)
                    truncated = true
                } else {
                    stderrBuf += s
                }
            } else {
                truncated = true
            }
        })
        child.on('error', err => reject(err))
        child.on('close', code => {
            if (abortSignal) abortSignal.removeEventListener('abort', onAbort as any)
            const exitCode = code == null ? '0' : String(code)
            let output = stdoutBuf + (stderrBuf ? `\n${stderrBuf}` : '')
            if (truncated || output.length > MAX_OUTPUT_CHARS) {
                if (output.length > MAX_OUTPUT_CHARS) output = output.slice(0, MAX_OUTPUT_CHARS)
                output += '\n... (truncated)'
            }
            resolve({ output, exitCode })
        })
    })
}

export async function executeScript(params: {
    shell?: 'bash' | 'sh' | 'zsh' | 'pwsh' | 'cmd'
    flags?: {
        exitOnError?: boolean
        unsetVars?: boolean
        pipefail?: boolean
        noProfile?: boolean // pwsh
        nonInteractive?: boolean // pwsh
        executionPolicyBypass?: boolean // pwsh
    }
    script: string
    stdinText?: string
    cwd?: string
    env?: Record<string, string>
    abortSignal?: AbortSignal
}): Promise<{ output: string; exitCode: string }> {
    const isWindows = process.platform === 'win32'
    const shell = params.shell || (isWindows ? 'pwsh' : 'bash')

    const safeUserEnv: Record<string, string> = {}
    if (params.env && typeof params.env === 'object') {
        for (const [k, v] of Object.entries(params.env)) {
            if (RESERVED_ENV_UPPER.has(k.toUpperCase())) continue
            safeUserEnv[k] = v
        }
    }
    const baseEnv = normalizeEnvKeys(process.env as any)
    const extraEnv = normalizeEnvKeys(safeUserEnv)
    for (const key of Object.keys(extraEnv)) {
        if (RESERVED_ENV_UPPER.has(key)) delete (extraEnv as any)[key]
    }
    const env = { ...baseEnv, ...extraEnv }

    // Build strict prologue for POSIX shells
    const prologue: string[] = []
    if (shell !== 'pwsh' && shell !== 'cmd') {
        if (params.flags?.exitOnError) prologue.push('set -e')
        if (params.flags?.unsetVars) prologue.push('set -u')
        if (params.flags?.pipefail) prologue.push('set -o pipefail')
    }

    // Compose full script to execute
    const fullScript = (prologue.length > 0 ? prologue.join('\n') + '\n' : '') + (params.script || '')

    // Prepare spawn args per shell so that script is provided as an argument (not via stdin),
    // keeping stdin free for script input (e.g., jq pipelines)
    let cmd: string = shell
    let args: string[] = []
    if (shell === 'bash' || shell === 'sh' || shell === 'zsh') {
        args = ['-c', fullScript]
    } else if (shell === 'pwsh') {
        const pwshArgs: string[] = []
        if (params.flags?.noProfile !== false) pwshArgs.push('-NoProfile')
        if (params.flags?.nonInteractive !== false) pwshArgs.push('-NonInteractive')
        if (params.flags?.executionPolicyBypass) pwshArgs.push('-ExecutionPolicy', 'Bypass')
        pwshArgs.push('-Command', fullScript)
        args = pwshArgs
        cmd = 'pwsh'
    } else if (shell === 'cmd') {
        // Basic cmd support: execute as one-liner command string
        args = ['/d', '/s', '/c', fullScript]
        cmd = process.env.ComSpec || 'cmd.exe'
    }

    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: params.cwd,
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        let stdoutBuf = ''
        let stderrBuf = ''
        let truncated = false

        const onAbort = () => {
            try {
                terminateProcess(child)
            } catch {}
            reject(new Error('aborted'))
        }
        if (params.abortSignal) {
            if (params.abortSignal.aborted) return onAbort()
            params.abortSignal.addEventListener('abort', onAbort, { once: true })
        }

        child.stdout.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            const remain = MAX_OUTPUT_CHARS - stdoutBuf.length
            if (remain > 0) {
                if (s.length > remain) {
                    stdoutBuf += s.slice(0, remain)
                    truncated = true
                } else {
                    stdoutBuf += s
                }
            } else {
                truncated = true
            }
        })
        child.stderr.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            const remain = MAX_OUTPUT_CHARS - stderrBuf.length
            if (remain > 0) {
                if (s.length > remain) {
                    stderrBuf += s.slice(0, remain)
                    truncated = true
                } else {
                    stderrBuf += s
                }
            } else {
                truncated = true
            }
        })
        child.on('error', err => {
            reject(err)
        })
        child.on('close', code => {
            if (params.abortSignal) params.abortSignal.removeEventListener('abort', onAbort as any)
            const exitCode = code == null ? '0' : String(code)
            let output = stdoutBuf + (stderrBuf ? `\n${stderrBuf}` : '')
            if (truncated || output.length > MAX_OUTPUT_CHARS) {
                if (output.length > MAX_OUTPUT_CHARS) output = output.slice(0, MAX_OUTPUT_CHARS)
                output += '\n... (truncated)'
            }
            resolve({ output, exitCode })
        })

        // Write stdin payload (if any), then end
        if (params.stdinText != null) {
            try {
                child.stdin.write(params.stdinText)
            } catch {}
        }
        try {
            child.stdin.end()
        } catch {}
    })
}
