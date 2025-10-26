import { type Edge, NodeType, type WorkflowNodes } from '../models'

// Exclude LOOP nodes from supported scheduling (IF_ELSE now supported)
const UNSUPPORTED_TYPES_V1 = new Set<NodeType>([NodeType.LOOP_START, NodeType.LOOP_END])

export type ParallelOptions = {
    // Global max concurrent nodes (default: Infinity)
    concurrency?: number
    // Optional per-node-type caps (e.g., { llm: 2, cli: 2 })
    perType?: Partial<Record<NodeType, number>>
    // Error policy: fail-fast cancels all in-flight tasks on first error
    onError?: 'fail-fast' | 'continue-subgraph'
    // Optional seed outputs for upstream parents not re-executed on resume
    seeds?: {
        outputs?: Record<string, string>
        decisions?: Record<string, 'true' | 'false'>
        variables?: Record<string, string>
    }
}

export type ParallelCallbacks = {
    runNode(
        node: WorkflowNodes,
        ctx: ParallelExecutionContext,
        signal: AbortSignal
    ): Promise<string | string[]>
    onStatus(payload: {
        nodeId: string
        status: 'running' | 'completed' | 'error' | 'interrupted'
        result?: string
    }): Promise<void> | void
}

// Lightweight execution context compatible with the existing ExecuteWorkflow needs.
// Keep fields optional to allow progressive enhancement later (LOOP, etc.).
export interface ParallelExecutionContext {
    nodeOutputs: Map<string, string | string[]>
    nodeIndex: Map<string, WorkflowNodes>
    edgeIndex: EdgeIndex
    ifElseDecisions?: Map<string, boolean>
    disabledNodes?: Set<string>
    conditionalOutEdges?: Map<string, { true: string[]; false: string[] }>
    conditionalInPlaceholders?: Map<string, number>
    loopStates?: Map<string, { currentIteration: number; maxIterations: number; variable: string }>
    accumulatorValues?: Map<string, string>
    cliMetadata?: Map<string, { exitCode: string }>
    variableValues?: Map<string, string>
    ifelseSkipPaths?: Map<string, Set<string>>
}

interface EdgeIndex {
    bySource: Map<string, Edge[]>
    byTarget: Map<string, Edge[]>
    byId: Map<string, Edge>
}

interface OrderIndex {
    bySourceTarget: Map<string, number>
    byTarget: Map<string, Edge[]>
}

