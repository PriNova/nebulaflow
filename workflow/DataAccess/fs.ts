import * as os from 'node:os'
import * as path from 'node:path'
import type { WorkflowPayloadDTO } from '../Core/Contracts/Protocol'
import { isWorkflowPayloadDTO } from '../Core/Contracts/guards'
import { NodeType, type WorkflowNodes } from '../Core/models'
import { FileType, type IHostEnvironment } from '../Shared/Host/index'
import { DEFAULT_LLM_MODEL_ID, DEFAULT_LLM_MODEL_TITLE } from '../Shared/LLM/default-model'
import { migrateAmpModelId } from '../PiIntegration/Application/pi-models'

const PERSISTENCE_ROOT = '.nebulaflow'
const LEGACY_PERSISTENCE_ROOT = '.sourcegraph'
const WORKFLOWS_DIR = `${PERSISTENCE_ROOT}/workflows`
const NODES_DIR = `${PERSISTENCE_ROOT}/nodes`
const SUBFLOWS_DIR = `${PERSISTENCE_ROOT}/subflows`
const LAST_WORKFLOW_META = `${PERSISTENCE_ROOT}/last-workflow.json`

const LEGACY_WORKFLOWS_DIR = `${LEGACY_PERSISTENCE_ROOT}/workflows`
const LEGACY_NODES_DIR = `${LEGACY_PERSISTENCE_ROOT}/nodes`

let host: IHostEnvironment | undefined

export function initializeHost(h: IHostEnvironment) {
    host = h
}

function getHost(): IHostEnvironment {
    if (!host) throw new Error('Host environment not initialized')
    return host
}

function getConfig() {
    const h = getHost()
    const storageScope = (
        h.workspace.getConfiguration<string>('nebulaFlow.storageScope', 'user') === 'workspace'
            ? 'workspace'
            : 'user'
    )
    const globalStoragePath = h.workspace.getConfiguration('nebulaFlow.globalStoragePath', '')
    const baseGlobal =
        globalStoragePath && path.isAbsolute(globalStoragePath) ? globalStoragePath : os.homedir()
    return { storageScope, baseGlobal }
}

function getRootForScope(): { scope: 'workspace' | 'user'; root?: string } {
    const { storageScope, baseGlobal } = getConfig()
    const h = getHost()
    if (storageScope === 'workspace') {
        const ws = h.workspace.workspaceFolders?.[0]
        return { scope: 'workspace', root: ws }
    }
    return { scope: 'user', root: baseGlobal }
}

function isValidPosition(v: unknown): v is { x: number; y: number } {
    return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).x === 'number' && typeof (v as Record<string, unknown>).y === 'number'
}

type UnknownRecord = Record<string, unknown>

function isValidCustomNode(n: unknown): n is WorkflowNodes {
    if (typeof n !== 'object' || n === null) return false
    const obj = n as UnknownRecord
    if (typeof obj.type !== 'string' || !Object.values(NodeType).includes(obj.type as NodeType)) return false
    if (typeof obj.data !== 'object' || obj.data === null) return false
    const data = obj.data as UnknownRecord
    if (typeof data.title !== 'string' || data.title.length === 0) return false
    if (typeof obj.position !== 'object' || obj.position === null) return false
    return isValidPosition(obj.position)
}

function isSupportedVersion(version: unknown): boolean {
    if (version === undefined) return true
    if (typeof version !== 'string') return false
    if (version === '1.0.0') return true
    // Accept any 1.x.x version
    const match = /^1\.\d+\.\d+$/.exec(version)
    return match !== null
}

// ----- Subflows FS helpers -----
import type { SubflowDefinitionDTO } from '../Core/models'

function getSubflowFileUri(root: string, id: string): string {
    const dir = path.join(root, SUBFLOWS_DIR)
    const fname = `${sanitizeFilename(id)}.json`
    return path.join(dir, fname)
}

