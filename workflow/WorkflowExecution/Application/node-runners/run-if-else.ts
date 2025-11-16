import { type IfElseNode, NodeType, type WorkflowNode, type WorkflowNodes } from '../../../Core/models'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { getInactiveNodes } from '../../Core/execution/graph'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

export async function executeIfElseNode(
    context: IndexedExecutionContext,
    node: WorkflowNode | IfElseNode
): Promise<string> {
    let result = ''
    const parentEdges = context.edgeIndex.byTarget.get(node.id) || []
    let cliNode: WorkflowNodes | undefined
    let cliExitCode: string | undefined

    for (const edge of parentEdges) {
        const parentNode = context.nodeIndex.get(edge.source)
        if (parentNode?.type === NodeType.CLI) {
            cliNode = parentNode
            cliExitCode = context.cliMetadata?.get(parentNode.id)?.exitCode
            break
        }
    }

    let hasResult: boolean

    if (cliNode) {
        hasResult = cliExitCode === '0'
        result = context.nodeOutputs.get(cliNode.id) as string
    } else {
        const inputs = combineParentOutputsByConnectionOrder(node.id, context)
        const condition = node.data.content
            ? replaceIndexedInputs(node.data.content, inputs, context)
            : ''
        const [leftSide, operator, rightSide] = condition.trim().split(/\s+(==|!=)\s+/)
        hasResult = operator === '==' ? leftSide === rightSide : leftSide !== rightSide
        result = hasResult ? 'true' : 'false'
    }

    context.ifelseSkipPaths?.set(node.id, new Set<string>())
    const edges = context.edgeIndex.bySource.get(node.id) || []
    const nonTakenPath = edges.find(edge => edge.sourceHandle === (hasResult ? 'false' : 'true'))
    if (nonTakenPath) {
        if (!context.ifelseSkipPaths) {
            context.ifelseSkipPaths = new Map<string, Set<string>>()
        }
        let skipNodes = context.ifelseSkipPaths?.get(node.id)
        skipNodes = new Set<string>()
        context.ifelseSkipPaths?.set(node.id, skipNodes)
        const allEdges = Array.from(context.edgeIndex.byId.values())
        const nodesToSkip = getInactiveNodes(allEdges, nonTakenPath.target)
        for (const nodeId of nodesToSkip) {
            skipNodes.add(nodeId)
        }
    }
    return result
}