export async function executeWorkflowParallel(
    nodes: WorkflowNodes[],
    edges: Edge[],
    callbacks: ParallelCallbacks,
    options?: ParallelOptions,
    outerAbortSignal?: AbortSignal
): Promise<void> {
    const { onStatus, runNode } = callbacks

    const concurrency = options?.concurrency ?? Number.POSITIVE_INFINITY
    const perTypeCaps: Partial<Record<NodeType, number>> = {
        [NodeType.LLM]: 8,
        [NodeType.CLI]: 8,
        ...options?.perType,
    }
    const onError: 'fail-fast' | 'continue-subgraph' = options?.onError ?? 'fail-fast'

    // Filter to active nodes only, but treat disabled nodes as pass-through for dependency resolution
    // We keep them out of runnable set, but we still allow their children to run if upstreams are satisfied
    const activeNodes = nodes.filter(n => n.data?.active !== false)

    // Guard: unsupported node types present — v1 scheduler does not handle them
    const unsupported = activeNodes.filter(n => UNSUPPORTED_TYPES_V1.has(n.type))
    if (unsupported.length > 0) {
        const list = unsupported.map(n => `${n.id}:${n.type}`).join(', ')
        throw new Error(
            `Unsupported node types for v1 parallel scheduler present: ${list}. Please exclude LOOP nodes.`
        )
    }

    const includedIds = new Set(activeNodes.map(n => n.id))
    const seedOutputs = options?.seeds?.outputs ?? {}
    const seedDecisions = options?.seeds?.decisions ?? {}
    const seedVariables = options?.seeds?.variables ?? {}
    const seedIds = new Set(Object.keys(seedOutputs))

    // Keep all incoming edges to included targets; seeds mark satisfaction
    // Keep edges whose targets are active; if a source is disabled, we will treat it as already satisfied
    const activeEdges = edges.filter(e => includedIds.has(e.target))

    const edgeIndex = createEdgeIndex(activeEdges)
    const orderIndex = buildOrderIndex(activeEdges)
    const nodeIndex = new Map(activeNodes.map(n => [n.id, n] as const))

    // Build conditional edge maps for IF/ELSE nodes
    const { conditionalOutEdges, conditionalInPlaceholders } = buildConditionalEdges(
        activeNodes,
        activeEdges
    )

    // Initialize in-degree and children mapping
    // Conditional edges from IF/ELSE nodes are not counted in initial in-degree
    const inDegree = new Map<string, number>()
    for (const n of activeNodes) inDegree.set(n.id, 0)
    for (const e of activeEdges) {
        // Skip conditional edges; they will be materialized when IF/ELSE completes
        if (conditionalOutEdges.has(e.source)) continue
        // Treat seeded parents as satisfied; also treat disabled parents as satisfied (pass-through)
        const parent = nodeIndex.get(e.source)
        const parentDisabled = parent ? parent.data?.active === false : false
        if (!seedIds.has(e.source) && !parentDisabled) {
            inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
        }
    }
    // Apply placeholder counts for conditional targets so they don't start prematurely
    for (const [target, count] of conditionalInPlaceholders) {
        inDegree.set(target, (inDegree.get(target) || 0) + count)
    }

    const ctx: ParallelExecutionContext = {
        nodeOutputs: new Map<string, string | string[]>(),
        nodeIndex,
        edgeIndex,
        ifElseDecisions: new Map(),
        disabledNodes: new Set(),
        conditionalOutEdges,
        conditionalInPlaceholders,
        // optional maps reserved for future extensions
        loopStates: new Map(),
        accumulatorValues: new Map(),
        cliMetadata: new Map(),
        variableValues: new Map(),
        ifelseSkipPaths: new Map(),
    }

    // Seed variable values by name (resume support for ${var} templates)
    for (const [name, value] of Object.entries(seedVariables)) {
        ctx.variableValues?.set(name, value)
    }

    // Preload seed outputs for upstream parents that will not be re-executed
    for (const [sid, val] of Object.entries(seedOutputs)) {
        if (!includedIds.has(sid)) {
            ctx.nodeOutputs.set(sid, val)
        }
    }

    // Apply seeded decisions and materialize/prune branches
    for (const [ifElseNodeId, decisionStr] of Object.entries(seedDecisions)) {
        const decision = decisionStr.toLowerCase() === 'true'
        ctx.ifElseDecisions?.set(ifElseNodeId, decision)

        // Materialize chosen branch and prune non-chosen branch
        const branches = conditionalOutEdges.get(ifElseNodeId)
        if (branches) {
            const chosenTargets = decision ? branches.true : branches.false
            const prunedTargets = decision ? branches.false : branches.true

            // Materialize chosen branch: decrement in-degree for chosen targets
            for (const target of chosenTargets) {
                const d = (inDegree.get(target) || 0) - 1
                inDegree.set(target, d)
            }

            // Prune non-chosen branch: mark reachable nodes as disabled (BFS)
            const pruneSet = new Set<string>()
            const queue = [...prunedTargets]
            while (queue.length > 0) {
                const current = queue.shift()!
                if (pruneSet.has(current)) continue
                pruneSet.add(current)
                ctx.disabledNodes?.add(current)
                for (const e of activeEdges) {
                    if (e.source === current && !pruneSet.has(e.target)) {
                        queue.push(e.target)
                    }
                }
            }
        }
    }

    // Ready queue (priority-sorted)
    const ready: WorkflowNodes[] = []
    for (const n of activeNodes) {
        // Skip disabled nodes and nodes from non-seeded IF/ELSE decisions
        if (ctx.disabledNodes?.has(n.id)) continue
        if ((inDegree.get(n.id) || 0) === 0) ready.push(n)
    }
    sortReadyQueue(ready, orderIndex, activeEdges)

    const ac = new AbortController()
    const combinedSignal = ac.signal
    if (outerAbortSignal) {
        if (outerAbortSignal.aborted) ac.abort()
        else outerAbortSignal.addEventListener('abort', () => ac.abort(), { once: true })
    }

    const runningByType = new Map<NodeType, number>()
    const inflight: Array<{ nodeId: string; type: NodeType; promise: Promise<TaskResult> }> = []

    let remaining = activeNodes.length
    let failed = false

    // Helper to check capacity
    const canStart = (type: NodeType): boolean => {
        const totalRunning = inflight.length
        if (totalRunning >= concurrency) return false
        const cap = perTypeCaps[type] ?? Number.POSITIVE_INFINITY
        const cur = runningByType.get(type) || 0
        return cur < cap
    }

    const markStart = (type: NodeType): void => {
        runningByType.set(type, (runningByType.get(type) || 0) + 1)
    }
    const markDone = (type: NodeType): void => {
        const cur = runningByType.get(type) || 0
        runningByType.set(type, Math.max(0, cur - 1))
    }

    // Start as many as we can
    const tryStart = (): void => {
        while (ready.length > 0 && canStart(ready[0].type) && !combinedSignal.aborted) {
            const node = ready.shift()!
            markStart(node.type)
            void onStatus({ nodeId: node.id, status: 'running' })
            const p = startNode(node, runNode, ctx, combinedSignal).then(async res => {
                markDone(node.type)
                if (res.status === 'ok') {
                    const asText = toResultString(res.result)
                    try {
                        await onStatus({ nodeId: node.id, status: 'completed', result: asText })
                    } catch {
                        // ignore status callback errors
                    }

                    // If this is an IF/ELSE node, extract decision and process branch
                    if (node.type === NodeType.IF_ELSE) {
                        // Decision from the node result: 'true' or 'false' string
                        const decision = asText.trim().toLowerCase() === 'true'
                        ctx.ifElseDecisions?.set(node.id, decision)
                        processIfElseCompletion(
                            node.id,
                            decision,
                            ctx.conditionalOutEdges || new Map(),
                            inDegree,
                            ctx.disabledNodes || new Set(),
                            activeEdges,
                            nodeIndex,
                            ready
                        )
                    } else {
                        // Decrement children in-degrees and enqueue newly-ready nodes
                        const outEdges = edgeIndex.bySource.get(node.id) || []
                        for (const e of outEdges) {
                            // Skip conditional edges from IF/ELSE parents; they are handled separately
                            if (conditionalOutEdges.has(e.source)) continue
                            const tgt = e.target
                            const d = (inDegree.get(tgt) || 0) - 1
                            inDegree.set(tgt, d)
                            if (d === 0 && !ctx.disabledNodes?.has(tgt)) {
                                const child = nodeIndex.get(tgt)
                                if (child) {
                                    ready.push(child)
                                }
                            }
                        }
                    }

                    sortReadyQueue(ready, orderIndex, activeEdges)
                    remaining -= 1
                } else if (res.status === 'interrupted') {
                    try {
                        await onStatus({ nodeId: node.id, status: 'interrupted' })
                    } catch {}
                    remaining -= 1
                } else {
                    failed = true
                    try {
                        await onStatus({ nodeId: node.id, status: 'error', result: res.error })
                    } catch {}
                    remaining -= 1
                    if (onError === 'fail-fast') ac.abort()
                }
                return res
            })
            inflight.push({ nodeId: node.id, type: node.type, promise: p })
        }
    }

    // Main loop
    tryStart()

    while (remaining > 0 && !combinedSignal.aborted) {
        if (inflight.length === 0) {
            // No tasks running and some nodes remain -> most likely unsatisfied inputs on resume
            const blocked: string[] = []
            for (const [nid, deg] of inDegree) {
                // Skip disabled nodes and nodes that have never started
                if (ctx.disabledNodes?.has(nid)) continue
                // Remaining nodes that still have unmet dependencies
                if (deg > 0) blocked.push(nid)
            }
            const detail =
                blocked.length > 0 ? `; unsatisfied inputs for nodes: ${blocked.join(', ')}` : ''
            throw new Error(`Parallel scheduler cannot proceed${detail}`)
        }

        // Wait for the first completion
        const winner = await Promise.race(inflight.map(t => t.promise))
        // Remove winner from inflight
        const idx = inflight.findIndex(t => t.nodeId === winner.nodeId)
        if (idx >= 0) inflight.splice(idx, 1)

        // After a completion, try to start more
        tryStart()
    }

    // Abort propagation if requested
    if (combinedSignal.aborted && onError === 'fail-fast') {
        // Wait for all in-flight promises to settle to avoid dangling rejections
        await Promise.allSettled(inflight.map(t => t.promise))
        return
    }

    if (remaining !== 0) {
        // Should not happen unless aborted mid-flight
        await Promise.allSettled(inflight.map(t => t.promise))
    }

    // All done
    return
}

