import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { BrowserWindow, Menu, MenuItem, app, dialog, ipcMain, protocol } from 'electron'
import {
    cleanupSession,
    setupWorkflowMessageHandling,
} from '../../workflow/Application/workflow-session'
import { initializeHost } from '../../workflow/DataAccess/fs'
import { initializeWorkspace } from '../../workflow/Shared/Infrastructure/workspace'
import { ElectronHost, ElectronMessagePort, ElectronWorkspace } from './ElectronHost'

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'nebulaflow',
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    const host = new ElectronHost()
    initializeHost(host)
    initializeWorkspace(host)

    const port = new ElectronMessagePort(mainWindow.webContents, ipcMain)

    const menu = new Menu()
    menu.append(
        new MenuItem({
            label: 'File',
            submenu: [
                {
                    label: 'Open Folder...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        if (!mainWindow) return
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openDirectory'],
                        })
                        if (!result.canceled && result.filePaths.length > 0) {
                            const folder = result.filePaths[0]
                            if (host.workspace instanceof ElectronWorkspace) {
                                host.workspace.setWorkspaceFolder(folder)
                                mainWindow.title = `NebulaFlow - ${folder}`
                                // Notify webview about change if needed, or just let next operations use new root.
                                // Ideally we should trigger a "storage_scope" refresh if currently in workspace mode.
                                // We can reuse the same mechanism as toggle:
                                port.postMessage({
                                    type: 'storage_scope',
                                    data: {
                                        scope:
                                            host.workspace.getConfiguration<string>(
                                                'nebulaFlow.storageScope',
                                                'user'
                                            ) === 'workspace'
                                                ? 'workspace'
                                                : 'user',
                                        basePath: host.workspace.getConfiguration<string>(
                                            'nebulaFlow.globalStoragePath',
                                            ''
                                        ),
                                    },
                                })
                                // Also trigger custom nodes refresh as they might be in the new workspace
                                port.postMessage({ type: 'refresh_custom_nodes' })
                            }
                        }
                    },
                },
                { type: 'separator' },
                { role: 'quit' },
            ],
        })
    )
    menu.append(
        new MenuItem({
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' },
            ],
        })
    )
    menu.append(
        new MenuItem({
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        })
    )
    Menu.setApplicationMenu(menu)

    const isDev = process.env.NODE_ENV === 'development'

    setupWorkflowMessageHandling(host, port, isDev, uri => {
        if (mainWindow) {
            // Check if workspace mode is active and use absolute path if available
            if (
                host.workspace instanceof ElectronWorkspace &&
                host.workspace.workspaceFolders.length > 0
            ) {
                const wsRoot = host.workspace.workspaceFolders[0]
                if (wsRoot && wsRoot !== require('node:os').homedir()) {
                    mainWindow.title = `NebulaFlow - ${wsRoot}`
                    return
                }
            }
            mainWindow.title = uri ? `NebulaFlow - ${path.basename(uri)}` : 'NebulaFlow'
        }
    })

    if (isDev) {
        mainWindow.loadURL('nebulaflow://app/workflow.html')
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadURL('nebulaflow://app/workflow.html')
    }

    if (host.workspace instanceof ElectronWorkspace && host.workspace.workspaceFolders.length > 0) {
        const wsRoot = host.workspace.workspaceFolders[0]
        if (wsRoot && wsRoot !== require('node:os').homedir()) {
            mainWindow.title = `NebulaFlow - ${wsRoot}`
        }
    }

    mainWindow.on('closed', () => {
        cleanupSession(port)
        mainWindow = null
    })
}

app.whenReady().then(() => {
    protocol.handle('nebulaflow', async request => {
        const url = new URL(request.url)
        if (url.host === 'app') {
            let filePath = url.pathname
            if (filePath === '/') filePath = '/workflow.html'

            const distWebviews = path.join(__dirname, '../../../webviews')
            const fullPath = path.join(distWebviews, filePath)

            try {
                const data = await fs.readFile(fullPath)
                const ext = path.extname(fullPath)
                let contentType = 'text/html'
                if (ext === '.js') contentType = 'text/javascript'
                if (ext === '.css') contentType = 'text/css'
                if (ext === '.json') contentType = 'application/json'
                if (ext === '.png') contentType = 'image/png'
                if (ext === '.svg') contentType = 'image/svg+xml'

                if (filePath.endsWith('workflow.html')) {
                    let html = data.toString('utf-8')
                    html = html.replaceAll('{cspSource}', "'self' 'unsafe-inline'")
                    // Inject platform marker for CSS targeting
                    html = html.replace('<html', '<html data-platform="electron"')
                    return new Response(html, {
                        status: 200,
                        headers: { 'content-type': contentType },
                    })
                }

                return new Response(data as unknown as BodyInit, {
                    status: 200,
                    headers: { 'content-type': contentType },
                })
            } catch (e) {
                console.error('Failed to load resource', fullPath, e)
                return new Response('Not found', { status: 404 })
            }
        }
        return new Response('Bad request', { status: 400 })
    })

    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})
