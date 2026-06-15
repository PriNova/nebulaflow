import type { WorkflowNode } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { evalTemplate } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export function executeInputNode(
    node: WorkflowNode,
    context: IndexedExecutionContext
): string {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    const template = node.data.content || ''
    const text = evalTemplate(template, inputs, context)
    return text.trim()
}
