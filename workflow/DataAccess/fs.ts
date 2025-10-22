import * as path from 'node:path'
import * as vscode from 'vscode'
import type { WorkflowPayloadDTO } from '../Core/Contracts/Protocol'
import { isWorkflowPayloadDTO } from '../Core/Contracts/guards'
import { NodeType, type WorkflowNodes } from '../Core/models'

const PERSISTENCE_ROOT = '.nebulaflow'
const LEGACY_PERSISTENCE_ROOT = '.sourcegraph'
const WORKFLOWS_DIR = `${PERSISTENCE_ROOT}/workflows`
const NODES_DIR = `${PERSISTENCE_ROOT}/nodes`
const LEGACY_WORKFLOWS_DIR = `${LEGACY_PERSISTENCE_ROOT}/workflows`
const LEGACY_NODES_DIR = `${LEGACY_PERSISTENCE_ROOT}/nodes`

function isValidPosition(v: any): v is { x: number; y: number } {
    return v && typeof v.x === 'number' && typeof v.y === 'number'
}

function isValidCustomNode(n: any): n is WorkflowNodes {
    return (
        n &&
        typeof n === 'object' &&
        typeof n.type === 'string' &&
        Object.values(NodeType).includes(n.type) &&
        n.data &&
        typeof n.data.title === 'string' &&
        n.data.title.length > 0 &&
        isValidPosition(n.position)
    )
}

function isSupportedVersion(version: unknown): boolean {
    if (version === undefined) return true
    if (typeof version !== 'string') return false
    if (version === '1.0.0') return true
    // Accept any 1.x.x version
    const match = /^1\.\d+\.\d+$/.exec(version)
    return match !== null
}

// Normalize LLM node model IDs to SDK keys for save/load robustness
function normalizeModelsInWorkflow(data: WorkflowPayloadDTO): WorkflowPayloadDTO {
    try {
        // Dynamically require the SDK so the extension still works if it's not linked
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sdk = require('@sourcegraph/amp-sdk') as any
        const resolveModel:
            | ((args: { key: string } | { displayName: string; provider?: unknown }) => { key: string })
            | undefined = sdk?.resolveModel
        if (typeof resolveModel !== 'function') {
            return data
        }
        const nodes = (data.nodes ?? []).map(node => {
            if (!node || typeof node !== 'object' || (node as any).type !== 'llm') return node
            const n: any = node
            const model = n.data?.model
            const id = model?.id
            if (!id || typeof id !== 'string') return node
            try {
                // First try resolving as a key
                const r1 = resolveModel({ key: id })
                if (r1?.key && r1.key !== id) {
                    return { ...node, data: { ...n.data, model: { ...model, id: r1.key } } }
                }
                // If key resolution didn't change anything, also allow displayName resolution
                try {
                    const r2 = resolveModel({ displayName: id })
                    if (r2?.key && r2.key !== id) {
                        return { ...node, data: { ...n.data, model: { ...model, id: r2.key } } }
                    }
                } catch {}
            } catch {}
            return node
        })
        return { ...data, nodes }
    } catch {
        return data
    }
}

export async function saveWorkflow(
    data: WorkflowPayloadDTO
): Promise<{ uri: vscode.Uri } | { error: string } | null> {
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
            const parent = vscode.Uri.file(path.dirname(result.fsPath))
            try {
                await vscode.workspace.fs.createDirectory(parent)
            } catch (dirError) {
                const errorMsg = dirError instanceof Error ? dirError.message : String(dirError)
                console.error('Failed to create workflow directory', {
                    parent: parent.fsPath,
                    error: errorMsg,
                })
                void vscode.window.showErrorMessage('Failed to create workflow directory')
                return { error: 'mkdir failed' }
            }
            const normalized = normalizeModelsInWorkflow(data)
            const content = Buffer.from(
                JSON.stringify({ ...normalized, version: '1.0.0' }, null, 2),
                'utf-8'
            )
            await vscode.workspace.fs.writeFile(result, content)
            void vscode.window.showInformationMessage('Workflow saved successfully!')
            return { uri: result }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            void vscode.window.showErrorMessage(`Failed to save workflow: ${errorMsg}`)
            return { error: errorMsg }
        }
    }
    return null
}

