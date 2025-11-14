import type { WorkflowNodes } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export async function executeLoopStartNode(
    node: WorkflowNodes,
    context: IndexedExecutionContext
): Promise<string> {
    const getInputsByHandle = (handleType: string) =>
        combineParentOutputsByConnectionOrder(node.id, {
            ...context,
            edgeIndex: {
                ...context.edgeIndex,
                byTarget: new Map([
                    [
                        node.id,
                        (context.edgeIndex.byTarget.get(node.id) || []).filter(
                            edge => edge.targetHandle === handleType
                        ),
                    ],
                ]),
            },
        })

    const mainInputs = getInputsByHandle('main')
    const iterationOverrides = getInputsByHandle('iterations-override')

    let loopState = context.loopStates.get(node.id)

    if (!loopState) {
        const maxIterations =
            iterationOverrides.length > 0
                ? Number.parseInt(iterationOverrides[0], 10) || (node as any).data.iterations
                : (node as any).data.iterations
        loopState = { currentIteration: 0, maxIterations, variable: (node as any).data.loopVariable }
        context.loopStates.set(node.id, loopState)
    } else if (loopState.currentIteration < loopState.maxIterations - 1) {
        context.loopStates.set(node.id, {
            ...loopState,
            currentIteration: loopState.currentIteration + 1,
        })
    }
    return mainInputs.join('\n')
}
