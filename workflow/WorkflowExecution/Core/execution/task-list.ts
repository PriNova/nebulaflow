export function shouldContinueLoop(collection: string | undefined | null): boolean {
    const trimmed = (collection ?? '').trim()
    return trimmed.length > 0
}