export async function loadWorkflow(): Promise<{ dto: WorkflowPayloadDTO; uri: vscode.Uri } | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri
    const workspaceRootFsPath = workspaceRoot?.path
    const defaultFilePath = workspaceRootFsPath
        ? vscode.Uri.joinPath(workspaceRoot, WORKFLOWS_DIR)
        : vscode.Uri.file('workflow.json')

    // Migrate from legacy if new dir is empty
    if (workspaceRoot) {
        try {
            const workflowsDirUri = vscode.Uri.joinPath(workspaceRoot, WORKFLOWS_DIR)
            let filesInNew: [string, vscode.FileType][] = []
            try {
                filesInNew = await vscode.workspace.fs.readDirectory(workflowsDirUri)
            } catch {}
            if (filesInNew.length === 0) {
                await migrateFromLegacy(workspaceRoot, LEGACY_WORKFLOWS_DIR, WORKFLOWS_DIR)
            }
        } catch {}
    }

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

            // Validate version (lenient)
            if (!isSupportedVersion(data.version)) {
                void vscode.window.showErrorMessage('Unsupported workflow file version')
                return null
            }

            // Validate minimal schema
            if (!isWorkflowPayloadDTO(data)) {
                void vscode.window.showErrorMessage('Invalid workflow schema')
                return null
            }

            void vscode.window.showInformationMessage('Workflow loaded successfully!')
            const dto = normalizeModelsInWorkflow(data)
            return { dto, uri: result[0] }
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
        try {
            await vscode.workspace.fs.createDirectory(nodesDirUri)
        } catch {}

        // Migrate from legacy if new dir is empty
        try {
            const filesInNew = await vscode.workspace.fs.readDirectory(nodesDirUri)
            if (filesInNew.length === 0) {
                await migrateFromLegacy(workspaceRoot, LEGACY_NODES_DIR, NODES_DIR)
            }
        } catch {}

        const files = await vscode.workspace.fs.readDirectory(nodesDirUri)
        const nodes: WorkflowNodes[] = []
        for (const [filename, fileType] of files) {
            if (fileType === vscode.FileType.File && filename.endsWith('.json')) {
                try {
                    const fileUri = vscode.Uri.joinPath(nodesDirUri, filename)
                    const fileData = await vscode.workspace.fs.readFile(fileUri)
                    const node = JSON.parse(fileData.toString())
                    if (!isValidCustomNode(node)) {
                        console.error(`Invalid custom node schema in "${filename}"`)
                        vscode.window.showErrorMessage(
                            `Invalid custom node schema in "${filename}": missing type, title, or position`
                        )
                        continue
                    }
                    const normalizedNode: WorkflowNodes = {
                        ...node,
                        id: 'custom:' + sanitizeFilename(node.data.title),
                    }
                    nodes.push(normalizedNode)
                } catch (error: any) {
                    console.error(`Failed to load custom node "${filename}": ${error?.message}`)
                    vscode.window.showErrorMessage(
                        `Failed to load custom node "${filename}": ${error?.message}`
                    )
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
        try {
            await vscode.workspace.fs.createDirectory(nodesDirUri)
        } catch {}
        const fileUri = getNodeFileUri(workspaceRoot, node.data.title)
        if (await fileExists(fileUri)) {
            const confirmed = await vscode.window.showWarningMessage(
                `A custom node named "${node.data.title}" already exists. Overwrite?`,
                { modal: true },
                'Overwrite'
            )
            if (confirmed !== 'Overwrite') {
                return
            }
        }
        const { id, ...nodeToSave } = node as any
        await vscode.workspace.fs.writeFile(
            fileUri,
            Buffer.from(JSON.stringify(nodeToSave, null, 2), 'utf-8')
        )
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
        const fileUri = getNodeFileUri(workspaceRoot, nodeTitle)
        if (!(await fileExists(fileUri))) {
            vscode.window.showErrorMessage(`Custom node with title "${nodeTitle}" not found.`)
            return
        }
        const confirmed = await vscode.window.showWarningMessage(
            `Delete custom node "${nodeTitle}"?`,
            { modal: true },
            'Delete'
        )
        if (confirmed !== 'Delete') {
            return
        }
        await vscode.workspace.fs.delete(fileUri)
        vscode.window.showInformationMessage(
            `Custom node with title "${nodeTitle}" deleted successfully.`
        )
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
        const oldFileUri = getNodeFileUri(workspaceRoot, oldNodeTitle)
        if (!(await fileExists(oldFileUri))) {
            vscode.window.showErrorMessage(`Custom node with title "${oldNodeTitle}" not found.`)
            return
        }
        const fileData = await vscode.workspace.fs.readFile(oldFileUri)
        const node = JSON.parse(fileData.toString()) as WorkflowNodes
        node.data.title = newNodeTitle
        const newFileUri = getNodeFileUri(workspaceRoot, newNodeTitle)
        if (newFileUri.fsPath !== oldFileUri.fsPath && (await fileExists(newFileUri))) {
            const confirmed = await vscode.window.showWarningMessage(
                `A custom node named "${newNodeTitle}" already exists. Overwrite?`,
                { modal: true },
                'Overwrite'
            )
            if (confirmed !== 'Overwrite') {
                return
            }
        }
        const { id, ...nodeToSave } = node as any
        await vscode.workspace.fs.writeFile(
            newFileUri,
            Buffer.from(JSON.stringify(nodeToSave, null, 2), 'utf-8')
        )
        if (newFileUri.fsPath !== oldFileUri.fsPath) {
            await vscode.workspace.fs.delete(oldFileUri)
        }
        vscode.window.showInformationMessage(
            `Custom node "${oldNodeTitle}" renamed to "${newNodeTitle}" successfully.`
        )
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to rename custom node: ${error?.message}`)
    }
}

async function migrateFromLegacy(
    workspaceRoot: vscode.Uri,
    legacyPath: string,
    newPath: string
): Promise<boolean> {
    try {
        const legacyUri = vscode.Uri.joinPath(workspaceRoot, legacyPath)
        const newUri = vscode.Uri.joinPath(workspaceRoot, newPath)
        if (await fileExists(legacyUri)) {
            try {
                await vscode.workspace.fs.createDirectory(
                    vscode.Uri.joinPath(workspaceRoot, PERSISTENCE_ROOT)
                )
            } catch {}
            const files = await vscode.workspace.fs.readDirectory(legacyUri)
            for (const [filename] of files) {
                const legacyFileUri = vscode.Uri.joinPath(legacyUri, filename)
                const newFileUri = vscode.Uri.joinPath(newUri, filename)
                const content = await vscode.workspace.fs.readFile(legacyFileUri)
                try {
                    await vscode.workspace.fs.createDirectory(newUri)
                } catch {}
                await vscode.workspace.fs.writeFile(newFileUri, content)
            }
            return true
        }
    } catch {}
    return false
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri)
        return true
    } catch {
        return false
    }
}

function getNodeFileUri(workspaceRoot: vscode.Uri, title: string): vscode.Uri {
    const nodesDirUri = vscode.Uri.joinPath(workspaceRoot, NODES_DIR)
    const filename = `${sanitizeFilename(title)}.json`
    return vscode.Uri.joinPath(nodesDirUri, filename)
}
