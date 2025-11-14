import { NodeType, type WorkflowNodes } from '../../../Core/models'
import type { Edge } from '../../../Core/models'

interface IndexedOrder {
    bySourceTarget: Map<string, number>
    byTarget: Map<string, Edge[]>
}

function getNodesConnectedByDirection(
    nodeId: string,
    nodes: WorkflowNodes[],
    edges: Edge[],
    direction: 'child' | 'parent'
): WorkflowNodes[] {
    const isSourceDirection = direction === 'child'
    return edges
        .filter(edge => (isSourceDirection ? edge.source === nodeId : edge.target === nodeId))
        .map(edge => nodes.find(node => node.id === (isSourceDirection ? edge.target : edge.source))!)
        .filter(Boolean) as WorkflowNodes[]
}

function getChildNodesFrom(
    sourceNodeId: string,
    nodes: WorkflowNodes[],
    edges: Edge[]
): WorkflowNodes[] {
    return getNodesConnectedByDirection(sourceNodeId, nodes, edges, 'child')
}

function getParentNodesFrom(
    targetNodeId: string,
    nodes: WorkflowNodes[],
    edges: Edge[]
): WorkflowNodes[] {
    return getNodesConnectedByDirection(targetNodeId, nodes, edges, 'parent')
}

function filterEdgesForNodeSet(edges: Edge[], nodeIds: Set<string>): Edge[] {
    return edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
}

const getNodePriority = (node: WorkflowNodes, edgeIndex: IndexedOrder, activeEdges: Edge[]): number => {
    let minOrder = Number.POSITIVE_INFINITY
    for (const edge of activeEdges) {
        if (edge.source === node.id) {
            const key = `${edge.source}-${edge.target}`
            const order = edgeIndex.bySourceTarget.get(key) || Number.POSITIVE_INFINITY
            minOrder = Math.min(minOrder, order)
        }
    }
    return minOrder
}

function kahnSortbyOrderedEdges(activeNodes: WorkflowNodes[], activeEdges: Edge[]): WorkflowNodes[] {
    const edgeIndex: IndexedOrder = (() => {
        const bySourceTarget = new Map<string, number>()
        const byTarget = new Map<string, Edge[]>()

        if (!activeEdges) return { bySourceTarget, byTarget }

        for (const edge of activeEdges) {
            const targetEdges = byTarget.get(edge.target) || []
            targetEdges.push(edge)
            byTarget.set(edge.target, targetEdges)
        }

        for (const [targetId, targetEdges] of byTarget) {
            targetEdges.forEach((edge, index) => {
                const key = `${edge.source}-${targetId}`
                bySourceTarget.set(key, index + 1)
            })
        }

        return { bySourceTarget, byTarget }
    })()

    const inDegree = new Map<string, number>()
    const processedNodes = new Set<string>()

    for (const node of activeNodes) {
        inDegree.set(node.id, 0)
    }
    for (const edge of activeEdges) {
        const currentDegree = inDegree.get(edge.target) || 0
        inDegree.set(edge.target, currentDegree + 1)
    }
    const queue: WorkflowNodes[] = activeNodes.filter(node => inDegree.get(node.id) === 0)
    queue.sort(
        (a, b) => getNodePriority(a, edgeIndex, activeEdges) - getNodePriority(b, edgeIndex, activeEdges)
    )

    const sortedNodes: WorkflowNodes[] = []

    while (sortedNodes.length < activeNodes.length) {
        if (queue.length === 0) {
            const remainingNodes = activeNodes.filter(node => !processedNodes.has(node.id))
            const minDegreeNode = remainingNodes.reduce((min, node) => {
                const degree = inDegree.get(node.id) || 0
                const minDegree = inDegree.get(min.id) || 0
                return degree < minDegree ? node : min
            }, remainingNodes[0])
            if (minDegreeNode) {
                queue.push(minDegreeNode)
            }
        }

        const currentNode = queue.shift()!
        processedNodes.add(currentNode.id)
        sortedNodes.push(currentNode)

        for (const edge of activeEdges) {
            if (edge.source === currentNode.id) {
                const targetNode = activeNodes.find(node => node.id === edge.target)
                if (targetNode && !processedNodes.has(targetNode.id)) {
                    const newDegree = (inDegree.get(targetNode.id) || 0) - 1
                    inDegree.set(targetNode.id, newDegree)
                    if (newDegree === 0) {
                        queue.push(targetNode)
                    }
                }
            }
        }

        queue.sort(
            (a, b) =>
                getNodePriority(a, edgeIndex, activeEdges) - getNodePriority(b, edgeIndex, activeEdges)
        )
    }
    return sortedNodes
}

