import type { ExtensionToWorkflow } from '../../../Core/models'
import type { IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { evalTemplate } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export async function executePreviewNode(
    nodeId: string,
    port: IMessagePort,
    context: IndexedExecutionContext
): Promise<string> {
    const input = combineParentOutputsByConnectionOrder(nodeId, context).join('\n')
    const processedInput = evalTemplate(input, [], context)
    const trimmedInput = processedInput.trim()
    const tokenCount = trimmedInput.length
    await safePost(port, {
        type: 'token_count',
        data: { nodeId, count: tokenCount },
    } as ExtensionToWorkflow)
    return trimmedInput
}