function createEdgeIndex(edges: Edge[]): EdgeIndex {
    const bySource = new Map<string, Edge[]>()
    const byTarget = new Map<string, Edge[]>()
    const byId = new Map<string, Edge>()

    for (const edge of edges) {
        const s = bySource.get(edge.source) || []
        s.push(edge)
        bySource.set(edge.source, s)

        const t = byTarget.get(edge.target) || []
        t.push(edge)
        byTarget.set(edge.target, t)

        byId.set(edge.id, edge)
    }
    return { bySource, byTarget, byId }
}

function buildOrderIndex(edges: Edge[]): OrderIndex {
    const bySourceTarget = new Map<string, number>()
    const byTarget = new Map<string, Edge[]>()
    for (const e of edges) {
        const arr = byTarget.get(e.target) || []
        arr.push(e)
        byTarget.set(e.target, arr)
    }
    for (const [targetId, arr] of byTarget) {
        arr.forEach((edge, idx) => {
            const key = `${edge.source}-${targetId}`
            bySourceTarget.set(key, idx + 1)
        })
    }
    return { bySourceTarget, byTarget }
}

interface ConditionalEdgeInfo {
    conditionalOutEdges: Map<string, { true: string[]; false: string[] }>
    conditionalInPlaceholders: Map<string, number>
}

