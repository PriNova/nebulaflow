import * as fsSync from 'node:fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { app, clipboard, dialog, shell } from 'electron'
import {
    type ConfigurationTarget,
    FileType,
    type IClipboard,
    type IFileSystem,
    type IHostEnvironment,
    type IMessagePort,
    type IWindow,
    type IWorkspace,
    type OpenDialogOptions,
    type SaveDialogOptions,
} from '../../workflow/Shared/Host/index'

export class ElectronFileSystem implements IFileSystem {
    async readFile(filePath: string): Promise<Uint8Array> {
        return await fs.readFile(filePath)
    }

    async writeFile(filePath: string, content: Uint8Array): Promise<void> {
        await fs.writeFile(filePath, content)
    }

    async createDirectory(dirPath: string): Promise<void> {
        await fs.mkdir(dirPath, { recursive: true })
    }

    async readDirectory(dirPath: string): Promise<[string, FileType][]> {
        const names = await fs.readdir(dirPath)
        const results: [string, FileType][] = []
        for (const name of names) {
            try {
                const stats = await fs.stat(path.join(dirPath, name))
                let type = FileType.Unknown
                if (stats.isFile()) type = FileType.File
                else if (stats.isDirectory()) type = FileType.Directory
                else if (stats.isSymbolicLink()) type = FileType.SymbolicLink
                results.push([name, type])
            } catch {
                results.push([name, FileType.Unknown])
            }
        }
        return results
    }

    async delete(filePath: string, options?: { recursive?: boolean }): Promise<void> {
        await fs.rm(filePath, { recursive: options?.recursive, force: true })
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath)
            return true
        } catch {
            return false
        }
    }
}

export class ElectronWindow implements IWindow {
    async showErrorMessage(message: string): Promise<void> {
        await dialog.showMessageBox({ type: 'error', message })
    }

    async showInformationMessage(message: string): Promise<void> {
        await dialog.showMessageBox({ type: 'info', message })
    }

    async showOpenDialog(options?: OpenDialogOptions): Promise<string[] | undefined> {
        const result = await dialog.showOpenDialog({
            properties: [
                options?.canSelectFiles ? 'openFile' : 'openFile', // default
                options?.canSelectFolders ? 'openDirectory' : '',
                options?.canSelectMany ? 'multiSelections' : '',
            ].filter(Boolean) as any,
            defaultPath: options?.defaultUri,
            filters: options?.filters
                ? Object.entries(options.filters).map(([name, extensions]) => ({ name, extensions }))
                : undefined,
        })
        return result.canceled ? undefined : result.filePaths
    }

    async showSaveDialog(options?: SaveDialogOptions): Promise<string | undefined> {
        const result = await dialog.showSaveDialog({
            defaultPath: options?.defaultUri,
            filters: options?.filters
                ? Object.entries(options.filters).map(([name, extensions]) => ({ name, extensions }))
                : undefined,
            buttonLabel: options?.saveLabel,
        })
        return result.canceled ? undefined : result.filePath
    }

    async openExternal(url: string): Promise<void> {
        await shell.openExternal(url)
    }

    async openFile(
        filePath: string,
        options?: { selection?: { startLine: number; endLine: number } }
    ): Promise<void> {
        // Best effort: open path. Selection not supported natively by shell.openPath
        // Maybe launch generic editor?
        await shell.openPath(filePath)
    }
}

export class ElectronWorkspace implements IWorkspace {
    private config: any = {}
    private configPath: string
    private _workspaceFolder: string

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json')
        this._workspaceFolder = os.homedir()
        this.loadConfig()
    }

    setWorkspaceFolder(folderPath: string) {
        this._workspaceFolder = folderPath
        this.config.lastWorkspaceFolder = folderPath
        void this.saveConfig()
    }

    private loadConfig() {
        try {
            if (fsSync.existsSync(this.configPath)) {
                const data = fsSync.readFileSync(this.configPath, 'utf-8')
                this.config = JSON.parse(data)
                if (this.config.lastWorkspaceFolder) {
                    this._workspaceFolder = this.config.lastWorkspaceFolder
                }
            }
        } catch {
            this.config = {}
        }
    }

    private async saveConfig() {
        try {
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2))
        } catch {}
    }

    get workspaceFolders(): readonly string[] {
        // Electron app doesn't have a "workspace" concept in the same way.
        // Return user home or empty?
        // Or allow opening a folder?
        // For now, return empty or a specific configured folder.
        return [this._workspaceFolder]
    }

    get globalStoragePath(): string {
        return app.getPath('userData')
    }

    getConfiguration<T>(section: string, defaultValue?: T): T {
        // Support nested keys logic?
        // Assuming section is dotted "nebulaFlow.storageScope"
        return (this.config[section] ?? defaultValue) as T
    }

    async updateConfiguration(section: string, value: any, target: ConfigurationTarget): Promise<void> {
        this.config[section] = value
        await this.saveConfig()
    }
}

export class ElectronClipboard implements IClipboard {
    async readText(): Promise<string> {
        return clipboard.readText()
    }

    async writeText(value: string): Promise<void> {
        clipboard.writeText(value)
    }
}

export class ElectronHost implements IHostEnvironment {
    readonly fs: IFileSystem
    readonly window: IWindow
    readonly workspace: IWorkspace
    readonly clipboard: IClipboard

    constructor() {
        this.fs = new ElectronFileSystem()
        this.window = new ElectronWindow()
        this.workspace = new ElectronWorkspace()
        this.clipboard = new ElectronClipboard()
    }
}

export class ElectronMessagePort implements IMessagePort {
    constructor(
        private readonly webContents: Electron.WebContents,
        private readonly ipcMain: Electron.IpcMain
    ) {}

    async postMessage(message: unknown): Promise<boolean> {
        if (this.webContents.isDestroyed()) return false
        this.webContents.send('webview-message', message)
        return true
    }

    onDidReceiveMessage(listener: (e: unknown) => any, thisArgs?: any, disposables?: any[]): any {
        const handler = (_event: any, message: any) => listener(message)
        this.ipcMain.on('webview-message', handler)
        return {
            dispose: () => {
                this.ipcMain.removeListener('webview-message', handler)
            },
        }
    }
}
