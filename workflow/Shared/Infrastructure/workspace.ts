import type { IHostEnvironment } from '../Host/index'

let activeWorkflowPath: string | undefined
let host: IHostEnvironment | undefined

export function initializeWorkspace(h: IHostEnvironment) {
    host = h
}

export function setActiveWorkflowUri(uri: string | undefined): void {
    activeWorkflowPath = uri
}

export function getActiveWorkspaceRoots(): string[] {
    if (!host) return []
    const allRoots = [...host.workspace.workspaceFolders]
    if (!activeWorkflowPath) {
        return allRoots
    }

    // Find which root contains the active workflow
    // We assume paths are consistent (e.g. absolute)
    const preferred = allRoots.find(root => activeWorkflowPath!.startsWith(root))

    if (!preferred) {
        return allRoots
    }
    return [preferred, ...allRoots.filter(r => r !== preferred)]
}
