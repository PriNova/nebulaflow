import { NodeType, type WorkflowNodes } from '../models'
import type { Edge } from '../models'

/**
 * Represents the mapping of node IDs to their parallel step index.
 * Nodes with the same step index can execute in parallel.
 */
export interface ParallelAnalysisResult {
    stepByNodeId: Map<string, number>
    steps: string[][]
}

/**
 * Maps IF/ELSE nodes to their branch-exclusive node sets.
 * Used to decorate parallel steps with T/F hints.
 */
export interface BranchSubgraphsResult {
    byIfElseId: Map<string, { true: Set<string>; false: Set<string> }>
}

/**
 * Computes parallel execution steps (waves/levels) from a dependency graph.
 * Uses Kahn's algorithm to assign each node to a step number based on its dependencies.
 *
 * Constraints:
 * - Loops (LOOP_START, LOOP_END) are excluded from analysis and marked as unsupported.
 * - All active nodes are included unless filtered out externally.
 * - Edge ordering is respected for deterministic step assignment when multiple edges
 *   target the same node.
 *
 * @param nodes - All workflow nodes (filtered to active nodes externally).
 * @param edges - All edges in the graph.
 * @returns ParallelAnalysisResult with stepByNodeId map and steps 2D array.
 */
export function computeParallelSteps(nodes: WorkflowNodes[], edges: Edge[]): ParallelAnalysisResult {
    const loopNodeIds = new Set(
        nodes.filter(n => n.type === NodeType.LOOP_START || n.type === NodeType.LOOP_END).map(n => n.id)
    )

    // Filter to exclude loop nodes from analysis
    const activeNodes = nodes.filter(n => !loopNodeIds.has(n.id))
    const nodeIdSet = new Set(activeNodes.map(n => n.id))
    const activeEdges = edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))

    const stepByNodeId = new Map<string, number>()
    const inDegree = new Map<string, number>()

    // Initialize in-degrees
    for (const node of activeNodes) {
        inDegree.set(node.id, 0)
    }
    for (const edge of activeEdges) {
        const currentDegree = inDegree.get(edge.target) || 0
        inDegree.set(edge.target, currentDegree + 1)
    }

    // Build edge order index for deterministic ordering (matching node-sorting.ts logic)
    const edgeOrderIndex = buildOrderIndexForParallelAnalysis(activeEdges)

    // Build fast lookup maps to avoid O(V×E) scans
    const nodeById = new Map(activeNodes.map(n => [n.id, n] as const))
    const outAdj = new Map<string, string[]>()
    for (const edge of activeEdges) {
        const arr = outAdj.get(edge.source) || []
        arr.push(edge.target)
        outAdj.set(edge.source, arr)
    }

    // Queue for nodes with zero in-degree, sorted by edge priority
    const queue: WorkflowNodes[] = activeNodes.filter(node => inDegree.get(node.id) === 0)
    queue.sort(
        (a, b) =>
            getNodePriorityForParallelAnalysis(a, edgeOrderIndex, activeEdges, outAdj) -
            getNodePriorityForParallelAnalysis(b, edgeOrderIndex, activeEdges, outAdj)
    )

    let currentStep = 0
    const steps: string[][] = []
    const processedNodes = new Set<string>()

    while (processedNodes.size < activeNodes.length) {
        if (queue.length === 0) {
            // Handle cycles by finding min in-degree node (fallback)
            const remainingNodes = activeNodes.filter(node => !processedNodes.has(node.id))
            if (remainingNodes.length === 0) break

            const minDegreeNode = remainingNodes.reduce((min, node) => {
                const degree = inDegree.get(node.id) || 0
                const minDegree = inDegree.get(min.id) || 0
                return degree < minDegree ? node : min
            })

            queue.push(minDegreeNode)
            queue.sort(
                (a, b) =>
                    getNodePriorityForParallelAnalysis(a, edgeOrderIndex, activeEdges, outAdj) -
                    getNodePriorityForParallelAnalysis(b, edgeOrderIndex, activeEdges, outAdj)
            )
        }

        // Process all nodes with current in-degree in parallel (same step)
        const currentQueueLength = queue.length
        const currentStepNodes: string[] = []

        for (let i = 0; i < currentQueueLength; i++) {
            const node = queue.shift()!
            processedNodes.add(node.id)
            stepByNodeId.set(node.id, currentStep)
            currentStepNodes.push(node.id)

            // Decrement in-degrees of children and add ready nodes to queue
            const children = outAdj.get(node.id) || []
            for (const childId of children) {
                const newDeg = (inDegree.get(childId) || 0) - 1
                inDegree.set(childId, newDeg)
                if (newDeg === 0) {
                    const childNode = nodeById.get(childId)
                    if (childNode && !processedNodes.has(childId)) {
                        queue.push(childNode)
                    }
                }
            }
        }

        // Sort the queue for next step
        queue.sort(
            (a, b) =>
                getNodePriorityForParallelAnalysis(a, edgeOrderIndex, activeEdges, outAdj) -
                getNodePriorityForParallelAnalysis(b, edgeOrderIndex, activeEdges, outAdj)
        )

        if (currentStepNodes.length > 0) {
            steps.push(currentStepNodes)
            currentStep += 1
        }
    }

    // Assign loop nodes a "unsupported" step marker (step -1)
    for (const loopNodeId of loopNodeIds) {
        stepByNodeId.set(loopNodeId, -1)
    }

    return { stepByNodeId, steps }
}

