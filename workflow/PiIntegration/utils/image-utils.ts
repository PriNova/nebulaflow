import * as fs from 'node:fs'
import * as nodePath from 'node:path'

interface ImageContent {
    type: 'image'
    data: string
    mimeType: string
}

const MIME_MAP: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
}

function detectMimeType(filePath: string): string {
    const ext = nodePath.extname(filePath).toLowerCase()
    return MIME_MAP[ext] ?? 'application/octet-stream'
}

function detectMimeTypeFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname
        return detectMimeType(pathname)
    } catch {
        return 'application/octet-stream'
    }
}

/** Convert a local image file to an ImageContent for pi's Agent.prompt() */
export async function imageFromFile(filePath: string): Promise<ImageContent> {
    const data = await fs.promises.readFile(filePath, { encoding: 'base64' })
    return {
        type: 'image',
        data,
        mimeType: detectMimeType(filePath),
    }
}

/** Fetch an image from a URL and convert to ImageContent */
export async function imageFromURL(url: string): Promise<ImageContent> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${url}: ${response.status} ${response.statusText}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
        type: 'image',
        data: buffer.toString('base64'),
        mimeType: detectMimeTypeFromUrl(url),
    }
}
