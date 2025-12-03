import {
    AbortedError,
    type ApprovalResult,
    type ExtensionToWorkflow,
    type WorkflowNodes,
} from '../../../Core/models'
import {
    expandHome,
    execute as shellExecute,
    executeCommandSpawn as shellExecuteCommandSpawn,
    executeScript as shellExecuteScript,
} from '../../../DataAccess/shell.js'
import type { IHostEnvironment, IMessagePort } from '../../../Shared/Host/index'
import { safePost } from '../../../Shared/Infrastructure/messaging/safePost'
import { combineParentOutputsByConnectionOrder } from '../../Core/execution/combine'
import { replaceIndexedInputs } from '../../Core/execution/inputs'
import { commandsNotAllowed, sanitizeForShell } from '../../Core/execution/sanitize'
import type { IndexedExecutionContext } from '../handlers/ExecuteWorkflow'

/**
 * Core CLI runner arguments.
 *
 * NOTE: runCLICore does not record exit-code metadata into any execution context.
 * Callers that need cliMetadata (for example, workflow runners) must write it
 * explicitly based on the returned exitCode.
 *
 * The optional context is read-only and used only for template evaluation.
 */
export interface CLICoreArgs {
    node: WorkflowNodes
    baseCommandOrScript: string
    mode: 'command' | 'script'
    inputs: string[]
    abortSignal: AbortSignal
    port: IMessagePort
    host: IHostEnvironment
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>
    context?: IndexedExecutionContext | Partial<IndexedExecutionContext>
}

export interface CLICoreResult {
    output: string
    exitCode: string
}

