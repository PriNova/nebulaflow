import type * as vscode from 'vscode'
import type { ExtensionToWorkflow } from '../../../Core/models'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export async function executePreviewNode(
    nodeId: string,
    webview: vscode.Webview,
    context: IndexedExecutionContext
): Promise<string> {
    const input = combineParentOutputsByConnectionOrder(nodeId, context).join('\n')
    const processedInput = replaceIndexedInputs(input, [], context)
    const trimmedInput = processedInput.trim()
    const tokenCount = trimmedInput.length
    await safePost(webview, {
        type: 'token_count',
        data: { nodeId, count: tokenCount },
    } as ExtensionToWorkflow)
    return trimmedInput
}
