import type { WorkflowNodes } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export function executeLoopEndNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext
): string {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)
    return inputs.join('\n')
}
