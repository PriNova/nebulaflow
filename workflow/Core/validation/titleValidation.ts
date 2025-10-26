const MAX_TITLE_LENGTH = 100

export function validateTitle(title: string | undefined): string {
    if (!title) return 'Text'
    return title.trim().slice(0, MAX_TITLE_LENGTH)
}

export function normalizeNodeTitle(title: string | undefined): string {
    return validateTitle(title)
}