export async function runCLICore(args: CLICoreArgs): Promise<CLICoreResult> {
    const {
        node,
        baseCommandOrScript,
        mode,
        inputs,
        abortSignal,
        port,
        host,
        approvalHandler,
        context,
    } = args

    abortSignal.throwIfAborted()

    const base = baseCommandOrScript.toString()
    if (!base.trim()) {
        throw new Error('CLI Node requires a non-empty command/script')
    }

    let effective = base

    const cwd = host.workspace.workspaceFolders?.[0]
    if (!cwd) {
        void host.window.showInformationMessage(
            'No workspace folder found. CLI command will run in the extension process directory.'
        )
    }

    // Approval path (show script/command text)
    if ((node as any).data?.needsUserApproval) {
        await safePost(port, {
            type: 'node_execution_status',
            data: { nodeId: node.id, status: 'pending_approval', result: `${base}` },
        } as ExtensionToWorkflow)
        const approval = await approvalHandler(node.id)
        if (approval.type === 'aborted') {
            throw new AbortedError()
        }
        if (approval.type === 'approved' && typeof approval.command === 'string') {
            effective = approval.command
        }
    }

    // Safety level (default safe). In safe+command, apply denylist. In script mode, skip denylist.
    const safety: 'safe' | 'advanced' =
        ((node as any).data?.safetyLevel as any) === 'advanced' ? 'advanced' : 'safe'

    if (mode === 'script') {
        // Build stdin for script
        const stdinCfg = ((node as any).data?.stdin ?? {}) as {
            source?: 'none' | 'parents-all' | 'parent-index' | 'literal'
            parentIndex?: number
            literal?: string
            stripCodeFences?: boolean
            normalizeCRLF?: boolean
        }
        let stdinText: string | undefined
        const source = stdinCfg.source || 'none'
        if (source === 'parents-all') {
            stdinText = inputs.join('\n')
        } else if (source === 'parent-index') {
            const idx = Math.max(1, Number(stdinCfg.parentIndex || 1)) - 1
            stdinText = inputs[idx] ?? ''
        } else if (source === 'literal') {
            stdinText = replaceIndexedInputs(stdinCfg.literal || '', inputs, context as any)
        }
        if (stdinText != null) {
            const hasFences = /(\n|^)```/.test(stdinText)
            const shouldStrip =
                stdinCfg.stripCodeFences === true ||
                (stdinCfg.stripCodeFences === undefined && hasFences)
            if (shouldStrip) {
                stdinText = stdinText
                    .split('\n')
                    .filter(line => !/^```/.test(line))
                    .join('\n')
            }
            const hasCRLF = /\r\n/.test(stdinText)
            const shouldNormalize =
                (stdinCfg.normalizeCRLF !== false && hasCRLF) || stdinCfg.normalizeCRLF === true
            if (shouldNormalize) {
                stdinText = stdinText.replace(/\r\n/g, '\n')
            }
        }

        // Env mapping
        const envCfg = ((node as any).data?.env ?? {}) as {
            exposeParents?: boolean
            names?: string[]
            static?: Record<string, string>
        }
        const extraEnv: Record<string, string> = {}
        if (envCfg.exposeParents) {
            if (Array.isArray(envCfg.names) && envCfg.names.length > 0) {
                for (let i = 0; i < inputs.length && i < envCfg.names.length; i++) {
                    const k = envCfg.names[i]
                    if (k && typeof k === 'string') extraEnv[k] = inputs[i] ?? ''
                }
            } else {
                for (let i = 0; i < inputs.length; i++) {
                    extraEnv[`INPUT_${i + 1}`] = inputs[i] ?? ''
                }
            }
        }
        if (envCfg.static && typeof envCfg.static === 'object') {
            for (const [k, v] of Object.entries(envCfg.static)) {
                extraEnv[k] = replaceIndexedInputs(String(v ?? ''), inputs, context as any)
            }
        }

        // Shell and flags
        const shell =
            ((node as any).data?.shell as any) || (process.platform === 'win32' ? 'pwsh' : 'bash')
        const flags = ((node as any).data?.flags ?? {}) as any

        try {
            const { output, exitCode } = await shellExecuteScript({
                shell,
                flags: {
                    exitOnError: !!flags.exitOnError,
                    unsetVars: !!flags.unsetVars,
                    pipefail: !!flags.pipefail,
                    noProfile: flags.noProfile !== false,
                    nonInteractive: flags.nonInteractive !== false,
                    executionPolicyBypass: !!flags.executionPolicyBypass,
                },
                script: effective,
                stdinText,
                cwd,
                env: extraEnv,
                abortSignal,
            })
            if (exitCode !== '0' && (node as any).data?.shouldAbort) {
                throw new Error(output)
            }
            return { output, exitCode }
        } catch (error: unknown) {
            if (error instanceof AbortedError) {
                throw error
            }
            const errorMessage = error instanceof Error ? error.message : String(error)
            throw new Error(`CLI Node execution failed: ${errorMessage}`)
        }
    }

    // Command mode
    const filteredCommand = expandHome(effective) || ''

    if (safety !== 'advanced') {
        if (commandsNotAllowed.some(cmd => sanitizeForShell(filteredCommand).startsWith(cmd))) {
            void host.window.showErrorMessage('Command cannot be executed')
            throw new Error('Command cannot be executed')
        }
    }

    try {
        const userSpawn = Boolean((node as any).data?.streamOutput)
        const autoSpawn = !userSpawn && (filteredCommand.length > 200 || /[|><]/.test(filteredCommand))
        const runner = userSpawn || autoSpawn ? shellExecuteCommandSpawn : shellExecute
        const { output, exitCode } = await runner(filteredCommand, abortSignal, { cwd })
        if (exitCode !== '0' && (node as any).data?.shouldAbort) {
            throw new Error(output)
        }
        return { output, exitCode }
    } catch (error: unknown) {
        if (error instanceof AbortedError) {
            throw error
        }
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`CLI Node execution failed: ${errorMessage}`)
    }
}

export async function executeCLINode(
    node: WorkflowNodes,
    abortSignal: AbortSignal,
    port: IMessagePort,
    host: IHostEnvironment,
    approvalHandler: (nodeId: string) => Promise<ApprovalResult>,
    context?: IndexedExecutionContext
): Promise<string> {
    const inputs = combineParentOutputsByConnectionOrder(node.id, context)

    // Determine mode (command | script). Default to command for back-compat.
    const mode = ((node as any).data?.mode as 'command' | 'script') || 'command'

    // Base content after templating
    const baseContent = (
        node.data.content ? replaceIndexedInputs(node.data.content, inputs, context) : ''
    ).toString()

    const { output, exitCode } = await runCLICore({
        node,
        baseCommandOrScript: baseContent,
        mode,
        inputs,
        abortSignal,
        port,
        host,
        approvalHandler,
        context,
    })

    context?.cliMetadata?.set(node.id, { exitCode })

    return output
}