function findPreLoopNodes(
    loopStart: WorkflowNodes,
    nodes: WorkflowNodes[],
    edges: Edge[]
): WorkflowNodes[] {
    const preLoopNodes = new Set<WorkflowNodes>()

    function explorePreLoopNodes(node: WorkflowNodes): void {
        if (
            node.type === NodeType.LOOP_START ||
            node.type === NodeType.LOOP_END ||
            preLoopNodes.has(node)
        ) {
            return
        }
        preLoopNodes.add(node)

        const parentNodes = getParentNodesFrom(node.id, nodes, edges)
        for (const parentNode of parentNodes) {
            explorePreLoopNodes(parentNode)
        }

        const childNodes = getChildNodesFrom(node.id, nodes, edges)
        for (const childNode of childNodes) {
            explorePreLoopNodes(childNode)
        }
    }

    const directParentsOfLoopStart = getParentNodesFrom(loopStart.id, nodes, edges)
    for (const parentNode of directParentsOfLoopStart) {
        explorePreLoopNodes(parentNode)
    }

    const preLoopNodeArray = [...preLoopNodes]
    const preLoopEdges = filterEdgesForNodeSet(edges, new Set(preLoopNodeArray.map(n => n.id)))
    return kahnSortbyOrderedEdges(preLoopNodeArray, preLoopEdges)
}

function findLoopNodes(
    loopStart: WorkflowNodes,
    nodes: WorkflowNodes[],
    edges: Edge[],
    preLoopNodes: Set<string>
): WorkflowNodes[] {
    const loopNodes = new Set<WorkflowNodes>()
    const loopQueue = [loopStart]

    while (loopQueue.length > 0) {
        const currentNode = loopQueue.pop()!

        const childNodes = getChildNodesFrom(currentNode.id, nodes, edges)
        for (const childNode of childNodes) {
            if (
                childNode &&
                childNode.type !== NodeType.LOOP_END &&
                !loopNodes.has(childNode) &&
                !preLoopNodes.has(childNode.id)
            ) {
                loopNodes.add(childNode)
                loopQueue.push(childNode)
            }
        }

        const parentNodes = getParentNodesFrom(currentNode.id, nodes, edges)
        for (const parentNode of parentNodes) {
            if (
                parentNode &&
                parentNode.type !== NodeType.LOOP_START &&
                !loopNodes.has(parentNode) &&
                !preLoopNodes.has(parentNode.id)
            ) {
                loopNodes.add(parentNode)
                loopQueue.push(parentNode)
            }
        }
    }

    const loopNodeIds = new Set([...loopNodes].map(n => n.id))
    const loopEdges = filterEdgesForNodeSet(edges, loopNodeIds)
    const kahnSortedLoopNodes = kahnSortbyOrderedEdges([...loopNodes], loopEdges)
    return kahnSortedLoopNodes
}