export async function saveSubflow(
    def: SubflowDefinitionDTO
): Promise<{ id: string } | { error: string }> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return { error: 'no-root' }
        }
        const dir = path.join(root, SUBFLOWS_DIR)
        try {
            await h.fs.createDirectory(dir)
        } catch {}
        const id = def.id || cryptoRandomId()
        const file = getSubflowFileUri(root, id)
        const data = { ...def, id }
        await h.fs.writeFile(file, Buffer.from(JSON.stringify(data, null, 2), 'utf-8'))
        return { id }
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'save-failed'
        return { error: errMsg }
    }
}

export async function loadSubflow(id: string): Promise<SubflowDefinitionDTO | null> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return null
        }
        const file = getSubflowFileUri(root, id)
        const bytes = await h.fs.readFile(file)
        const def = JSON.parse(Buffer.from(bytes).toString('utf-8')) as SubflowDefinitionDTO
        return def
    } catch {
        return null
    }
}

export async function getSubflows(): Promise<
    Array<Pick<SubflowDefinitionDTO, 'id' | 'title' | 'version'>>
> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return []
        }
        const dir = path.join(root, SUBFLOWS_DIR)
        try {
            await h.fs.createDirectory(dir)
        } catch {}

        let items: [string, FileType][] = []
        try {
            items = await h.fs.readDirectory(dir)
        } catch {
            return []
        }

        const out: Array<Pick<SubflowDefinitionDTO, 'id' | 'title' | 'version'>> = []
        for (const [filename, type] of items) {
            if (type !== FileType.File || !filename.endsWith('.json')) continue
            try {
                const file = path.join(dir, filename)
                const bytes = await h.fs.readFile(file)
                const def = JSON.parse(Buffer.from(bytes).toString('utf-8')) as SubflowDefinitionDTO
                // Handle missing title gracefully
                const title = def.title || def.id || filename.replace('.json', '')
                out.push({ id: def.id, title, version: def.version })
            } catch {}
        }
        return out
    } catch {
        return []
    }
}

function cryptoRandomId(): string {
    try {
        const array = new Uint8Array(16)
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const cryptoModule = require('node:crypto') as { webcrypto: any }
        const cryptoSource = globalThis.crypto || cryptoModule.webcrypto
        cryptoSource.getRandomValues(array)
        return Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
    } catch {
        return `${Date.now()}_${Math.random().toString(36).slice(2)}`
    }
}

// Normalize LLM node model IDs for save/load robustness.
// Migrates legacy Amp SDK model IDs to pi-compatible format.
async function normalizeModelsInWorkflow(data: WorkflowPayloadDTO): Promise<WorkflowPayloadDTO> {
    try {
        const nodes = await Promise.all(
            (data.nodes ?? []).map(async (node) => {
                if (!node || typeof node !== 'object' || (node as unknown as UnknownRecord).type !== 'llm') return node
                const n = node as unknown as UnknownRecord
                const nodeData = (n.data as UnknownRecord | undefined) ?? {}
                let model = nodeData.model as { id?: string; provider?: string; title?: string } | undefined

                if (!model || typeof model.id !== 'string') {
                    model = { id: DEFAULT_LLM_MODEL_ID, provider: DEFAULT_LLM_MODEL_ID.split('/')[0], title: DEFAULT_LLM_MODEL_TITLE }
                }

                const id = model.id

                // Attempt migration from Amp SDK model ID to pi format
                const migratedId = id ? await migrateAmpModelId(id) : undefined
                if (migratedId && migratedId !== id) {
                    return { ...node, data: { ...nodeData, model: { ...model, id: migratedId } } }
                }

                return { ...node, data: { ...nodeData, model } }
            })
        )
        return { ...data, nodes }
    } catch {
        return data
    }
}

type LastWorkflowMeta = {
    uri: string // Stores the path string
}

