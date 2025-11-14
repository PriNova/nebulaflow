import { NodeType } from '../../../Core/models'
import type { IndexedExecutionContext } from '../../Application/handlers/ExecuteWorkflow'
import { replaceIndexedInputs } from './inputs'

export function combineParentOutputsByConnectionOrder(
    nodeId: string,
    context?: IndexedExecutionContext,
    visited?: Set<string>
): string[] {
    const parentEdges = context?.edgeIndex.byTarget.get(nodeId) || []
    const localVisited = visited || new Set<string>()

    if (localVisited.has(nodeId)) {
        return []
    }
    localVisited.add(nodeId)

    // Ensure stable input ordering by sorting parent edges by targetHandle in-<n> when present
    const getInIndex = (h: unknown): number | null => {
        if (typeof h === 'string') {
            const m = /^in-(\d+)$/.exec(h)
            if (m) return Number.parseInt(m[1], 10)
        }
        return null
    }
    let orderedEdges: any[] = parentEdges as any[]
    try {
        const withIn: Array<{ edge: any; n: number }> = []
        const withoutIn: any[] = []
        for (const e of parentEdges as any[]) {
            const n = getInIndex(e.targetHandle)
            if (n !== null) withIn.push({ edge: e, n })
            else withoutIn.push(e)
        }
        if (withIn.length > 0) {
            withIn.sort((a, b) => a.n - b.n)
            orderedEdges = withIn.map(x => x.edge).concat(withoutIn)
        }
    } catch {
        orderedEdges = parentEdges as any[]
    }

    return orderedEdges
        .map(edge => {
            const parentNode = context?.nodeIndex.get(edge.source)

            if (parentNode?.type === NodeType.INPUT && parentNode.data?.active !== false) {
                const parentInputs = combineParentOutputsByConnectionOrder(
                    parentNode.id,
                    context,
                    localVisited
                )
                const template = ((parentNode as any).data?.content || '').toString()
                const text = template ? replaceIndexedInputs(template, parentInputs, context) : ''
                return text.replace(/\r\n/g, '\n')
            }

            const parentVal = context?.nodeOutputs.get(edge.source)
            if (Array.isArray(parentVal)) {
                // Multi-output parent (e.g., subflow). If sourceHandle is out-<n>, pick that index; else join.
                const sh = edge.sourceHandle
                if (typeof sh === 'string' && sh.startsWith('out-')) {
                    const idx = Number.parseInt(sh.slice(4), 10)
                    const v =
                        Number.isFinite(idx) && idx >= 0 && idx < parentVal.length
                            ? parentVal[idx]
                            : parentVal.join('\n')
                    return String(v).replace(/\r\n/g, '\n')
                }
                return parentVal.join('\n').replace(/\r\n/g, '\n')
            }
            if (parentVal === undefined) {
                return ''
            }
            return String(parentVal).replace(/\r\n/g, '\n')
        })
        .filter(output => output !== undefined)
}
