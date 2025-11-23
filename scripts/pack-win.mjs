import path from 'node:path'
import { fileURLToPath } from 'node:url'
import packager from 'electron-packager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function buildWin() {
    const rootDir = path.resolve(__dirname, '..')

    console.log('Packaging for Windows...')

    const appPaths = await packager({
        dir: rootDir,
        name: 'NebulaFlow',
        platform: 'win32',
        arch: 'x64',
        out: path.join(rootDir, 'dist', 'release'),
        overwrite: true,
        asar: {
            unpackDir: '{node_modules/@vscode/ripgrep,node_modules/@prinova/amp-sdk}',
        },
        prune: true,
        ignore: [
            /^\/\.git/,
            /^\/\.vscode/,
            /^\/\.sourcegraph/,
            /^\/\.nebulaflow/,
            /^\/src/, // VS Code extension source
            /^\/scripts/,
            /^\/tasks/,
            /^\/workflow\/Web/, // Raw web source (we use dist/webviews)
            /^\/electron/, // TS source
            /^\/node_modules\/\.bin/,
            // exclude dev config files
            /\.ts$/,
            /\.map$/,
            /tsconfig\.json/,
            /vite\.config\.mts/,
            /biome\.jsonc/,
        ],
        // Metadata to avoid wine requirement: do not set icon or extended metadata
        // If we set these, packager might try to use wine/rcedit
        appVersion: process.env.npm_package_version,
        electronVersion: '39.2.3', // Should match installed version
        afterCopy: [
            (buildPath, electronVersion, platform, arch, callback) => {
                // Modify package.json in the build to point to the correct main
                import('node:fs').then(fs => {
                    const pkgPath = path.join(buildPath, 'package.json')
                    fs.promises
                        .readFile(pkgPath, 'utf-8')
                        .then(data => {
                            const pkg = JSON.parse(data)
                            pkg.main = 'dist/electron/electron/main/index.js'
                            return fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2))
                        })
                        .then(() => callback())
                        .catch(err => {
                            console.error(err)
                            callback(err)
                        })
                })
            },
        ],
    })

    console.log(`Electron app bundles created in: ${appPaths.join('\n')}`)
}

buildWin().catch(err => {
    console.error('Build failed:', err)
    process.exit(1)
})