// Build conditional edge maps for IF/ELSE nodes
function buildConditionalEdges(nodes: WorkflowNodes[], edges: Edge[]): ConditionalEdgeInfo {
    const conditionalOutEdges = new Map<string, { true: string[]; false: string[] }>()
    const conditionalInPlaceholders = new Map<string, number>()
    const nodeIndex = new Map(nodes.map(n => [n.id, n]))

    // For each IF/ELSE node, collect its outgoing edges by handle
    for (const node of nodes) {
        if (node.type !== NodeType.IF_ELSE) continue
        const outEdges = edges.filter(e => e.source === node.id)
        const trueEdges: string[] = []
        const falseEdges: string[] = []

        for (const e of outEdges) {
            if (e.sourceHandle === 'true') {
                trueEdges.push(e.target)
            } else if (e.sourceHandle === 'false') {
                falseEdges.push(e.target)
            }
        }

        if (trueEdges.length > 0 || falseEdges.length > 0) {
            conditionalOutEdges.set(node.id, { true: trueEdges, false: falseEdges })

            // Mark conditional placeholders for targets of this IF/ELSE node
            for (const target of [...trueEdges, ...falseEdges]) {
                const cur = conditionalInPlaceholders.get(target) || 0
                conditionalInPlaceholders.set(target, cur + 1)
            }
        }
    }

    return { conditionalOutEdges, conditionalInPlaceholders }
}

