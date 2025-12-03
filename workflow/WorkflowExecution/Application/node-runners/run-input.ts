import type { WorkflowNode } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { evalTemplate } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export async function executeInputNode(
    node: WorkflowNode,
    context: IndexedExecutionContext
): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const template = ((node as any).data?.content || '').toString()
    const text = evalTemplate(template, inputs, context)
    return text.trim()
}
