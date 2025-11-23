import * as vscode from 'vscode'
import type {
    ConfigurationTarget,
    FileType,
    IClipboard,
    IFileSystem,
    IHostEnvironment,
    IMessagePort,
    IWindow,
    IWorkspace,
    OpenDialogOptions,
    SaveDialogOptions,
} from './index'

export class VSCodeFileSystem implements IFileSystem {
    async readFile(path: string): Promise<Uint8Array> {
        return await vscode.workspace.fs.readFile(vscode.Uri.file(path))
    }

    async writeFile(path: string, content: Uint8Array): Promise<void> {
        return await vscode.workspace.fs.writeFile(vscode.Uri.file(path), content)
    }

    async createDirectory(path: string): Promise<void> {
        return await vscode.workspace.fs.createDirectory(vscode.Uri.file(path))
    }

    async readDirectory(path: string): Promise<[string, FileType][]> {
        const result = await vscode.workspace.fs.readDirectory(vscode.Uri.file(path))
        return result.map(([name, type]) => [name, type as unknown as FileType])
    }

    async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
        return await vscode.workspace.fs.delete(vscode.Uri.file(path), options)
    }

    async exists(path: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(path))
            return true
        } catch {
            return false
        }
    }
}

export class VSCodeWindow implements IWindow {
    async showErrorMessage(message: string): Promise<void> {
        void vscode.window.showErrorMessage(message)
    }

    async showInformationMessage(message: string): Promise<void> {
        void vscode.window.showInformationMessage(message)
    }

    async showOpenDialog(options?: OpenDialogOptions): Promise<string[] | undefined> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: options?.canSelectFiles,
            canSelectFolders: options?.canSelectFolders,
            canSelectMany: options?.canSelectMany,
            defaultUri: options?.defaultUri ? vscode.Uri.file(options.defaultUri) : undefined,
            filters: options?.filters,
        })
        return uris?.map(u => u.fsPath)
    }

    async showSaveDialog(options?: SaveDialogOptions): Promise<string | undefined> {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: options?.defaultUri ? vscode.Uri.file(options.defaultUri) : undefined,
            filters: options?.filters,
            saveLabel: options?.saveLabel,
        })
        return uri?.fsPath
    }

    async openExternal(url: string): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse(url))
    }

    async openFile(
        path: string,
        options?: { selection?: { startLine: number; endLine: number } }
    ): Promise<void> {
        const uri = vscode.Uri.file(path)
        const doc = await vscode.workspace.openTextDocument(uri)
        const editor = await vscode.window.showTextDocument(doc)
        if (options?.selection) {
            const start = new vscode.Position(options.selection.startLine, 0)
            const end = new vscode.Position(options.selection.endLine, 0)
            const range = new vscode.Range(start, end)
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter)
            editor.selection = new vscode.Selection(start, start)
        }
    }
}

export class VSCodeWorkspace implements IWorkspace {
    constructor(private readonly context: vscode.ExtensionContext) {}

    get workspaceFolders(): readonly string[] {
        return vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? []
    }

    get globalStoragePath(): string {
        return this.context.globalStorageUri.fsPath
    }

    getConfiguration<T>(section: string, defaultValue?: T): T {
        const config = vscode.workspace.getConfiguration()
        return config.get<T>(section, defaultValue as T)
    }

    async updateConfiguration(section: string, value: any, target: ConfigurationTarget): Promise<void> {
        const config = vscode.workspace.getConfiguration()
        await config.update(section, value, target)
    }
}

export class VSCodeClipboard implements IClipboard {
    async readText(): Promise<string> {
        return await vscode.env.clipboard.readText()
    }

    async writeText(value: string): Promise<void> {
        await vscode.env.clipboard.writeText(value)
    }
}

export class VSCodeHost implements IHostEnvironment {
    readonly fs: IFileSystem
    readonly window: IWindow
    readonly workspace: IWorkspace
    readonly clipboard: IClipboard

    constructor(context: vscode.ExtensionContext) {
        this.fs = new VSCodeFileSystem()
        this.window = new VSCodeWindow()
        this.workspace = new VSCodeWorkspace(context)
        this.clipboard = new VSCodeClipboard()
    }
}

export class VSCodeMessagePort implements IMessagePort {
    constructor(private readonly webview: vscode.Webview) {}

    async postMessage(message: unknown): Promise<boolean> {
        return await this.webview.postMessage(message)
    }

    onDidReceiveMessage(listener: (e: unknown) => any, thisArgs?: any, disposables?: any[]): any {
        return this.webview.onDidReceiveMessage(listener, thisArgs, disposables)
    }
}
