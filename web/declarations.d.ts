// Type declarations for the web target.
// CSS modules and asset imports are handled by Vite at build time.

declare module '*.module.css' {
    const classes: Record<string, string>
    export default classes
}

declare module '*.css' {
    const content: string
    export default content
}

declare module '*.svg' {
    const content: string
    export default content
}

// File System Access API (Chrome 86+, not in standard lib yet)
interface FileSystemFileHandle {
    readonly name: string
}

interface OpenFilePickerOptions {
    multiple?: boolean
}

interface SaveFilePickerOptions {
    suggestedName?: string
}

interface Window {
    showOpenFilePicker(
        options?: OpenFilePickerOptions
    ): Promise<FileSystemFileHandle[]>
    showSaveFilePicker(
        options?: SaveFilePickerOptions
    ): Promise<FileSystemFileHandle>
}

// WebSocketMessagePort bridge API exposed on window
interface Window {
    __nebulaPort?: {
        postMessage: (msg: unknown) => void
    }
    __nebulaState?: unknown
}
