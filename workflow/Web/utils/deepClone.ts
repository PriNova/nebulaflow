/**
 * Deep clone utility for graph snapshots.
 * Prefers structuredClone; falls back to JSON copy for compatibility.
 */
export function deepClone<T>(value: T): T {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value)
        }
    } catch {
        // ignore and fall back
    }
    return JSON.parse(JSON.stringify(value)) as T
}
