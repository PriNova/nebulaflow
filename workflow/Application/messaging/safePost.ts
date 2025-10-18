import type * as vscode from 'vscode'
import { isExtensionToWorkflow } from '../../Core/Contracts/guards'
import type { ExtensionToWorkflow } from '../../Core/models'

export async function safePost(
    webview: vscode.Webview,
    msg: ExtensionToWorkflow,
    opts?: { strict?: boolean }
): Promise<void> {
    if (!isExtensionToWorkflow(msg)) {
        if (opts?.strict) {
            throw new Error(
                `Invalid ExtensionToWorkflow message: ${JSON.stringify({ type: (msg as any)?.type })}`
            )
        }
        console.warn('Dropped invalid message', msg)
        return
    }
    await webview.postMessage(msg)
}
