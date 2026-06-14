import type { IMessagePort } from '../workflow/Shared/Host/index.js'
import type { WebSocket } from 'ws'

/**
 * Server-side IMessagePort over a single WebSocket connection.
 * Used by the bridge server to tunnel NebulaFlow's typed message
 * protocol between the browser webview and the Node.js backend.
 */
export class WebSocketPort implements IMessagePort {
    constructor(private readonly ws: WebSocket) {}

    async postMessage(message: unknown): Promise<boolean> {
        return new Promise(resolve => {
            const payload = JSON.stringify(message)
            this.ws.send(payload, err => {
                resolve(!err)
            })
        })
    }

    onDidReceiveMessage(
        listener: (e: unknown) => any
    ): { dispose: () => void } {
        const handler = (data: string) => {
            try {
                listener(JSON.parse(data))
            } catch {
                // Ignore malformed JSON
            }
        }
        this.ws.on('message', handler)
        return {
            dispose: () => this.ws.off('message', handler),
        }
    }
}