async function setLastWorkflowUri(uri: string): Promise<void> {
    try {
        const h = getHost()
        const { root } = getRootForScope()
        if (!root) return

        const metaDir = path.join(root, PERSISTENCE_ROOT)
        const metaUri = path.join(root, LAST_WORKFLOW_META)

        try {
            await h.fs.createDirectory(metaDir)
        } catch {}

        const payload: LastWorkflowMeta = { uri }
        const content = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8')
        await h.fs.writeFile(metaUri, content)
    } catch {
        // Best-effort
    }
}

async function getLastWorkflowUri(): Promise<string | null> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) return null

        const metaUri = path.join(root, LAST_WORKFLOW_META)
        const bytes = await h.fs.readFile(metaUri)
        const parsed = JSON.parse(Buffer.from(bytes).toString('utf-8')) as Partial<LastWorkflowMeta>

        if (!parsed.uri || typeof parsed.uri !== 'string') {
            return null
        }

        const uri = parsed.uri

        if (scope === 'workspace') {
            // Check if URI is within any workspace folder
            const isInWorkspace = h.workspace.workspaceFolders.some(folder => uri.startsWith(folder))
            if (!isInWorkspace) {
                return null
            }
        }

        // Ensure exists
        if (!(await h.fs.exists(uri))) {
            return null
        }
        return uri
    } catch {
        return null
    }
}

async function readWorkflowFromUri(
    uri: string,
    opts: { interactive: boolean }
): Promise<WorkflowPayloadDTO | null> {
    try {
        const h = getHost()
        const content = await h.fs.readFile(uri)
        const data = JSON.parse(Buffer.from(content).toString('utf-8')) as UnknownRecord

        if (!isSupportedVersion(data.version)) {
            if (opts.interactive) {
                void h.window.showErrorMessage('Unsupported workflow file version')
            }
            return null
        }

        const { version: _version, ...payloadData } = data
        if (!isWorkflowPayloadDTO(payloadData)) {
            if (opts.interactive) {
                void h.window.showErrorMessage('Invalid workflow schema')
            }
            return null
        }

        return await normalizeModelsInWorkflow({
            ...payloadData,
            state: payloadData.state as WorkflowPayloadDTO['state'],
        })
    } catch (error) {
        if (opts.interactive) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            void getHost().window.showErrorMessage(`Failed to load workflow: ${errorMsg}`)
        }
        return null
    }
}

export async function saveWorkflow(
    data: WorkflowPayloadDTO
): Promise<{ uri: string } | { error: string } | null> {
    const h = getHost()
    const { root } = getRootForScope()
    const defaultFilePath = root ? path.join(root, WORKFLOWS_DIR + '/workflow.json') : 'workflow.json'

    const result = await h.window.showSaveDialog({
        defaultUri: defaultFilePath,
        filters: { 'Workflow Files': ['json'] },
        saveLabel: 'Save Workflow',
    })

    if (result) {
        try {
            const parent = path.dirname(result)
            try {
                await h.fs.createDirectory(parent)
            } catch (dirError) {
                const errorMsg = dirError instanceof Error ? dirError.message : String(dirError)
                // eslint-disable-next-line no-console
                console.error('Failed to create workflow directory', {
                    parent,
                    error: errorMsg,
                })
                void h.window.showErrorMessage('Failed to create workflow directory')
                return { error: 'mkdir failed' }
            }
            const normalized = await normalizeModelsInWorkflow(data)
            const version = '1.1.0'
            const content = Buffer.from(JSON.stringify({ ...normalized, version }, null, 2), 'utf-8')
            await h.fs.writeFile(result, content)
            void h.window.showInformationMessage('Workflow saved successfully!')
            await setLastWorkflowUri(result)
            return { uri: result }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            void h.window.showErrorMessage(`Failed to save workflow: ${errorMsg}`)
            return { error: errorMsg }
        }
    }
    return null
}