function findPostLoopNodes(
    loopEnd: WorkflowNodes,
    nodes: WorkflowNodes[],
    edges: Edge[]
): WorkflowNodes[] {
    const postLoopNodes = new Set<WorkflowNodes>()
    const postLoopQueue = [loopEnd]

    while (postLoopQueue.length > 0) {
        const currentNode = postLoopQueue.pop()!
        const childNodes = getChildNodesFrom(currentNode.id, nodes, edges)
        const parentNodes = getParentNodesFrom(currentNode.id, nodes, edges)

        for (const childNode of childNodes) {
            if (
                childNode &&
                childNode.type !== NodeType.LOOP_END &&
                !postLoopNodes.has(childNode) &&
                childNode.type !== NodeType.LOOP_START
            ) {
                postLoopNodes.add(childNode)
                postLoopQueue.push(childNode)
            }
        }
        for (const parentNode of parentNodes) {
            if (
                parentNode &&
                parentNode.type !== NodeType.LOOP_END &&
                !postLoopNodes.has(parentNode) &&
                parentNode.type !== NodeType.LOOP_START
            ) {
                postLoopNodes.add(parentNode)
                postLoopQueue.push(parentNode)
            }
        }
    }

    const postLoopNodeIds = new Set([...postLoopNodes].map(n => n.id))
    const postLoopEdges = filterEdgesForNodeSet(edges, postLoopNodeIds)
    return kahnSortbyOrderedEdges([...postLoopNodes], postLoopEdges)
}

type GraphCompositionMode = 'execution' | 'display'

export function processGraphComposition(
    nodes: WorkflowNodes[],
    edges: Edge[],
    shouldIterateLoops = true,
    options?: { mode?: GraphCompositionMode }
): WorkflowNodes[] {
    const mode: GraphCompositionMode = options?.mode ?? 'execution'

    const processedNodes = nodes.map(node => ({ ...node, data: { ...node.data } }))

    const nodeSet =
        mode === 'execution' ? processedNodes.filter(n => n.data.active !== false) : processedNodes
    const nodeIdSet = new Set(nodeSet.map(n => n.id))
    const edgeSet = filterEdgesForNodeSet(edges, nodeIdSet)

    const loopStartNodes = nodeSet.filter(node => node.type === NodeType.LOOP_START)

    if (loopStartNodes.some(n => n.type === NodeType.LOOP_START)) {
        return processLoopWithCycles(nodeSet, edgeSet, shouldIterateLoops)
    }
    if (loopStartNodes.length === 0) {
        const subgraphComponents = findStronglyConnectedComponents(nodeSet, edgeSet)
        const flatSubs = subgraphComponents.flatMap(components => components)
        return kahnSortbyOrderedEdges(flatSubs, edgeSet)
    }

    return nodeSet
}

interface NodeState {
    index: number
    lowLink: number
    onStack: boolean
}

function initializeNodeState(): NodeState {
    return { index: -1, lowLink: -1, onStack: false }
}

function findStronglyConnectedComponents(nodes: WorkflowNodes[], edges: Edge[]): WorkflowNodes[][] {
    const nodeStates = new Map<string, NodeState>()
    const stack: WorkflowNodes[] = []
    const components: WorkflowNodes[][] = []
    let index = 0

    function strongConnect(node: WorkflowNodes) {
        const state = initializeNodeState()
        state.index = index
        state.lowLink = index
        index += 1
        stack.push(node)
        state.onStack = true
        nodeStates.set(node.id, state)

        const children = getChildNodesFrom(node.id, nodes, edges).filter(
            node => !(node.type === NodeType.LOOP_START || node.type === NodeType.LOOP_END)
        )
        for (const child of children) {
            const childState = nodeStates.get(child.id)
            if (!childState) {
                strongConnect(child)
                const newChildState = nodeStates.get(child.id)!
                const currentState = nodeStates.get(node.id)!
                currentState.lowLink = Math.min(currentState.lowLink, newChildState.lowLink)
            } else if (childState.onStack) {
                const currentState = nodeStates.get(node.id)!
                currentState.lowLink = Math.min(currentState.lowLink, childState.index)
            }
        }

        const currentState = nodeStates.get(node.id)!
        if (currentState.lowLink === currentState.index) {
            const component: WorkflowNodes[] = []
            let w: WorkflowNodes
            do {
                w = stack.pop()!
                nodeStates.get(w.id)!.onStack = false
                component.push(w)
            } while (w.id !== node.id)
            if (component.some(n => !(n.type === NodeType.LOOP_START || n.type === NodeType.LOOP_END))) {
                components.push(component)
            }
        }
    }

    for (const node of nodes) {
        if (!nodeStates.has(node.id)) {
            strongConnect(node)
        }
    }
    return components
}