// Process IF/ELSE node completion: materialize chosen branch, prune non-chosen
function processIfElseCompletion(
    nodeId: string,
    decision: boolean,
    conditionalOutEdges: Map<string, { true: string[]; false: string[] }>,
    inDegree: Map<string, number>,
    disabledNodes: Set<string>,
    activeEdges: Edge[],
    nodeIndex: Map<string, WorkflowNodes>,
    ready: WorkflowNodes[]
): void {
    const branches = conditionalOutEdges.get(nodeId)
    if (!branches) return

    const chosenTargets = decision ? branches.true : branches.false
    const prunedTargets = decision ? branches.false : branches.true

    // Materialize chosen branch: decrement in-degree
    for (const target of chosenTargets) {
        const d = (inDegree.get(target) || 0) - 1
        inDegree.set(target, d)
        // If target becomes ready, enqueue it
        if (d === 0 && !disabledNodes.has(target)) {
            const child = nodeIndex.get(target)
            if (child) ready.push(child)
        }
    }

    // Prune non-chosen branch: BFS mark as disabled
    const pruneSet = new Set<string>()
    const queue = [...prunedTargets]
    while (queue.length > 0) {
        const current = queue.shift()!
        if (pruneSet.has(current)) continue
        pruneSet.add(current)
        disabledNodes.add(current)
        for (const e of activeEdges) {
            if (e.source === current && !pruneSet.has(e.target)) {
                queue.push(e.target)
            }
        }
    }
}

function getNodePriority(node: WorkflowNodes, orderIndex: OrderIndex, edges: Edge[]): number {
    let minOrder = Number.POSITIVE_INFINITY
    // Among all outgoing edges from this node, use the smallest input position into each target
    for (const e of edges) {
        if (e.source === node.id) {
            const key = `${e.source}-${e.target}`
            const order = orderIndex.bySourceTarget.get(key) || Number.POSITIVE_INFINITY
            if (order < minOrder) minOrder = order
        }
    }
    return minOrder
}

function sortReadyQueue(ready: WorkflowNodes[], orderIndex: OrderIndex, edges: Edge[]): void {
    ready.sort((a, b) => {
        const pa = getNodePriority(a, orderIndex, edges)
        const pb = getNodePriority(b, orderIndex, edges)
        if (pa !== pb) return pa - pb
        // Stable tie-breakers to keep execution predictable across runs
        const ax = a.position?.x ?? 0
        const bx = b.position?.x ?? 0
        if (ax !== bx) return ax - bx
        const ay = a.position?.y ?? 0
        const by = b.position?.y ?? 0
        if (ay !== by) return ay - by
        return a.id.localeCompare(b.id)
    })
}

type TaskResult =
    | { nodeId: string; status: 'ok'; result: string | string[] }
    | { nodeId: string; status: 'error'; error: string }
    | { nodeId: string; status: 'interrupted' }

function toResultString(res: string | string[] | undefined): string {
    if (Array.isArray(res)) return res.join('\n')
    if (typeof res === 'string') return res
    return ''
}

async function startNode(
    node: WorkflowNodes,
    runNode: ParallelCallbacks['runNode'],
    ctx: ParallelExecutionContext,
    signal: AbortSignal
): Promise<TaskResult> {
    try {
        const result = await runNode(node, ctx, signal)
        // Store result in context for downstream consumers
        ctx.nodeOutputs.set(node.id, result)
        return { nodeId: node.id, status: 'ok', result }
    } catch (err: unknown) {
        if (signal.aborted) {
            return { nodeId: node.id, status: 'interrupted' }
        }
        const msg = err instanceof Error ? err.message : String(err)
        return { nodeId: node.id, status: 'error', error: msg }
    }
}
