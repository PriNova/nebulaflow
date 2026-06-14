/**
 * Browser-side IMessagePort over a WebSocket connection to the bridge server.
 *
 * Intercepts bridge:* protocol messages (UI operations like alerts,
 * clipboard, file dialogs) and handles them locally. All other messages
 * (the standard WorkflowToExtension / ExtensionToWorkflow protocol) are
 * forwarded to registered listeners unchanged.
 */
import type { IMessagePort } from '../workflow/Shared/Host/index.js'

export class WebSocketMessagePort implements IMessagePort {
    private ws: WebSocket | null = null
    private readonly listeners: Array<(e: unknown) => any> = []
    private readonly pending: unknown[] = []
    private readonly url: string

    constructor(url = 'ws://localhost:8148') {
        this.url = url
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url)
            this.ws.onopen = () => {
                for (const msg of this.pending) {
                    this.ws!.send(JSON.stringify(msg))
                }
                this.pending.length = 0
                resolve()
            }
            this.ws.onmessage = event => {
                let data: any
                try {
                    data = JSON.parse(event.data)
                } catch {
                    return
                }
                // Bridge messages are handled locally, not forwarded
                if (this.handleBridgeMessage(data)) return
                // Protocol messages go to registered listeners
                for (const listener of this.listeners) {
                    listener(data)
                }
            }
            this.ws.onerror = () =>
                reject(new Error('WebSocket connection failed'))
            this.ws.onclose = () => {
                // Could auto-reconnect here in a future version
            }
        })
    }

    async postMessage(message: unknown): Promise<boolean> {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message))
        } else {
            this.pending.push(message)
        }
        return true
    }

    onDidReceiveMessage(listener: (e: unknown) => any): {
        dispose: () => void
    } {
        this.listeners.push(listener)
        return {
            dispose: () => {
                const idx = this.listeners.indexOf(listener)
                if (idx >= 0) this.listeners.splice(idx, 1)
            },
        }
    }

    // ------------------------------------------------------------------
    // Bridge protocol handler — intercepts UI operation messages
    // ------------------------------------------------------------------

    private handleBridgeMessage(msg: any): boolean {
        switch (msg?.type) {
            case 'bridge:show_error':
                alert(`Error: ${msg.message}`)
                return true

            case 'bridge:show_info':
                alert(msg.message)
                return true

            case 'bridge:open_external':
                window.open(msg.url, '_blank')
                return true

            case 'bridge:show_open_dialog': {
                this.showOpenDialog(msg).then(
                    paths =>
                        this.ws?.send(
                            JSON.stringify({
                                type: 'bridge:dialog_result',
                                requestId: msg.requestId,
                                paths,
                                cancelled: paths === undefined,
                            })
                        ),
                    () =>
                        this.ws?.send(
                            JSON.stringify({
                                type: 'bridge:dialog_result',
                                requestId: msg.requestId,
                                cancelled: true,
                            })
                        )
                )
                return true
            }

            case 'bridge:show_save_dialog': {
                this.showSaveDialog(msg).then(
                    path =>
                        this.ws?.send(
                            JSON.stringify({
                                type: 'bridge:dialog_result',
                                requestId: msg.requestId,
                                path,
                                cancelled: path === undefined,
                            })
                        ),
                    () =>
                        this.ws?.send(
                            JSON.stringify({
                                type: 'bridge:dialog_result',
                                requestId: msg.requestId,
                                cancelled: true,
                            })
                        )
                )
                return true
            }

            case 'bridge:clipboard_write':
                navigator.clipboard.writeText(msg.text).catch(() => {})
                return true

            case 'bridge:clipboard_read':
                navigator.clipboard
                    .readText()
                    .then(text =>
                        this.ws?.send(
                            JSON.stringify({
                                type: 'bridge:clipboard_result',
                                requestId: msg.requestId,
                                text,
                            })
                        )
                    )
                    .catch(() =>
                        this.ws?.send(
                            JSON.stringify({
                                type: 'bridge:clipboard_result',
                                requestId: msg.requestId,
                                text: '',
                            })
                        )
                    )
                return true

            default:
                return false
        }
    }

    // ------------------------------------------------------------------
    // File dialog helpers
    // ------------------------------------------------------------------

    private async showOpenDialog(msg: any): Promise<string[] | undefined> {
        // Try File System Access API first
        if ('showOpenFilePicker' in window) {
            try {
                const handles = await window.showOpenFilePicker({
                    multiple: msg.canSelectMany ?? false,
                })
                // We can only return names — actual paths are not available
                // from the browser security model. The server will use the
                // default path when this returns.
                return handles.map((h: FileSystemFileHandle) => h.name)
            } catch {
                // User cancelled
                return undefined
            }
        }
        // Fallback: <input type="file">
        return new Promise(resolve => {
            const input = document.createElement('input')
            input.type = 'file'
            input.multiple = msg.canSelectMany ?? false
            input.onchange = () => {
                const names = Array.from(input.files ?? []).map(
                    f => f.name
                )
                resolve(names.length > 0 ? names : undefined)
                input.remove()
            }
            input.oncancel = () => {
                resolve(undefined)
                input.remove()
            }
            input.click()
        })
    }

    private async showSaveDialog(msg: any): Promise<string | undefined> {
        // Try File System Access API
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: msg.defaultUri
                        ?.split('/')
                        .pop(),
                })
                return handle.name
            } catch {
                return undefined
            }
        }
        // Fallback: prompt for filename
        const name = prompt(
            'Save as:',
            msg.defaultUri?.split('/').pop() ?? 'workflow.json'
        )
        return name ?? undefined
    }
}