function findRelatedNodeOfType(
    startNode: WorkflowNodes,
    nodes: WorkflowNodes[],
    edges: Edge[],
    targetNodeType: NodeType,
    traversalDirection: 'source' | 'target',
    avoidNodeType?: NodeType
): WorkflowNodes | undefined {
    const visited = new Set<string>()
    const stack: WorkflowNodes[] = [startNode]
    const getConnectionNodes = traversalDirection === 'source' ? getChildNodesFrom : getParentNodesFrom

    while (stack.length > 0) {
        const currentNode = stack.pop()!
        if (visited.has(currentNode.id)) {
            continue
        }
        visited.add(currentNode.id)
        if (currentNode.type === targetNodeType) {
            return currentNode
        }
        if (avoidNodeType && currentNode.type === avoidNodeType && currentNode.id !== startNode.id) {
            continue
        }
        const relatedNodes = getConnectionNodes(currentNode.id, nodes, edges)
        for (const relatedNode of relatedNodes) {
            if (!visited.has(relatedNode.id)) {
                stack.push(relatedNode)
            }
        }
    }
    return undefined
}

function findLoopEndForLoopStart(
    loopStart: WorkflowNodes,
    nodes: WorkflowNodes[],
    edges: Edge[]
): WorkflowNodes | undefined {
    return findRelatedNodeOfType(
        loopStart,
        nodes,
        edges,
        NodeType.LOOP_END,
        'source',
        NodeType.LOOP_START
    )
}

function processLoopWithCycles(
    nodes: WorkflowNodes[],
    edges: Edge[],
    shouldIterateLoops = true
): WorkflowNodes[] {
    const processedNodes: WorkflowNodes[] = []
    const loopStartNodes = nodes.filter(n => n.type === NodeType.LOOP_START)

    for (const loopStart of loopStartNodes) {
        const preLoopNodes = findPreLoopNodes(loopStart, nodes, edges)
        for (const node of preLoopNodes) {
            if (!processedNodes.some(processedNode => processedNode.id === node.id)) {
                processedNodes.push(node)
            }
        }

        const loopEnd = findLoopEndForLoopStart(loopStart, nodes, edges)
        const postLoopNodes = loopEnd ? findPostLoopNodes(loopEnd, nodes, edges) : []
        const preLoopNodeIds = new Set(preLoopNodes.map(node => node.id))
        const nodesInsideLoop = findLoopNodes(loopStart, nodes, edges, preLoopNodeIds)

        const iterations = getLoopIterations(loopStart, nodes, edges, shouldIterateLoops)

        for (let i = 0; i < iterations; i++) {
            processedNodes.push({ ...loopStart })
            for (const node of nodesInsideLoop) {
                processedNodes.push({ ...node })
            }
            if (loopEnd) {
                processedNodes.push({ ...loopEnd })
            }
        }

        if (postLoopNodes.length > 0) {
            for (const node of postLoopNodes) {
                if (!processedNodes.some(processedNode => processedNode.id === node.id)) {
                    processedNodes.push({ ...node })
                }
            }
        }
    }

    return processedNodes
}

function getLoopIterations(
    loopStart: WorkflowNodes,
    nodes: WorkflowNodes[],
    edges: Edge[],
    shouldIterateLoops: boolean
): number {
    if (!shouldIterateLoops) {
        return 1
    }

    const iterationOverrideEdges = edges.filter(
        edge => edge.target === loopStart.id && edge.targetHandle === 'iterations-override'
    )

    if (iterationOverrideEdges.length === 0) {
        return (loopStart as any).data.iterations
    }

    const sourceNode = nodes.find(n => n.id === iterationOverrideEdges[0].source)
    const overrideValue = Number.parseInt(sourceNode?.data.content || '', 10)

    return !Number.isNaN(overrideValue) ? overrideValue : (loopStart as any).data.iterations
}
