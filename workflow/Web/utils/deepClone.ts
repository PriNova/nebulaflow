/**
 * Deep clone utility for graph snapshots.
 * Prefers structuredClone; falls back to JSON copy for compatibility.
 */
export const deepClone = <T>(value: T): T => {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value as any)
        }
    } catch {
        // ignore and fall back
    }
    return JSON.parse(JSON.stringify(value)) as T
}
