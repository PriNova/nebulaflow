/**
 * Platform-agnostic file system interface.
 * Mirrors a subset of vscode.FileSystem but with simplified types where appropriate.
 */
export interface IFileSystem {
    readFile(path: string): Promise<Uint8Array>
    writeFile(path: string, content: Uint8Array): Promise<void>
    createDirectory(path: string): Promise<void>
    readDirectory(path: string): Promise<[string, FileType][]>
    delete(path: string, options?: { recursive?: boolean }): Promise<void>
    exists(path: string): Promise<boolean>
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

/**
 * Platform-agnostic window/UI interface.
 */
export interface IWindow {
    showErrorMessage(message: string): Promise<void>
    showInformationMessage(message: string): Promise<void>
    showOpenDialog(options?: OpenDialogOptions): Promise<string[] | undefined>
    showSaveDialog(options?: SaveDialogOptions): Promise<string | undefined>
    openExternal(url: string): Promise<void>
    openFile(
        path: string,
        options?: { selection?: { startLine: number; endLine: number } }
    ): Promise<void>
}

export interface OpenDialogOptions {
    canSelectFiles?: boolean
    canSelectFolders?: boolean
    canSelectMany?: boolean
    defaultUri?: string
    filters?: { [name: string]: string[] }
}

export interface SaveDialogOptions {
    defaultUri?: string
    filters?: { [name: string]: string[] }
    saveLabel?: string
}

/**
 * Platform-agnostic workspace configuration and paths.
 */
export interface IWorkspace {
    readonly workspaceFolders: readonly string[]
    /**
     * The directory for global storage (e.g. user data).
     */
    readonly globalStoragePath: string

    /**
     * Read a configuration value.
     */
    getConfiguration<T>(section: string, defaultValue?: T): T

    updateConfiguration(section: string, value: any, target: ConfigurationTarget): Promise<void>
}

/**
 * Platform-agnostic clipboard.
 */
export interface IClipboard {
    readText(): Promise<string>
    writeText(value: string): Promise<void>
}

/**
 * The main host environment interface.
 */
export interface IHostEnvironment {
    readonly fs: IFileSystem
    readonly window: IWindow
    readonly workspace: IWorkspace
    readonly clipboard: IClipboard
}

/**
 * Abstract message port for communicating with the Webview/Renderer.
 */
export interface IMessagePort {
    postMessage(message: unknown): Promise<boolean>
    onDidReceiveMessage(listener: (e: unknown) => any, thisArgs?: any, disposables?: any[]): any
}
