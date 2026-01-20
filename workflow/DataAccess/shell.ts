import { type ChildProcess, spawn } from 'node:child_process'
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

type StreamCallback = (chunk: string, stream: 'stdout' | 'stderr') => void

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
    opts?: { cwd?: string },
    onChunk?: StreamCallback
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
        // Line buffers for streaming
        let stdoutLineBuffer = ''
        let stderrLineBuffer = ''

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

        const processChunk = (chunk: string, stream: 'stdout' | 'stderr') => {
            // Append to line buffer
            const lineBuffer = stream === 'stdout' ? stdoutLineBuffer : stderrLineBuffer
            const fullData = lineBuffer + chunk
            const lines = fullData.split('\n')
            // The last element is the incomplete line (or empty if chunk ends with newline)
            const incompleteLine = lines.pop() ?? ''
            // Emit each complete line
            for (const line of lines) {
                if (onChunk) onChunk(line, stream)
                // Also add to output buffer (subject to limit)
                const targetBuf = stream === 'stdout' ? stdoutBuf : stderrBuf
                const remain = MAX_OUTPUT_CHARS - targetBuf.length
                if (remain > 0) {
                    const lineWithNewline = line + '\n'
                    if (lineWithNewline.length > remain) {
                        if (stream === 'stdout') {
                            stdoutBuf += lineWithNewline.slice(0, remain)
                        } else {
                            stderrBuf += lineWithNewline.slice(0, remain)
                        }
                        truncated = true
                    } else {
                        if (stream === 'stdout') {
                            stdoutBuf += lineWithNewline
                        } else {
                            stderrBuf += lineWithNewline
                        }
                    }
                } else {
                    truncated = true
                }
            }
            // Update line buffer
            if (stream === 'stdout') {
                stdoutLineBuffer = incompleteLine
            } else {
                stderrLineBuffer = incompleteLine
            }
        }

        child.stdout.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            processChunk(s, 'stdout')
        })
        child.stderr.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            processChunk(s, 'stderr')
        })
        child.on('error', err => {
            reject(err)
        })
        child.on('close', code => {
            if (abortSignal) abortSignal.removeEventListener('abort', onAbort as any)
            // Emit any remaining incomplete lines
            if (stdoutLineBuffer.length > 0) {
                if (onChunk) onChunk(stdoutLineBuffer, 'stdout')
                // Add to stdoutBuf
                const remain = MAX_OUTPUT_CHARS - stdoutBuf.length
                if (remain > 0) {
                    if (stdoutLineBuffer.length > remain) {
                        stdoutBuf += stdoutLineBuffer.slice(0, remain)
                        truncated = true
                    } else {
                        stdoutBuf += stdoutLineBuffer
                    }
                } else {
                    truncated = true
                }
            }
            if (stderrLineBuffer.length > 0) {
                if (onChunk) onChunk(stderrLineBuffer, 'stderr')
                const remain = MAX_OUTPUT_CHARS - stderrBuf.length
                if (remain > 0) {
                    if (stderrLineBuffer.length > remain) {
                        stderrBuf += stderrLineBuffer.slice(0, remain)
                        truncated = true
                    } else {
                        stderrBuf += stderrLineBuffer
                    }
                } else {
                    truncated = true
                }
            }
            const exitCode = code == null ? '0' : String(code)
            let output = stdoutBuf + (stderrBuf ? `\\n${stderrBuf}` : '')
            if (truncated || output.length > MAX_OUTPUT_CHARS) {
                if (output.length > MAX_OUTPUT_CHARS) output = output.slice(0, MAX_OUTPUT_CHARS)
                output += '\\n... (truncated)'
            }
            resolve({ output, exitCode })
        })
    })
}

