import type { WorkflowNode } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export async function executeInputNode(
    node: WorkflowNode,
    context: IndexedExecutionContext
): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const text = node.data.content ? replaceIndexedInputs(node.data.content, inputs, context) : ''
    return text.trim()
}
