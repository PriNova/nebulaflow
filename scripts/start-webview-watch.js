const { spawn } = require('node:child_process')
;(function main() {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const child = spawn(npmCmd, ['run', 'watch:webview'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'ignore',
        detached: true,
    })
    child.unref()
})()
