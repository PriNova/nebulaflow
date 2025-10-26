import { NodeType, type WorkflowNodes } from '../components/nodes/Nodes'
import type { WorkflowNodeDTO } from '../services/Protocol'

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
    // Remove functions, symbols, and undefined (structured-clone unsafe)
    const t = typeof value
    if (t === 'function' || t === 'symbol' || t === 'undefined') return undefined
    if (value === null) return null

    if (typeof value === 'object') {
        const obj = value as object
        if (seen.has(obj)) return undefined
        seen.add(obj)

        if (Array.isArray(value)) {
            const arr = (value as unknown[])
                .map(v => sanitizeValue(v, seen))
                .filter(v => v !== undefined)
            return arr
        }
        if (isPlainObject(value)) {
            const out: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                const sv = sanitizeValue(v, seen)
                if (sv !== undefined) out[k] = sv
            }
            return out
        }
        // For other object types (Date/Map/Set/etc.), return as-is for now
        return value
    }

    // primitives are fine
    return value
}

export function toWorkflowNodeDTO(node: WorkflowNodes): WorkflowNodeDTO {
    // Explicitly whitelist top-level fields and sanitize data
    const data = sanitizeValue(node.data) as Record<string, unknown>
    // Ensure any render-time callbacks are gone
    if (data && 'onUpdate' in data) {
        ;(data as any).onUpdate = undefined
    }

    // ReactFlow injects selection state; keep selected if present but ensure boolean
    const selected = typeof (node as any).selected === 'boolean' ? (node as any).selected : undefined

    return {
        id: node.id,
        type: String(node.type ?? NodeType.INPUT),
        data,
        position: { x: node.position.x, y: node.position.y },
        ...(selected !== undefined ? { selected } : {}),
    }
}
