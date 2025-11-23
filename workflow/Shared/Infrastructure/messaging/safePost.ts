import { isExtensionToWorkflow } from '../../../Core/Contracts/guards'
import type { ExtensionToWorkflow } from '../../../Core/models'
import type { IMessagePort } from '../../Host/index'

/**
 * Post a message to a webview (or generic port) with strict runtime validation and
 * graceful handling when the target has been disposed.
 */
export async function safePost(
    port: IMessagePort,
    msg: ExtensionToWorkflow,
    opts?: { strict?: boolean }
): Promise<void> {
    // Validate outbound message shape
    if (!isExtensionToWorkflow(msg)) {
        if (opts?.strict) {
            throw new Error(
                `Invalid ExtensionToWorkflow message: ${JSON.stringify({ type: (msg as any)?.type })}`
            )
        }
        console.warn('Dropped invalid message', msg)
        return
    }

    // Attempt delivery; swallow errors if the port/webview was disposed during delivery
    try {
        const delivered = await port.postMessage(msg)
        if (!delivered) {
            // VS Code returns false when the webview is no longer able to receive
            // messages (e.g., disposed). Treat as a no-op.
            return
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        // Be tolerant: do not surface runtime errors when the target is gone.
        // Use regex to detect disposed webview across VS Code versions (locale/version tolerant).
        if (/webview\s+is\s+disposed/i.test(message || '')) {
            return
        }
        // For other unexpected errors, avoid crashing the extension process.
        // Log once in development, remain silent otherwise for robustness.
        if (opts?.strict) {
            console.warn('[safePost] postMessage failed:', message)
        }
        // Do not rethrow to keep extension resilient.
        return
    }
}
