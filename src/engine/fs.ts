import * as vscode from 'vscode'
import type { WorkflowNodes } from '../protocol/WorkflowProtocol'

const WORKFLOWS_DIR = '.sourcegraph/workflows'
const NODES_DIR = '.sourcegraph/nodes'

export async function saveWorkflow(data: any): Promise<void> {
    const workspaceRootFsPath = vscode.workspace.workspaceFolders?.[0]?.uri?.path
    const defaultFilePath = workspaceRootFsPath
        ? vscode.Uri.joinPath(vscode.Uri.file(workspaceRootFsPath), WORKFLOWS_DIR + '/workflow.json')
        : vscode.Uri.file('workflow.json')
    const result = await vscode.window.showSaveDialog({
        defaultUri: defaultFilePath,
        filters: { 'Workflow Files': ['json'] },
        title: 'Save Workflow',
    })
    if (result) {
        try {
            const parent = vscode.Uri.joinPath(result, '..')
            try { await vscode.workspace.fs.createDirectory(parent) } catch {}
            const content = Buffer.from(JSON.stringify({ ...data, version: '1.0.0' }, null, 2), 'utf-8')
            await vscode.workspace.fs.writeFile(result, content)
            void vscode.window.showInformationMessage('Workflow saved successfully!')
        } catch (error) {
            void vscode.window.showErrorMessage(`Failed to save workflow: ${error}`)
        }
    }
}

export async function loadWorkflow(): Promise<{ nodes: WorkflowNodes[]; edges: any[] } | null> {
    const workspaceRootFsPath = vscode.workspace.workspaceFolders?.[0]?.uri?.path
    const defaultFilePath = workspaceRootFsPath
        ? vscode.Uri.joinPath(vscode.Uri.file(workspaceRootFsPath), WORKFLOWS_DIR)
        : vscode.Uri.file('workflow.json')

    const result = await vscode.window.showOpenDialog({
        defaultUri: defaultFilePath,
        canSelectMany: false,
        filters: { 'Workflow Files': ['json'] },
        title: 'Load Workflow',
    })

    if (result?.[0]) {
        try {
            const content = await vscode.workspace.fs.readFile(result[0])
            const data = JSON.parse(content.toString())
            void vscode.window.showInformationMessage('Workflow loaded successfully!')
            return { nodes: data.nodes || [], edges: data.edges || [] }
        } catch (error) {
            void vscode.window.showErrorMessage(`Failed to load workflow: ${error}`)
            return null
        }
    }
    return null
}

export async function getCustomNodes(): Promise<WorkflowNodes[]> {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace found.')
            return []
        }
        const nodesDirUri = vscode.Uri.joinPath(workspaceRoot, NODES_DIR)
        try { await vscode.workspace.fs.createDirectory(nodesDirUri) } catch {}
        const files = await vscode.workspace.fs.readDirectory(nodesDirUri)
        const nodes: WorkflowNodes[] = []
        for (const [filename, fileType] of files) {
            if (fileType === vscode.FileType.File && filename.endsWith('.json')) {
                try {
                    const fileUri = vscode.Uri.joinPath(nodesDirUri, filename)
                    const fileData = await vscode.workspace.fs.readFile(fileUri)
                    const node = JSON.parse(fileData.toString()) as WorkflowNodes
                    nodes.push(node)
                } catch (error: any) {
                    console.error(`Failed to load custom node "${filename}": ${error?.message}`)
                    vscode.window.showErrorMessage(`Failed to load custom node "${filename}": ${error?.message}`)
                }
            }
        }
        return nodes
    } catch (error: any) {
        console.error(`Failed to load custom nodes: ${error?.message}`)
        vscode.window.showErrorMessage(`Failed to load custom nodes: ${error?.message}`)
        return []
    }
}

export async function saveCustomNode(node: WorkflowNodes): Promise<void> {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace found.')
            return
        }
        const nodesDirUri = vscode.Uri.joinPath(workspaceRoot, NODES_DIR)
        try { await vscode.workspace.fs.createDirectory(nodesDirUri) } catch {}
        const filename = `${sanitizeFilename(node.data.title)}.json`
        const fileUri = vscode.Uri.joinPath(nodesDirUri, filename)
        const { id, ...nodeToSave } = node as any
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(nodeToSave, null, 2), 'utf-8'))
        vscode.window.showInformationMessage(`Custom node "${node.data.title}" saved successfully.`)
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to save custom node: ${error?.message}`)
    }
}

export async function deleteCustomNode(nodeTitle: string): Promise<void> {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace found.')
            return
        }
        const confirmed = await vscode.window.showWarningMessage(`Delete custom node "${nodeTitle}"?`, { modal: true }, 'Delete')
        if (confirmed !== 'Delete') {
            return
        }
        const nodesDirUri = vscode.Uri.joinPath(workspaceRoot, NODES_DIR)
        const files = await vscode.workspace.fs.readDirectory(nodesDirUri)
        const nodeFile = files.find(([filename]) => filename.startsWith(sanitizeFilename(nodeTitle)))
        if (!nodeFile) {
            vscode.window.showErrorMessage(`Custom node with title "${nodeTitle}" not found.`)
            return
        }
        const fileUri = vscode.Uri.joinPath(nodesDirUri, nodeFile[0])
        await vscode.workspace.fs.delete(fileUri)
        vscode.window.showInformationMessage(`Custom node with title "${nodeTitle}" deleted successfully.`)
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to delete custom node: ${error?.message}`)
    }
}

export async function renameCustomNode(oldNodeTitle: string, newNodeTitle: string): Promise<void> {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace found.')
            return
        }
        const nodesDirUri = vscode.Uri.joinPath(workspaceRoot, NODES_DIR)
        const files = await vscode.workspace.fs.readDirectory(nodesDirUri)
        const oldNodeFile = files.find(([filename]) => filename.startsWith(sanitizeFilename(oldNodeTitle)))
        if (!oldNodeFile) {
            vscode.window.showErrorMessage(`Custom node with title "${oldNodeTitle}" not found.`)
            return
        }
        const oldFileUri = vscode.Uri.joinPath(nodesDirUri, oldNodeFile[0])
        const fileData = await vscode.workspace.fs.readFile(oldFileUri)
        const node = JSON.parse(fileData.toString()) as WorkflowNodes
        node.data.title = newNodeTitle
        const newFilename = `${sanitizeFilename(newNodeTitle)}.json`
        const newFileUri = vscode.Uri.joinPath(nodesDirUri, newFilename)
        const { id, ...nodeToSave } = node as any
        await vscode.workspace.fs.writeFile(newFileUri, Buffer.from(JSON.stringify(nodeToSave, null, 2), 'utf-8'))
        await vscode.workspace.fs.delete(oldFileUri)
        vscode.window.showInformationMessage(`Custom node "${oldNodeTitle}" renamed to "${newNodeTitle}" successfully.`)
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to rename custom node: ${error?.message}`)
    }
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}