export function executeCommandSpawn(
    command: string,
    abortSignal?: AbortSignal,
    opts?: { cwd?: string },
    onChunk?: StreamCallback
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
        // Line buffers for streaming
        let stdoutLineBuffer = ''
        let stderrLineBuffer = ''

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

        const processChunk = (chunk: string, stream: 'stdout' | 'stderr') => {
            // Append to line buffer
            const lineBuffer = stream === 'stdout' ? stdoutLineBuffer : stderrLineBuffer
            const fullData = lineBuffer + chunk
            const lines = fullData.split('\n')
            // The last element is the incomplete line (or empty if chunk ends with newline)
            const incompleteLine = lines.pop() ?? ''
            // Emit each complete line
            for (const line of lines) {
                if (onChunk) onChunk(line, stream)
                // Also add to output buffer (subject to limit)
                const targetBuf = stream === 'stdout' ? stdoutBuf : stderrBuf
                const remain = MAX_OUTPUT_CHARS - targetBuf.length
                if (remain > 0) {
                    const lineWithNewline = line + '\n'
                    if (lineWithNewline.length > remain) {
                        if (stream === 'stdout') {
                            stdoutBuf += lineWithNewline.slice(0, remain)
                        } else {
                            stderrBuf += lineWithNewline.slice(0, remain)
                        }
                        truncated = true
                    } else {
                        if (stream === 'stdout') {
                            stdoutBuf += lineWithNewline
                        } else {
                            stderrBuf += lineWithNewline
                        }
                    }
                } else {
                    truncated = true
                }
            }
            // Update line buffer
            if (stream === 'stdout') {
                stdoutLineBuffer = incompleteLine
            } else {
                stderrLineBuffer = incompleteLine
            }
        }

        child.stdout.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            processChunk(s, 'stdout')
        })
        child.stderr.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            processChunk(s, 'stderr')
        })
        child.on('error', err => reject(err))
        child.on('close', code => {
            if (abortSignal) abortSignal.removeEventListener('abort', onAbort as any)
            // Emit any remaining incomplete lines
            if (stdoutLineBuffer.length > 0) {
                if (onChunk) onChunk(stdoutLineBuffer, 'stdout')
                // Add to stdoutBuf
                const remain = MAX_OUTPUT_CHARS - stdoutBuf.length
                if (remain > 0) {
                    if (stdoutLineBuffer.length > remain) {
                        stdoutBuf += stdoutLineBuffer.slice(0, remain)
                        truncated = true
                    } else {
                        stdoutBuf += stdoutLineBuffer
                    }
                } else {
                    truncated = true
                }
            }
            if (stderrLineBuffer.length > 0) {
                if (onChunk) onChunk(stderrLineBuffer, 'stderr')
                const remain = MAX_OUTPUT_CHARS - stderrBuf.length
                if (remain > 0) {
                    if (stderrLineBuffer.length > remain) {
                        stderrBuf += stderrLineBuffer.slice(0, remain)
                        truncated = true
                    } else {
                        stderrBuf += stderrLineBuffer
                    }
                } else {
                    truncated = true
                }
            }
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
    onChunk?: StreamCallback
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
        // Line buffers for streaming
        let stdoutLineBuffer = ''
        let stderrLineBuffer = ''

        const onAbort = () => {
            try {
                terminateProcess(child)
            } catch {}
            reject(new Error('aborted'))
        }
        const processChunk = (chunk: string, stream: 'stdout' | 'stderr') => {
            // Append to line buffer
            const lineBuffer = stream === 'stdout' ? stdoutLineBuffer : stderrLineBuffer
            const fullData = lineBuffer + chunk
            const lines = fullData.split('\n')
            // The last element is the incomplete line (or empty if chunk ends with newline)
            const incompleteLine = lines.pop() ?? ''
            // Emit each complete line
            for (const line of lines) {
                if (params.onChunk) params.onChunk(line, stream)
                // Also add to output buffer (subject to limit)
                const targetBuf = stream === 'stdout' ? stdoutBuf : stderrBuf
                const remain = MAX_OUTPUT_CHARS - targetBuf.length
                if (remain > 0) {
                    const lineWithNewline = line + '\n'
                    if (lineWithNewline.length > remain) {
                        if (stream === 'stdout') {
                            stdoutBuf += lineWithNewline.slice(0, remain)
                        } else {
                            stderrBuf += lineWithNewline.slice(0, remain)
                        }
                        truncated = true
                    } else {
                        if (stream === 'stdout') {
                            stdoutBuf += lineWithNewline
                        } else {
                            stderrBuf += lineWithNewline
                        }
                    }
                } else {
                    truncated = true
                }
            }
            // Update line buffer
            if (stream === 'stdout') {
                stdoutLineBuffer = incompleteLine
            } else {
                stderrLineBuffer = incompleteLine
            }
        }

        if (params.abortSignal) {
            if (params.abortSignal.aborted) return onAbort()
            params.abortSignal.addEventListener('abort', onAbort, { once: true })
        }

        child.stdout.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            processChunk(s, 'stdout')
        })
        child.stderr.on('data', chunk => {
            const s = chunk?.toString() ?? ''
            processChunk(s, 'stderr')
        })
        child.on('error', err => {
            reject(err)
        })
        child.on('close', code => {
            if (params.abortSignal) params.abortSignal.removeEventListener('abort', onAbort as any)
            // Emit any remaining incomplete lines
            if (stdoutLineBuffer.length > 0) {
                if (params.onChunk) params.onChunk(stdoutLineBuffer, 'stdout')
                // Add to stdoutBuf
                const remain = MAX_OUTPUT_CHARS - stdoutBuf.length
                if (remain > 0) {
                    if (stdoutLineBuffer.length > remain) {
                        stdoutBuf += stdoutLineBuffer.slice(0, remain)
                        truncated = true
                    } else {
                        stdoutBuf += stdoutLineBuffer
                    }
                } else {
                    truncated = true
                }
            }
            if (stderrLineBuffer.length > 0) {
                if (params.onChunk) params.onChunk(stderrLineBuffer, 'stderr')
                const remain = MAX_OUTPUT_CHARS - stderrBuf.length
                if (remain > 0) {
                    if (stderrLineBuffer.length > remain) {
                        stderrBuf += stderrLineBuffer.slice(0, remain)
                        truncated = true
                    } else {
                        stderrBuf += stderrLineBuffer
                    }
                } else {
                    truncated = true
                }
            }
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