export async function loadWorkflow(): Promise<{ dto: WorkflowPayloadDTO; uri: string } | null> {
    const h = getHost()
    const { scope, root } = getRootForScope()
    const defaultFilePath = root ? path.join(root, WORKFLOWS_DIR) : 'workflow.json'

    // Migrate from legacy if new dir is empty (workspace scope only)
    if (scope === 'workspace' && root) {
        try {
            const workflowsDir = path.join(root, WORKFLOWS_DIR)
            let filesInNew: [string, FileType][] = []
            try {
                filesInNew = await h.fs.readDirectory(workflowsDir)
            } catch {}
            if (filesInNew.length === 0) {
                await migrateFromLegacy(root, LEGACY_WORKFLOWS_DIR, WORKFLOWS_DIR)
            }
        } catch {}
    }

    const result = await h.window.showOpenDialog({
        defaultUri: defaultFilePath,
        canSelectMany: false,
        filters: { 'Workflow Files': ['json'] },
    })

    if (result?.[0]) {
        const dto = await readWorkflowFromUri(result[0], { interactive: true })
        if (!dto) {
            return null
        }

        void h.window.showInformationMessage('Workflow loaded successfully!')
        await setLastWorkflowUri(result[0])
        return { dto, uri: result[0] }
    }
    return null
}

export async function loadLastWorkflow(): Promise<{ dto: WorkflowPayloadDTO; uri: string } | null> {
    const uri = await getLastWorkflowUri()
    if (!uri) return null

    const dto = await readWorkflowFromUri(uri, { interactive: false })
    if (!dto) return null

    return { dto, uri }
}

export async function getCustomNodes(): Promise<WorkflowNodes[]> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return []
        }
        const nodesDir = path.join(root, NODES_DIR)
        try {
            await h.fs.createDirectory(nodesDir)
        } catch {}

        // Migrate from legacy if new dir is empty (workspace scope only)
        if (scope === 'workspace') {
            try {
                const filesInNew = await h.fs.readDirectory(nodesDir)
                if (filesInNew.length === 0) {
                    await migrateFromLegacy(root, LEGACY_NODES_DIR, NODES_DIR)
                }
            } catch {}
        }

        const files = await h.fs.readDirectory(nodesDir)
        const nodes: WorkflowNodes[] = []
        for (const [filename, fileType] of files) {
            if (fileType === FileType.File && filename.endsWith('.json')) {
                try {
                    const fileUri = path.join(nodesDir, filename)
                    const fileData = await h.fs.readFile(fileUri)
                    const node = JSON.parse(Buffer.from(fileData).toString('utf-8')) as unknown
                    if (!isValidCustomNode(node)) {
                        // eslint-disable-next-line no-console
                        console.error(`Invalid custom node schema in "${filename}"`)
                        void h.window.showErrorMessage(
                            `Invalid custom node schema in "${filename}": missing type, title, or position`
                        )
                        continue
                    }
                    const normalizedNode: WorkflowNodes = {
                        ...node,
                        id: 'custom:' + sanitizeFilename(node.data.title),
                    }
                    nodes.push(normalizedNode)
                } catch (error: unknown) {
                    const errMsg = error instanceof Error ? error.message : String(error)
                    // eslint-disable-next-line no-console
                    console.error(`Failed to load custom node "${filename}": ${errMsg}`)
                    void h.window.showErrorMessage(
                        `Failed to load custom node "${filename}": ${errMsg}`
                    )
                }
            }
        }
        return nodes
    } catch (error: unknown) {
        const h = getHost()
        const errMsg = error instanceof Error ? error.message : String(error)
        // eslint-disable-next-line no-console
        console.error(`Failed to load custom nodes: ${errMsg}`, error)
        void h.window.showErrorMessage(`Failed to load custom nodes: ${errMsg}`)
        return []
    }
}

