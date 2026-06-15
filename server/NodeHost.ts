/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
    FileType,
    type IClipboard,
    type IFileSystem,
    type IHostEnvironment,
    type IMessagePort,
    type IWindow,
    type IWorkspace,
    type OpenDialogOptions,
    type SaveDialogOptions,
} from '../workflow/Shared/Host/index.js'

// ---------------------------------------------------------------------------
// NodeFileSystem — real filesystem via node:fs/promises
// ---------------------------------------------------------------------------

class NodeFileSystem implements IFileSystem {
    async readFile(p: string): Promise<Uint8Array> {
        return await fs.readFile(p)
    }

    async writeFile(p: string, content: Uint8Array): Promise<void> {
        await fs.mkdir(path.dirname(p), { recursive: true })
        await fs.writeFile(p, content)
    }

    async createDirectory(p: string): Promise<void> {
        await fs.mkdir(p, { recursive: true })
    }

    async readDirectory(p: string): Promise<[string, FileType][]> {
        const entries = await fs.readdir(p, { withFileTypes: true })
        return entries.map(e => [
            e.name,
            e.isDirectory()
                ? FileType.Directory
                : e.isSymbolicLink()
                  ? FileType.SymbolicLink
                  : FileType.File,
        ])
    }

    async delete(p: string, opts?: { recursive?: boolean }): Promise<void> {
        await fs.rm(p, { recursive: opts?.recursive, force: true })
    }

    async exists(p: string): Promise<boolean> {
        try {
            await fs.access(p)
            return true
        } catch {
            return false
        }
    }
}

// ---------------------------------------------------------------------------
// NodeWindow — headless window with optional bridge to browser
// ---------------------------------------------------------------------------

type PendingRequest = {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
}

class NodeWindow implements IWindow {
    private port: IMessagePort | null = null
    private readonly pending = new Map<string, PendingRequest>()

    /** Wire the message port so UI requests can be forwarded to the browser. */
    setPort(port: IMessagePort): void {
        this.port = port
        if (!port) return
        port.onDidReceiveMessage((msg: any) => {
            switch (msg?.type) {
                case 'bridge:dialog_result': {
                    const req = this.pending.get(msg.requestId)
                    if (req) {
                        clearTimeout(req.timer)
                        this.pending.delete(msg.requestId)
                        if (msg.cancelled) {
                            req.resolve(undefined)
                        } else {
                            req.resolve(
                                msg.paths ??
                                    (msg.path ? [msg.path] : undefined)
                            )
                        }
                    }
                    break
                }
                case 'bridge:clipboard_result': {
                    const req = this.pending.get(msg.requestId)
                    if (req) {
                        clearTimeout(req.timer)
                        this.pending.delete(msg.requestId)
                        req.resolve(msg.text)
                    }
                    break
                }
            }
        })
    }

    private async request<T>(
        message: Record<string, unknown>,
        timeoutMs = 30_000
    ): Promise<T | undefined> {
        if (!this.port) return undefined
        const requestId = crypto.randomUUID()
        return new Promise<T | undefined>(resolve => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId)
                resolve(undefined)
            }, timeoutMs)
            this.pending.set(requestId, {
                resolve,
                reject: () => {},
                timer,
            })
            this.port!.postMessage({ ...message, requestId })
        })
    }

    // -- fire-and-forget messages (no response needed) --

    async showErrorMessage(message: string): Promise<void> {
        if (this.port) {
            await this.port.postMessage({
                type: 'bridge:show_error',
                message,
            })
        } else {
            console.error('[nebulaflow-web]', message)
        }
    }

    async showInformationMessage(message: string): Promise<void> {
        if (this.port) {
            await this.port.postMessage({
                type: 'bridge:show_info',
                message,
            })
        } else {
            console.log('[nebulaflow-web]', message)
        }
    }

    async openExternal(url: string): Promise<void> {
        if (this.port) {
            await this.port.postMessage({ type: 'bridge:open_external', url })
        } else {
            console.log('[open]', url)
        }
    }

    async openFile(
        _p: string,
        _opts?: { selection?: { startLine: number; endLine: number } }
    ): Promise<void> {
        // No text editor in browser context; silently no-op.
    }

    // -- request-response messages (browser must reply) --

    async showOpenDialog(
        opts?: OpenDialogOptions
    ): Promise<string[] | undefined> {
        if (!this.port) return undefined
        const result = await this.request<string[] | undefined>(
            {
                type: 'bridge:show_open_dialog',
                defaultUri: opts?.defaultUri,
                canSelectMany: opts?.canSelectMany ?? false,
                filters: opts?.filters,
            },
            60_000
        )
        return result
    }

    async showSaveDialog(
        opts?: SaveDialogOptions
    ): Promise<string | undefined> {
        if (!this.port) return undefined
        const result = await this.request<string[] | undefined>(
            {
                type: 'bridge:show_save_dialog',
                defaultUri: opts?.defaultUri,
                filters: opts?.filters,
                saveLabel: opts?.saveLabel,
            },
            60_000
        )
        return result?.[0]
    }
}

// ---------------------------------------------------------------------------
// NodeWorkspace
// ---------------------------------------------------------------------------

class NodeWorkspace implements IWorkspace {
    workspaceFolders: readonly string[] = [process.cwd()]

    get globalStoragePath(): string {
        return path.join(os.homedir(), '.nebulaflow')
    }

    getConfiguration<T>(section: string, defaultValue?: T): T {
        return defaultValue as T
    }

    async updateConfiguration(): Promise<void> {
        // Configuration is not persisted in headless mode.
        // The browser can manage its own settings separately.
    }
}

// ---------------------------------------------------------------------------
// NodeClipboard — bridged via browser
// ---------------------------------------------------------------------------

class NodeClipboard implements IClipboard {
    constructor(private readonly window: NodeWindow) {}

    async readText(): Promise<string> {
        const text = await this.window.request<string>(
            { type: 'bridge:clipboard_read' },
            10_000
        )
        return text ?? ''
    }

    async writeText(value: string): Promise<void> {
        if (this.window.port) {
            await this.window.port.postMessage({
                type: 'bridge:clipboard_write',
                text: value,
            })
        }
    }
}

// ---------------------------------------------------------------------------
// NodeHost — composite IHostEnvironment
// ---------------------------------------------------------------------------

export class NodeHost implements IHostEnvironment {
    readonly fs = new NodeFileSystem()
    readonly window: NodeWindow
    readonly workspace = new NodeWorkspace()
    readonly clipboard: IClipboard

    constructor() {
        this.window = new NodeWindow()
        this.clipboard = new NodeClipboard(this.window)
    }

    /** Must be called after a WebSocket connection is established. */
    setPort(port: IMessagePort): void {
        this.window.setPort(port)
    }
}
