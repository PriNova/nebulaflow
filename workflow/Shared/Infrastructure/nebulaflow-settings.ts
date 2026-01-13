import * as fs from 'node:fs/promises'
import * as nodePath from 'node:path'
import type { IHostEnvironment } from '../Host/index'

export interface NebulaflowSettingsReadOptions {
    warnOnError?: boolean
    debugTag?: string
}

async function readNebulaflowSettingsFromRoot(
    root: string,
    options?: NebulaflowSettingsReadOptions
): Promise<Record<string, unknown>> {
    const trimmedRoot = typeof root === 'string' ? root.trim() : ''
    if (!trimmedRoot) {
        return {}
    }

    const settingsPath = nodePath.join(trimmedRoot, '.nebulaflow', 'settings.json')

    const warn = (message: string, error?: unknown) => {
        if (!options?.warnOnError) return
        const tag = options.debugTag ?? 'nebulaflow-settings'
        const reason = error instanceof Error ? error.message : error ? String(error) : ''
        const suffix = reason ? `: ${reason}` : ''
        console.warn(
            `[${tag}] Ignoring .nebulaflow/settings.json at ${settingsPath} ${message}${suffix}`
        )
    }

    try {
        const raw = await fs.readFile(settingsPath, 'utf8')
        let parsed: any
        try {
            parsed = JSON.parse(raw)
        } catch (error) {
            warn('due to invalid JSON', error)
            return {}
        }

        if (!parsed || typeof parsed !== 'object') {
            warn('because the root value is not an object')
            return {}
        }

        const nebulaflowSection = (parsed as any).nebulaflow
        if (!nebulaflowSection || typeof nebulaflowSection !== 'object') {
            warn('because it does not contain a valid "nebulaflow" object')
            return {}
        }

        const nebulaflowSettings = (nebulaflowSection as any).settings
        if (!nebulaflowSettings || typeof nebulaflowSettings !== 'object') {
            warn('because it does not contain a valid "nebulaflow.settings" object')
            return {}
        }

        return { ...nebulaflowSettings }
    } catch (error) {
        warn('because it could not be read', error)
        return {}
    }
}

export async function readNebulaflowSettingsFromWorkspaceRoots(
    workspaceRoots: string[],
    options?: NebulaflowSettingsReadOptions
): Promise<Record<string, unknown>> {
    if (!Array.isArray(workspaceRoots) || workspaceRoots.length === 0) {
        return {}
    }

    const firstRoot = workspaceRoots[0]
    return readNebulaflowSettingsFromRoot(firstRoot, options)
}

export async function readNebulaflowSettingsFromHost(
    host: IHostEnvironment,
    options?: NebulaflowSettingsReadOptions
): Promise<Record<string, unknown>> {
    const roots = host.workspace.workspaceFolders
    if (!Array.isArray(roots) || roots.length === 0) {
        return {}
    }

    const firstRoot = roots[0]
    return readNebulaflowSettingsFromRoot(firstRoot, options)
}