/**
 * Builds a conditional subgraph map for IF/ELSE nodes.
 * For each IF/ELSE node, determines which downstream nodes are reachable via the
 * true branch and which via the false branch.
 *
 * Uses BFS to trace paths from IF/ELSE nodes until merge points (shared targets).
 * Nodes exclusive to one branch are marked accordingly.
 *
 * @param nodes - All workflow nodes.
 * @param edges - All edges in the graph.
 * @returns BranchSubgraphsResult mapping IF/ELSE nodes to their branch node sets.
 */
export function computeBranchSubgraphs(nodes: WorkflowNodes[], edges: Edge[]): BranchSubgraphsResult {
    const byIfElseId = new Map<string, { true: Set<string>; false: Set<string> }>()

    const ifElseNodes = nodes.filter(n => n.type === NodeType.IF_ELSE)

    for (const ifElseNode of ifElseNodes) {
        const trueEdges = edges.filter(e => e.source === ifElseNode.id && e.sourceHandle === 'true')
        const falseEdges = edges.filter(e => e.source === ifElseNode.id && e.sourceHandle === 'false')

        const trueNodeIds = new Set<string>()
        const falseNodeIds = new Set<string>()

        // BFS to collect reachable nodes per branch, but stop at merge points
        const trueFrontier = trueEdges.map(e => e.target)
        const falseFrontier = falseEdges.map(e => e.target)

        const trueVisited = bfsCollectUntilMerge(trueFrontier, edges, [ifElseNode.id])
        const falseVisited = bfsCollectUntilMerge(falseFrontier, edges, [ifElseNode.id])

        // Exclusivity: nodes that belong only to one side
        for (const id of trueVisited) if (!falseVisited.has(id)) trueNodeIds.add(id)
        for (const id of falseVisited) if (!trueVisited.has(id)) falseNodeIds.add(id)

        byIfElseId.set(ifElseNode.id, {
            true: trueNodeIds,
            false: falseNodeIds,
        })
    }

    return { byIfElseId }
}

/**
 * Helper: builds an edge order index for consistent, deterministic ordering.
 * Matches the logic in node-sorting.ts kahnSortbyOrderedEdges.
 */
function buildOrderIndexForParallelAnalysis(edges: Edge[]): Map<string, number> {
    const bySourceTarget = new Map<string, number>()
    if (!edges || edges.length === 0) return bySourceTarget

    // Use a stable sort key: sourceId|targetId|sourceHandle|targetHandle
    const stableEdges = [...edges].sort((a, b) => {
        const ak = `${a.source}|${a.target}|${a.sourceHandle ?? ''}|${a.targetHandle ?? ''}`
        const bk = `${b.source}|${b.target}|${b.sourceHandle ?? ''}|${b.targetHandle ?? ''}`
        return ak.localeCompare(bk)
    })

    stableEdges.forEach((edge, index) => {
        const key = `${edge.source}-${edge.target}`
        bySourceTarget.set(key, index + 1)
    })

    return bySourceTarget
}

/**
 * Helper: computes priority for a node based on its outgoing edges.
 * Lower priority = processed first. Matches node-sorting.ts logic.
 */
function getNodePriorityForParallelAnalysis(
    node: WorkflowNodes,
    edgeOrderIndex: Map<string, number>,
    activeEdges: Edge[],
    outAdj: Map<string, string[]>
): number {
    let minOrder = Number.POSITIVE_INFINITY
    const children = outAdj.get(node.id) || []
    for (const target of children) {
        const key = `${node.id}-${target}`
        const order = edgeOrderIndex.get(key) || Number.POSITIVE_INFINITY
        minOrder = Math.min(minOrder, order)
    }
    return minOrder
}

/**
 * Helper: BFS that collects nodes until encountering merge points (nodes with >1 distinct incoming sources in the traversal).
 * Returns the set of visited node IDs (excluding the excluded seeds).
 */
function bfsCollectUntilMerge(frontier: string[], edges: Edge[], excludeNodeIds: string[]): Set<string> {
    const queue = [...frontier]
    const visited = new Set<string>(excludeNodeIds)
    const seen = new Set<string>()
    const incomingCount = new Map<string, number>()

    // Precompute incoming adjacency for efficiency
    const inAdj = new Map<string, string[]>()
    for (const e of edges) {
        const arr = inAdj.get(e.target) || []
        arr.push(e.source)
        inAdj.set(e.target, arr)
    }

    while (queue.length > 0) {
        const nodeId = queue.shift()!
        if (visited.has(nodeId)) continue

        // If this node has multiple distinct incoming sources in the graph, treat as merge boundary
        const incomers = (inAdj.get(nodeId) || []).filter(id => !excludeNodeIds.includes(id))
        const prev = incomingCount.get(nodeId) || 0
        const newCount = Math.max(prev, incomers.length)
        incomingCount.set(nodeId, newCount)
        if (newCount > 1) {
            // Stop traversal past merge point; include node as boundary but don't expand further
            visited.add(nodeId)
            seen.add(nodeId)
            continue
        }

        visited.add(nodeId)
        seen.add(nodeId)

        for (const e of edges) {
            if (e.source === nodeId && !visited.has(e.target)) {
                queue.push(e.target)
            }
        }
    }

    return seen
}
