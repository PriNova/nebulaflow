import * as vscode from 'vscode'

let activeWorkflowUri: vscode.Uri | undefined

export function setActiveWorkflowUri(uri: vscode.Uri | undefined): void {
    activeWorkflowUri = uri
}

export function getActiveWorkspaceRoots(): string[] {
    const allRoots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath)
    if (!activeWorkflowUri) {
        return allRoots
    }
    const folder = vscode.workspace.getWorkspaceFolder(activeWorkflowUri)
    if (!folder) {
        return allRoots
    }
    const preferred = folder.uri.fsPath
    return [preferred, ...allRoots.filter(r => r !== preferred)]
}
