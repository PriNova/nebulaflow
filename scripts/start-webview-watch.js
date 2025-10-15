const { spawn } = require('node:child_process')

function main() {
    console.log('WEBVIEW_WATCH_START')

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const child = spawn(npmCmd, ['run', 'watch:webview'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
    })

    let readyEmitted = false
    const maybeEmitReady = chunk => {
        const s = chunk.toString()
        // Forward vite output
        process.stdout.write(s)
        // Consider ready when first build completes or watcher announces
        if (!readyEmitted && (/\bbuilt in\b/i.test(s) || /watching for changes/i.test(s))) {
            readyEmitted = true
            console.log('WEBVIEW_WATCH_READY')
        }
    }

    // Pipe output and detect readiness
    if (child.stdout) child.stdout.on('data', maybeEmitReady)
    if (child.stderr) child.stderr.on('data', d => process.stderr.write(d))

    const terminate = () => {
        try {
            if (!child.killed) {
                child.kill('SIGTERM')
            }
        } catch {}
    }
    process.on('SIGINT', terminate)
    process.on('SIGTERM', terminate)
    process.on('exit', terminate)

    child.on('exit', (code, signal) => {
        // Ensure parent exits when child exits
        process.exit(typeof code === 'number' ? code : 0)
    })
}

main()