export async function saveCustomNode(node: WorkflowNodes): Promise<void> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return
        }
        const nodesDir = path.join(root, NODES_DIR)
        try {
            await h.fs.createDirectory(nodesDir)
        } catch {}

        const fileUri = getNodeFileUri(root, node.data.title)
        void h.fs.exists(fileUri)
        // Overwrite without confirmation for now

        const { id: _unused, ...nodeToSave } = node
        await h.fs.writeFile(fileUri, Buffer.from(JSON.stringify(nodeToSave, null, 2), 'utf-8'))
        void h.window.showInformationMessage(`Custom node "${node.data.title}" saved successfully.`)
    } catch (error: unknown) {
        const h = getHost()
        const errMsg = error instanceof Error ? error.message : String(error)
        void h.window.showErrorMessage(`Failed to save custom node: ${errMsg}`)
    }
}

export async function deleteCustomNode(nodeTitle: string): Promise<void> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return
        }
        const fileUri = getNodeFileUri(root, nodeTitle)
        if (!(await h.fs.exists(fileUri))) {
            void h.window.showErrorMessage(`Custom node with title "${nodeTitle}" not found.`)
            return
        }
        // Skip confirmation for now (see above)
        await h.fs.delete(fileUri)
        void h.window.showInformationMessage(
            `Custom node with title "${nodeTitle}" deleted successfully.`
        )
    } catch (error: unknown) {
        const h = getHost()
        const errMsg = error instanceof Error ? error.message : String(error)
        void h.window.showErrorMessage(`Failed to delete custom node: ${errMsg}`)
    }
}

export async function renameCustomNode(oldNodeTitle: string, newNodeTitle: string): Promise<void> {
    try {
        const h = getHost()
        const { scope, root } = getRootForScope()
        if (!root) {
            void h.window.showErrorMessage(
                scope === 'workspace' ? 'No workspace found.' : 'Invalid global storage path.'
            )
            return
        }
        const oldFileUri = getNodeFileUri(root, oldNodeTitle)
        if (!(await h.fs.exists(oldFileUri))) {
            void h.window.showErrorMessage(`Custom node with title "${oldNodeTitle}" not found.`)
            return
        }
        const fileData = await h.fs.readFile(oldFileUri)
        const node = JSON.parse(Buffer.from(fileData).toString('utf-8')) as WorkflowNodes
        node.data.title = newNodeTitle
        const newFileUri = getNodeFileUri(root, newNodeTitle)

        if (newFileUri !== oldFileUri && (await h.fs.exists(newFileUri))) {
            // Skip confirmation
        }

        const { id: _unused, ...nodeToSave } = node
        await h.fs.writeFile(newFileUri, Buffer.from(JSON.stringify(nodeToSave, null, 2), 'utf-8'))
        if (newFileUri !== oldFileUri) {
            await h.fs.delete(oldFileUri)
        }
        void h.window.showInformationMessage(
            `Custom node "${oldNodeTitle}" renamed to "${newNodeTitle}" successfully.`
        )
    } catch (error: unknown) {
        const h = getHost()
        const errMsg = error instanceof Error ? error.message : String(error)
        void h.window.showErrorMessage(`Failed to rename custom node: ${errMsg}`)
    }
}

async function migrateFromLegacy(
    workspaceRoot: string,
    legacyPath: string,
    newPath: string
): Promise<boolean> {
    try {
        const h = getHost()
        const legacyUri = path.join(workspaceRoot, legacyPath)
        const newUri = path.join(workspaceRoot, newPath)
        if (await h.fs.exists(legacyUri)) {
            try {
                await h.fs.createDirectory(path.join(workspaceRoot, PERSISTENCE_ROOT))
            } catch {}
            const files = await h.fs.readDirectory(legacyUri)
            for (const [filename] of files) {
                const legacyFileUri = path.join(legacyUri, filename)
                const newFileUri = path.join(newUri, filename)
                const content = await h.fs.readFile(legacyFileUri)
                try {
                    await h.fs.createDirectory(newUri)
                } catch {}
                await h.fs.writeFile(newFileUri, content)
            }
            return true
        }
    } catch {}
    return false
}

function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function getNodeFileUri(root: string, title: string): string {
    const nodesDir = path.join(root, NODES_DIR)
    const filename = `${sanitizeFilename(title)}.json`
    return path.join(nodesDir, filename)
}
