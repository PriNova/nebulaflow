import { CombinedPreviewEditorModal } from '@modals/CombinedPreviewEditorModal'
import { NodeType, type WorkflowNodes, formatNodeTitle } from '@nodes/Nodes'
import { CopyToClipboardButton } from '@shared/CopyToClipboardButton'
import { Markdown } from '@shared/Markdown'
import RunFromHereButton from '@shared/RunFromHereButton'
import RunOnlyThisButton from '@shared/RunOnlyThisButton'
import clsx from 'clsx'
import {
    CircleCheck,
    CircleX,
    Eye,
    Loader2Icon,
    Maximize2,
    Menu,
    Minimize2,
    RotateCcw,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AssistantContentItem } from '../../../Core/models'
import { resolveToolName } from '../../services/toolNames'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../../ui/shadcn/ui/accordion'
import styles from '../../ui/shadcn/ui/accordion.module.css'
import { Button } from '../../ui/shadcn/ui/button'
import { Textarea } from '../../ui/shadcn/ui/textarea'
import type { SelectionSummary } from '../hooks/selectionHandling'

function getLatestTokensPercent(items: AssistantContentItem[]): number | null {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]
        if (it.type === 'tool_result' && it.resultJSON) {
            try {
                const obj = JSON.parse(it.resultJSON)
                const p = obj?.tokens?.percent
                if (typeof p === 'number' && !Number.isNaN(p)) return p
                if (typeof p === 'string') {
                    const n = Number(p)
                    if (!Number.isNaN(n)) return n
                }
            } catch {
                // ignore parse errors (e.g., truncated JSON)
            }
        }
    }
    return null
}

function formatPercentLabel(p: number): string {
    const s = p
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1')
    return `${s} %`
}

// When an LLM node finishes a round, hide the last assistant text when it
// exactly matches the Result so the latest answer only appears in the Result.
// On the next run (e.g., follow-up chat), that text becomes part of the
// timeline again because it is no longer the last assistant message.
function getAssistantDisplayItems(
    items: AssistantContentItem[],
    options: { isExecuting: boolean; resultText: string | undefined }
): AssistantContentItem[] {
    const { isExecuting, resultText } = options

    // While the node is still executing (streaming), always show all items.
    if (isExecuting) return items

    if (!resultText) return items
    const normalize = (s: string): string => s.trim()
    const normalizedResult = normalize(resultText)
    if (!normalizedResult) return items

    // Find the last assistant text item, if any.
    let lastTextIndex = -1
    let lastTextItem: Extract<AssistantContentItem, { type: 'text' }> | null = null
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]
        if (it.type === 'text') {
            lastTextIndex = i
            lastTextItem = it
            break
        }
    }
    if (lastTextIndex === -1 || !lastTextItem) return items

    const assistantText = lastTextItem.text
    if (normalize(assistantText) !== normalizedResult) return items

    // Remove only the last assistant text item; earlier ones remain visible.
    return items.filter((_, index) => index !== lastTextIndex)
}

function getToolRunStatus(resultJSON?: string): string | null {
    if (!resultJSON) return null
    try {
        const obj = JSON.parse(resultJSON)
        const status = (obj?.status ?? obj?.run?.status) as unknown
        if (typeof status === 'string') return status
        return null
    } catch {
        return null
    }
}

function hasToolRunError(resultJSON?: string): boolean {
    if (!resultJSON) return false
    try {
        const obj = JSON.parse(resultJSON)
        const status = (obj?.status ?? obj?.run?.status) as unknown
        const err = (obj?.error ?? obj?.run?.error) as unknown
        if (err !== null && typeof err === 'object') return true
        if (typeof status === 'string') {
            const s = status.toLowerCase()
            if (s === 'error' || s === 'failed') return true
        }
        return false
    } catch {
        return false
    }
}

interface RightSidebarProps {
    sortedNodes: WorkflowNodes[]
    nodeResults: Map<string, string>
    executingNodeIds: Set<string>
    pendingApprovalNodeId: string | null
    onApprove: (nodeId: string, approved: boolean, modifiedCommand?: string) => void
    interruptedNodeId: string | null
    stoppedAtNodeId: string | null
    nodeAssistantContent: Map<string, AssistantContentItem[]>
    nodeThreadIDs: Map<string, string>
    nodeSubAgentContent: Map<
        string,
        Map<
            string,
            {
                subThreadID: string
                parentThreadID?: string
                agentType: string
                status: 'running' | 'done' | 'error' | 'cancelled'
                content: AssistantContentItem[]
            }
        >
    >
    executionRunId: number
    isPaused?: boolean
    selection?: SelectionSummary
    parallelSteps?: string[][]
    parallelStepByNodeId?: Map<string, number>
    branchByIfElseId?: Map<string, { true: Set<string>; false: Set<string> }>
    onToggleCollapse?: () => void
    onResultUpdate: (nodeId: string, value: string) => void
    onChat?: (args: { nodeId: string; threadID: string; message: string }) => void
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
    sortedNodes,
    nodeResults,
    executingNodeIds,
    pendingApprovalNodeId,
    onApprove,
    interruptedNodeId,
    stoppedAtNodeId,
    nodeAssistantContent,
    nodeThreadIDs,
    nodeSubAgentContent,
    executionRunId,
    isPaused,
    selection,
    parallelSteps,
    parallelStepByNodeId,
    branchByIfElseId,
    onToggleCollapse,
    onResultUpdate,
    onChat,
}) => {
    const filteredByActiveNodes = useMemo(
        () => sortedNodes.filter(node => node.type !== NodeType.PREVIEW && node.data.active !== false),
        [sortedNodes]
    )

    const hasParallelAnalysis = !!(parallelSteps && parallelStepByNodeId)

    const { parallelGroups, sequentialItems, allItemsInOrder } = useMemo(() => {
        if (!parallelSteps || !parallelStepByNodeId) {
            return { parallelGroups: [], sequentialItems: [], allItemsInOrder: [] }
        }

        const parallel: Array<{
            stepIndex: number
            nodeIds: string[]
            nodes: WorkflowNodes[]
        }> = []
        const sequential: Array<{
            stepIndex: number
            node: WorkflowNodes
        }> = []

        parallelSteps.forEach((stepNodeIds, index) => {
            const stepNodes = stepNodeIds
                .map(nodeId => filteredByActiveNodes.find(n => n.id === nodeId))
                .filter(Boolean) as WorkflowNodes[]

            if (stepNodes.length > 1) {
                parallel.push({
                    stepIndex: index,
                    nodeIds: stepNodeIds,
                    nodes: stepNodes,
                })
            } else if (stepNodes.length === 1) {
                sequential.push({
                    stepIndex: index,
                    node: stepNodes[0],
                })
            }
        })

        // Build ordered list by stepIndex while assigning contiguous parallel group indices
        const ordered: Array<
            | {
                  type: 'parallel'
                  stepIndex: number
                  parallelGroupIndex: number
                  nodeIds: string[]
                  nodes: WorkflowNodes[]
              }
            | { type: 'sequential'; stepIndex: number; node: WorkflowNodes }
        > = []
        let pIdx = 0
        let sIdx = 0
        while (pIdx < parallel.length || sIdx < sequential.length) {
            if (
                pIdx < parallel.length &&
                (sIdx >= sequential.length || parallel[pIdx].stepIndex <= sequential[sIdx].stepIndex)
            ) {
                ordered.push({
                    type: 'parallel',
                    stepIndex: parallel[pIdx].stepIndex,
                    parallelGroupIndex: pIdx,
                    nodeIds: parallel[pIdx].nodeIds,
                    nodes: parallel[pIdx].nodes,
                })
                pIdx++
            } else if (sIdx < sequential.length) {
                ordered.push({
                    type: 'sequential',
                    stepIndex: sequential[sIdx].stepIndex,
                    node: sequential[sIdx].node,
                })
                sIdx++
            }
        }

        return {
            parallelGroups: parallel,
            sequentialItems: sequential,
            allItemsInOrder: ordered,
        }
    }, [parallelSteps, parallelStepByNodeId, filteredByActiveNodes])

    const hasLoopNodes = useMemo(
        () =>
            filteredByActiveNodes.some(
                node => node.type === NodeType.LOOP_START || node.type === NodeType.LOOP_END
            ),
        [filteredByActiveNodes]
    )

    const getBorderColorClass = (nodeId: string): string => {
        if (executingNodeIds.has(nodeId)) {
            return 'tw-border-[var(--vscode-charts-yellow)]'
        }
        if (nodeId === interruptedNodeId || nodeId === stoppedAtNodeId) {
            return 'tw-border-[var(--vscode-charts-orange)]'
        }
        if (selection?.selectedNodeId === nodeId) {
            return 'tw-border-[var(--vscode-testing-iconPassed)]'
        }
        return 'tw-border-transparent'
    }

    const getStepLabel = (groupIndex: number, visibleNodeCount: number): string | null => {
        if (visibleNodeCount <= 1) return null
        if (groupIndex === -1) return 'Unsupported (Loop)'
        return `Parallel Step ${groupIndex + 1} (${visibleNodeCount})`
    }

    const getStepBranchSuffix = (nodeIds: string[]): string => {
        if (!branchByIfElseId || branchByIfElseId.size === 0) return ''

        const trueOnlyCount = nodeIds.filter(nodeId => {
            for (const [, { true: trueSet }] of branchByIfElseId) {
                if (!trueSet.has(nodeId)) return false
            }
            return true
        }).length

        const falseOnlyCount = nodeIds.filter(nodeId => {
            for (const [, { false: falseSet }] of branchByIfElseId) {
                if (!falseSet.has(nodeId)) return false
            }
            return true
        }).length

        if (trueOnlyCount === nodeIds.length) return ' – True'
        if (falseOnlyCount === nodeIds.length) return ' – False'
        return ''
    }
    const [openItemId, setOpenItemId] = useState<string | undefined>(undefined)
    const [autoFollowActiveNode, setAutoFollowActiveNode] = useState<boolean>(true)
    const [modifiedCommands, setModifiedCommands] = useState<Map<string, string>>(new Map())
    const [expandedJsonItems, setExpandedJsonItems] = useState<Set<string>>(new Set())
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null)
    const [fullscreenNodeId, setFullscreenNodeId] = useState<string | null>(null)
    const [chatDrafts, setChatDrafts] = useState<Map<string, string>>(new Map())

    const lastExecutionRunIdRef = useRef(executionRunId)

    useEffect(() => {
        if (lastExecutionRunIdRef.current !== executionRunId) {
            setChatDrafts(new Map())
            lastExecutionRunIdRef.current = executionRunId
        }
    }, [executionRunId])

    useEffect(() => {
        if (nodeThreadIDs.size === 0 && chatDrafts.size > 0) {
            setChatDrafts(new Map())
        }
    }, [nodeThreadIDs, chatDrafts])

    const singleActiveNodeId = useMemo(() => {
        if (executingNodeIds.size !== 1) return null
        for (const id of executingNodeIds) return id
        return null
    }, [executingNodeIds])

    // Open results editor when nodes request it (from input editor modal)
    useEffect(() => {
        const handler = (e: any) => {
            const id: string | undefined = e?.detail?.id
            if (id) setPreviewNodeId(id)
        }
        window.addEventListener('nebula-open-result-editor' as any, handler as any)
        return () => window.removeEventListener('nebula-open-result-editor' as any, handler as any)
    }, [])

    // Auto-scroll management for LLM assistant output per node
    const assistantScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const programmaticScrollNodes = useRef<Set<string>>(new Set())
    const [pausedAutoScroll, setPausedAutoScroll] = useState<Set<string>>(new Set())

    const handleAssistantScroll = (nodeId: string, el: HTMLDivElement) => {
        // Ignore scroll events caused by our own auto-scroll logic
        if (programmaticScrollNodes.current.has(nodeId)) {
            programmaticScrollNodes.current.delete(nodeId)
            return
        }
        const threshold = 8 // px tolerance for being at bottom
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
        setPausedAutoScroll(prev => {
            const next = new Set(prev)
            if (nearBottom) {
                next.delete(nodeId)
            } else {
                next.add(nodeId)
            }
            return next
        })
    }

    const handleCommandChange = (nodeId: string, value: string) => {
        setModifiedCommands(prev => new Map(prev).set(nodeId, value))
    }

    const handleChatSend = (nodeId: string) => {
        if (!onChat) return
        const threadID = nodeThreadIDs.get(nodeId)
        const message = (chatDrafts.get(nodeId) || '').trim()
        if (!threadID || !message) return
        onChat({ nodeId, threadID, message })
        setChatDrafts(prev => {
            const next = new Map(prev)
            next.set(nodeId, '')
            return next
        })
    }

    const toggleJsonExpanded = (id: string) => {
        setExpandedJsonItems(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const renderJsonContent = (
        content: string | undefined,
        id: string,
        maxLength = 300
    ): React.ReactNode => {
        if (!content) return null
        const isLong = content.length > maxLength
        const isExpanded = expandedJsonItems.has(id)

        return (
            <div className="tw-font-mono tw-text-xs tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] tw-max-h-32 tw-overflow-auto tw-break-words">
                {isLong && !isExpanded ? (
                    <div>
                        <pre className="tw-whitespace-pre-wrap tw-text-[var(--vscode-foreground)]">
                            {content.slice(0, maxLength)}
                        </pre>
                        <button
                            type="button"
                            className="tw-text-[var(--vscode-textLink-foreground)] hover:tw-underline tw-text-xs tw-mt-1"
                            onClick={() => toggleJsonExpanded(id)}
                        >
                            Expand
                        </button>
                    </div>
                ) : (
                    <div>
                        <pre className="tw-whitespace-pre-wrap tw-text-[var(--vscode-foreground)]">
                            {content}
                        </pre>
                        {isLong && isExpanded && (
                            <button
                                type="button"
                                className="tw-text-[var(--vscode-textLink-foreground)] hover:tw-underline tw-text-xs tw-mt-1"
                                onClick={() => toggleJsonExpanded(id)}
                            >
                                Collapse
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const shorten = (val: unknown, max = 80): string => {
        const s = String(val ?? '')
        if (s.length <= max) return s
        return s.slice(0, max - 1) + '…'
    }

    const safeParseJSON = (s?: string): unknown => {
        if (!s) return null
        try {
            return JSON.parse(s)
        } catch {
            return null
        }
    }

    const extractValues = (obj: any, keys: string[]): string[] => {
        const out: string[] = []
        for (const k of keys) {
            if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
                const v = obj[k]
                if (v == null) continue
                if (Array.isArray(v)) {
                    const flat = v
                        .filter(
                            x => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
                        )
                        .map(x => String(x))
                        .join(', ')
                    if (flat) out.push(flat)
                } else if (typeof v === 'object') {
                    // skip nested objects for title brevity
                } else {
                    out.push(String(v))
                }
            }
        }
        return out
    }

    const TOOL_KEYS: Record<string, string[] | undefined> = {
        // workspace tools
        bash: ['cmd'],
        list_directory: ['path'],
        read: ['path'],
        grep: ['pattern', 'path'],
        glob: ['filePattern'],
        get_diagnostics: ['path'],
        format_file: ['path'],
        create_file: ['path'],
        edit_file: ['path'],
        undo_edit: ['path'],
        summarize_git_diff: ['gitDiffCommand'],
        multiple_choice: ['question'],
        run_javascript: ['codeFile', 'code'],
        codebase_search_agent: ['query'],
        librarian: ['query'],
        oracle: ['task'],
        task: ['description', 'prompt'],
        todo_read: [],
        todo_write: [],
        web_crawler: ['task'],
        mermaid: [],
    }

    const formatToolArgsFromInput = (name: string, inputJSON?: string): string => {
        const obj = safeParseJSON(inputJSON)
        if (!obj || typeof obj !== 'object') return ''
        const official = resolveToolName(name) ?? name
        const norm = official.toLowerCase()
        const keys = TOOL_KEYS[norm]
        let vals: string[] = []
        if (Array.isArray(keys)) {
            vals = extractValues(obj as any, keys)
        }
        if (vals.length === 0) {
            // fallback: pick first few primitive values
            const prims = Object.values(obj as any)
                .flatMap(v =>
                    Array.isArray(v)
                        ? v
                              .filter(x => ['string', 'number', 'boolean'].includes(typeof x))
                              .map(x => String(x))
                        : typeof v === 'object'
                          ? []
                          : [String(v)]
                )
                .filter(Boolean)
            vals = prims.slice(0, 2)
        }
        const joined = vals.map(v => shorten(v)).join(', ')
        return joined ? `: ${joined}` : ''
    }

    const renderAssistantAccordionItem = (
        item: AssistantContentItem,
        index: number,
        nodeId: string,
        isNodeExecuting: boolean,
        pairedResultJSON?: string
    ) => {
        const key = `${nodeId}:${index}`
        let title = ''
        switch (item.type) {
            case 'text':
                title = '📝 Assistance Message'
                break
            case 'user_message':
                title = '👤 You'
                break
            case 'thinking':
                title = '🧠 Thinking'
                break
            case 'tool_use': {
                const officialName = resolveToolName(item.name) ?? item.name
                const suffix = formatToolArgsFromInput(officialName, item.inputJSON)
                title = `🔧 ${officialName}${suffix}`
                break
            }
            case 'tool_result':
                title = '✅ Result'
                break
            case 'server_tool_use': {
                const officialName = resolveToolName(item.name) ?? item.name
                const suffix = formatToolArgsFromInput(officialName, item.inputJSON)
                title = `🌐 ${officialName}${suffix}`
                break
            }
            case 'server_web_search_result': {
                const suffix = item.query ? `: ${shorten(item.query)}` : ''
                title = `🔍 Web Search${suffix}`
                break
            }
            default:
                title = 'Details'
        }

        return (
            <AccordionItem
                key={key}
                value={key}
                className={clsx(
                    'tw-border tw-border-[var(--vscode-panel-border)] tw-rounded',
                    item.type === 'thinking' ? 'tw-mt-3 tw-mb-0' : ''
                )}
            >
                <AccordionTrigger
                    className={clsx(
                        'tw-w-full tw-text-xs tw-h-7 tw-py-1 tw-px-2 tw-bg-[var(--vscode-sideBar-background)] tw-rounded-t',
                        styles['sidebar-accordion-trigger']
                    )}
                >
                    {(() => {
                        const toolStatus =
                            item.type === 'tool_use' ? getToolRunStatus(pairedResultJSON) : null
                        const isToolRunning = isNodeExecuting && toolStatus === 'in-progress'
                        const isToolDone = toolStatus === 'done' || toolStatus === 'completed'
                        const isToolError =
                            item.type === 'tool_use' ? hasToolRunError(pairedResultJSON) : false
                        return (
                            <div className="tw-flex tw-items-center tw-w-full tw-text-left tw-truncate">
                                <div className="tw-w-4 tw-mr-2">
                                    {isToolRunning ? (
                                        <Loader2Icon
                                            stroke="var(--vscode-testing-iconPassed)"
                                            strokeWidth={3}
                                            size={24}
                                            className="tw-h-4 tw-w-4 tw-animate-spin"
                                        />
                                    ) : isToolError ? (
                                        <CircleX
                                            stroke="var(--vscode-charts-red)"
                                            strokeWidth={3}
                                            size={24}
                                            className="tw-h-4 tw-w-4"
                                        />
                                    ) : isToolDone ? (
                                        <CircleCheck
                                            stroke="var(--vscode-testing-iconPassed)"
                                            strokeWidth={3}
                                            size={24}
                                            className="tw-h-4 tw-w-4"
                                        />
                                    ) : null}
                                </div>
                                <span className="tw-truncate">{title}</span>
                            </div>
                        )
                    })()}
                </AccordionTrigger>
                <AccordionContent>
                    <div className="tw-p-2 tw-bg-[var(--vscode-editor-background)] tw-rounded-b">
                        {(() => {
                            switch (item.type) {
                                case 'text':
                                    return (
                                        <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap">
                                            {item.text}
                                        </p>
                                    )
                                case 'user_message':
                                    return (
                                        <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap">
                                            {item.text}
                                        </p>
                                    )
                                case 'thinking': {
                                    const sanitizeThinking = (s: string): string =>
                                        s
                                            .replace(/<ENCRYPTED>[\s\S]*?<\/ENCRYPTED>/g, '')
                                            .replace(/<ID>[\s\S]*?<\/ID>/g, '')
                                    return (
                                        <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap tw-italic">
                                            {sanitizeThinking(item.thinking)}
                                        </p>
                                    )
                                }
                                case 'tool_use':
                                    return (
                                        <div className="tw-text-xs tw-space-y-1">
                                            {pairedResultJSON
                                                ? renderJsonContent(
                                                      pairedResultJSON,
                                                      `${key}/result`,
                                                      300
                                                  )
                                                : item.inputJSON && (
                                                      <div>
                                                          <p className="tw-text-[var(--vscode-foreground)] tw-mb-1">
                                                              Args:
                                                          </p>
                                                          {renderJsonContent(
                                                              item.inputJSON,
                                                              `${key}/args`,
                                                              300
                                                          )}
                                                      </div>
                                                  )}
                                        </div>
                                    )
                                case 'tool_result':
                                    return (
                                        <div className="tw-text-xs">
                                            {item.resultJSON &&
                                                renderJsonContent(item.resultJSON, `${key}/result`, 300)}
                                        </div>
                                    )
                                case 'server_tool_use':
                                    return (
                                        <div className="tw-text-xs tw-space-y-1">
                                            {item.inputJSON && (
                                                <div>
                                                    <p className="tw-text-[var(--vscode-foreground)] tw-mb-1">
                                                        Params:
                                                    </p>
                                                    {renderJsonContent(
                                                        item.inputJSON,
                                                        `${key}/params`,
                                                        300
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                case 'server_web_search_result':
                                    return (
                                        <div className="tw-text-xs tw-space-y-1">
                                            {item.query && (
                                                <p className="tw-text-[var(--vscode-foreground)]">
                                                    Query:{' '}
                                                    <span className="tw-italic">{item.query}</span>
                                                </p>
                                            )}
                                            {item.resultJSON &&
                                                renderJsonContent(item.resultJSON, `${key}/web`, 300)}
                                        </div>
                                    )
                                default:
                                    return null
                            }
                        })()}
                    </div>
                </AccordionContent>
            </AccordionItem>
        )
    }

    const renderSubAgentTimeline = (args: {
        subAgent: {
            subThreadID: string
            parentThreadID?: string
            agentType: string
            status: 'running' | 'done' | 'error' | 'cancelled'
            content: AssistantContentItem[]
        }
        parentNodeId: string
        isExecuting: boolean
    }): React.ReactNode => {
        const { subAgent, parentNodeId, isExecuting } = args
        const statusColors: Record<'running' | 'done' | 'error' | 'cancelled', string> = {
            running: 'tw-text-[var(--vscode-testing-iconPassed)]',
            done: 'tw-text-[var(--vscode-testing-iconPassed)]',
            error: 'tw-text-[var(--vscode-charts-red)]',
            cancelled: 'tw-text-[var(--vscode-descriptionForeground)]',
        }
        const statusLabels: Record<'running' | 'done' | 'error' | 'cancelled', string> = {
            running: 'Running',
            done: 'Done',
            error: 'Error',
            cancelled: 'Cancelled',
        }
        const subAgentKey = `${parentNodeId}:sub:${subAgent.subThreadID}`

        return (
            <Accordion type="single" collapsible defaultValue={subAgentKey}>
                <AccordionItem
                    value={subAgentKey}
                    className="tw-border tw-border-dashed tw-border-[var(--vscode-panel-border)] tw-rounded tw-mt-2"
                >
                    <AccordionTrigger
                        className={clsx(
                            'tw-w-full tw-text-xs tw-h-7 tw-py-1 tw-px-2 tw-bg-[var(--vscode-sideBar-dropBackground)] tw-rounded-t',
                            styles['sidebar-accordion-trigger']
                        )}
                    >
                        <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
                            <div className="tw-flex tw-items-center tw-gap-2 tw-truncate">
                                <span className="tw-text-xs tw-font-semibold tw-text-[var(--vscode-foreground)] tw-truncate">
                                    Sub-agent: {subAgent.agentType}
                                </span>
                            </div>
                            <span className={clsx('tw-text-xs', statusColors[subAgent.status])}>
                                {statusLabels[subAgent.status]}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="tw-p-2 tw-bg-[var(--vscode-sideBar-dropBackground)] tw-rounded-b">
                            <div className="tw-space-y-2">
                                {renderAssistantTimeline({
                                    items: subAgent.content,
                                    nodeId: `${parentNodeId}:sub:${subAgent.subThreadID}`,
                                    isExecuting: isExecuting && subAgent.status === 'running',
                                    nodeSubAgentContent,
                                })}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        )
    }

    const renderAssistantTimeline = (args: {
        items: AssistantContentItem[]
        nodeId: string
        isExecuting: boolean
        resultText?: string
        prompt?: string
        promptNodeId?: string
        nodeSubAgentContent?: Map<
            string,
            Map<
                string,
                {
                    subThreadID: string
                    parentThreadID?: string
                    agentType: string
                    status: 'running' | 'done' | 'error' | 'cancelled'
                    content: AssistantContentItem[]
                }
            >
        >
    }) => {
        const { items, nodeId, isExecuting, resultText, prompt, promptNodeId, nodeSubAgentContent } =
            args
        const displayItems = getAssistantDisplayItems(items, {
            isExecuting,
            resultText,
        })
        const pairedMap = new Map<string, string | undefined>()
        for (const it of items) {
            if (it.type === 'tool_result' && it.toolUseID) {
                pairedMap.set(it.toolUseID, it.resultJSON)
            }
        }

        const segments: React.ReactNode[] = []
        const pendingNonText: AssistantContentItem[] = []
        const promptText = (prompt ?? '').trim()
        if (promptText.length > 0) {
            const dispatchNodeId = promptNodeId ?? nodeId
            segments.push(
                <div
                    key={`${nodeId}:prompt`}
                    className="tw-bg-[var(--vscode-sideBar-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]"
                    onDoubleClick={e => {
                        e.stopPropagation()
                        window.dispatchEvent(
                            new CustomEvent('nebula-edit-node', {
                                detail: {
                                    id: dispatchNodeId,
                                    action: 'start',
                                },
                            })
                        )
                    }}
                >
                    <div className="tw-text-[0.7rem] tw-font-semibold tw-uppercase tw-mb-1 tw-text-[var(--vscode-descriptionForeground)]">
                        Prompt
                    </div>
                    <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap">
                        {promptText}
                    </p>
                </div>
            )
        }

        const flushNonTextAccordion = () => {
            if (pendingNonText.length === 0) return
            const baseIndex = segments.length
            segments.push(
                <Accordion key={`${nodeId}:accordion:${baseIndex}`} type="multiple">
                    {pendingNonText.map((it, idx) => {
                        const itemKey = it.type === 'tool_use' ? it.id : `${it.type}-${idx}`

                        // If this is a tool_use with a subThreadID, render sub-agent content inline
                        if (it.type === 'tool_use' && it.subThreadID && nodeSubAgentContent) {
                            const subAgentMap = nodeSubAgentContent.get(nodeId)
                            const subAgent = subAgentMap?.get(it.subThreadID)
                            if (subAgent) {
                                return (
                                    <div key={`tool-with-subagent-${itemKey}`}>
                                        {renderAssistantAccordionItem(
                                            it,
                                            idx,
                                            nodeId,
                                            isExecuting,
                                            it.type === 'tool_use' ? pairedMap.get(it.id) : undefined
                                        )}
                                        {renderSubAgentTimeline({
                                            subAgent,
                                            parentNodeId: nodeId,
                                            isExecuting,
                                        })}
                                    </div>
                                )
                            }
                        }

                        return renderAssistantAccordionItem(
                            it,
                            idx,
                            nodeId,
                            isExecuting,
                            it.type === 'tool_use' ? pairedMap.get(it.id) : undefined
                        )
                    })}
                </Accordion>
            )
            pendingNonText.length = 0
        }

        for (let i = 0; i < displayItems.length; i++) {
            const it = displayItems[i]
            if (it.type === 'text') {
                flushNonTextAccordion()
                const prev = i > 0 ? displayItems[i - 1] : null
                const assistantMarginTop = prev && prev.type === 'thinking' ? '' : 'tw-mt-2'
                segments.push(
                    <div
                        key={`${nodeId}:text:${i}`}
                        className={`tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] ${assistantMarginTop}`}
                    >
                        <Markdown content={it.text} className="tw-text-xs" />
                    </div>
                )
            } else if (it.type === 'user_message') {
                flushNonTextAccordion()
                segments.push(
                    <div
                        key={`${nodeId}:user:${i}`}
                        className="tw-bg-[var(--vscode-sideBar-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] tw-mt-2"
                    >
                        <p className="tw-text-xs tw-text-[var(--vscode-foreground)] tw-whitespace-pre-wrap">
                            {it.text}
                        </p>
                    </div>
                )
            } else if (it.type !== 'tool_result') {
                pendingNonText.push(it)
            }
        }

        flushNonTextAccordion()

        return <>{segments}</>
    }

    useEffect(() => {
        if (pendingApprovalNodeId) {
            setOpenItemId(pendingApprovalNodeId)
        }
    }, [pendingApprovalNodeId])

    useEffect(() => {
        if (!autoFollowActiveNode) return
        if (pendingApprovalNodeId) return
        if (!singleActiveNodeId) return
        if (openItemId !== singleActiveNodeId) {
            setOpenItemId(singleActiveNodeId)
        }
    }, [autoFollowActiveNode, pendingApprovalNodeId, singleActiveNodeId, openItemId])

    useEffect(() => {
        if (executingNodeIds.size > 0) {
            setModifiedCommands(new Map())
        }
    }, [executingNodeIds])
    useEffect(() => {
        if (pendingApprovalNodeId !== null) {
            setModifiedCommands(new Map())
        }
    }, [pendingApprovalNodeId])

    useEffect(() => {
        if (executionRunId > 0) {
            setOpenItemId(undefined)
            setAutoFollowActiveNode(true)
            setModifiedCommands(new Map())
            setExpandedJsonItems(new Set())
            setPausedAutoScroll(new Set())
            assistantScrollRefs.current.clear()
        }
    }, [executionRunId])

    const renderNodeItem = (node: WorkflowNodes, isInParallelGroup = false) => {
        const isFullscreen = fullscreenNodeId === node.id
        const hasPrompt =
            node.type === NodeType.LLM &&
            typeof node.data?.content === 'string' &&
            node.data.content.trim().length > 0

        return (
            <div
                className={clsx(
                    'tw-flex tw-flex-col tw-gap-1 tw-px-2 tw-py-1 tw-rounded tw-bg-[var(--vscode-sideBar-dropBackground)]',
                    'tw-border tw-w-full',
                    getBorderColorClass(node.id),
                    isFullscreen ? 'tw-h-full' : ''
                )}
            >
                <Accordion
                    type="single"
                    collapsible
                    value={openItemId}
                    onValueChange={value => {
                        const nextId = value || undefined
                        setOpenItemId(nextId)
                        if (!singleActiveNodeId) {
                            setAutoFollowActiveNode(false)
                            return
                        }
                        if (nextId === singleActiveNodeId) {
                            setAutoFollowActiveNode(true)
                        } else {
                            setAutoFollowActiveNode(false)
                        }
                    }}
                >
                    <AccordionItem value={node.id}>
                        <AccordionTrigger
                            className={clsx(
                                'tw-w-full tw-text-sm tw-h-6 tw-py-[.1rem]',
                                styles['sidebar-accordion-trigger']
                            )}
                        >
                            <div className="tw-flex tw-items-center tw-w-full">
                                <div className="tw-w-4 tw-mr-2">
                                    {executingNodeIds.has(node.id) && (
                                        <Loader2Icon
                                            stroke="var(--vscode-testing-iconPassed)"
                                            strokeWidth={3}
                                            size={24}
                                            className="tw-h-4 tw-w-4 tw-animate-spin"
                                        />
                                    )}
                                </div>
                                <span className="tw-text-sm">
                                    {formatNodeTitle(node.type as NodeType, node.data.title)}
                                </span>
                                {(() => {
                                    const assistantItems = nodeAssistantContent.get(node.id) || []
                                    const latestPercent =
                                        node.type === NodeType.LLM
                                            ? getLatestTokensPercent(assistantItems)
                                            : null
                                    return (
                                        <div className="tw-ml-auto tw-flex tw-items-center tw-gap-2">
                                            {node.type === NodeType.LLM && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="tw-w-[1.75rem] tw-h-[1.75rem] tw-p-0"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        const nextState =
                                                            fullscreenNodeId === node.id ? null : node.id
                                                        setFullscreenNodeId(nextState)
                                                        if (nextState) {
                                                            setOpenItemId(node.id)
                                                            setAutoFollowActiveNode(false)
                                                        }
                                                    }}
                                                    title={
                                                        fullscreenNodeId === node.id
                                                            ? 'Exit Fullscreen'
                                                            : 'Fullscreen'
                                                    }
                                                >
                                                    {fullscreenNodeId === node.id ? (
                                                        <Minimize2 className="tw-h-4 tw-w-4" />
                                                    ) : (
                                                        <Maximize2 className="tw-h-4 tw-w-4" />
                                                    )}
                                                </Button>
                                            )}
                                            {node.type === NodeType.LLM && latestPercent != null && (
                                                <span className="tw-text-xs tw-tabular-nums tw-opacity-70">
                                                    {formatPercentLabel(latestPercent)}
                                                </span>
                                            )}
                                            {(node.type === NodeType.LLM ||
                                                node.type === NodeType.CLI ||
                                                node.type === NodeType.INPUT ||
                                                node.type === NodeType.VARIABLE ||
                                                node.type === NodeType.IF_ELSE ||
                                                node.type === NodeType.SUBFLOW) && (
                                                <RunOnlyThisButton
                                                    nodeId={node.id}
                                                    className="tw-w-[1.75rem] tw-h-[1.75rem]"
                                                    disabled={
                                                        isPaused ||
                                                        executingNodeIds.size > 0 ||
                                                        (node.type === NodeType.SUBFLOW &&
                                                            !(node as any).data?.subflowId)
                                                    }
                                                />
                                            )}
                                            <RunFromHereButton
                                                nodeId={node.id}
                                                className="tw-w-[1.75rem] tw-h-[1.75rem]"
                                                disabled={isPaused || executingNodeIds.size > 0}
                                            />
                                        </div>
                                    )
                                })()}
                            </div>
                        </AccordionTrigger>
                        <AccordionContent
                            className={clsx(
                                isFullscreen ? 'tw-flex-1 tw-flex tw-flex-col tw-overflow-hidden' : ''
                            )}
                        >
                            {(nodeResults.has(node.id) ||
                                (node.type === NodeType.LLM &&
                                    (nodeAssistantContent.has(node.id) || hasPrompt))) && (
                                <div
                                    className={clsx(
                                        'tw-mt-1 tw-space-y-4',
                                        isFullscreen
                                            ? 'tw-flex-1 tw-flex tw-flex-col tw-overflow-hidden'
                                            : ''
                                    )}
                                >
                                    {node.type === NodeType.LLM &&
                                        (nodeAssistantContent.has(node.id) || hasPrompt) && (
                                            <div
                                                className={clsx(
                                                    'tw-overflow-y-auto',
                                                    // In fullscreen, keep the scrollbar on the inner container as well,
                                                    // just allow a taller max height instead of flexing to fill.
                                                    isFullscreen ? 'tw-max-h-[60vh]' : 'tw-max-h-64'
                                                )}
                                                ref={el => {
                                                    if (el) {
                                                        assistantScrollRefs.current.set(node.id, el)
                                                        if (!pausedAutoScroll.has(node.id)) {
                                                            // Keep auto-following when the container mounts or resizes
                                                            el.scrollTop = el.scrollHeight
                                                        }
                                                    } else {
                                                        assistantScrollRefs.current.delete(node.id)
                                                    }
                                                }}
                                                onScroll={e =>
                                                    handleAssistantScroll(node.id, e.currentTarget)
                                                }
                                            >
                                                {renderAssistantTimeline({
                                                    items: nodeAssistantContent.get(node.id) || [],
                                                    nodeId: node.id,
                                                    isExecuting: executingNodeIds.has(node.id),
                                                    resultText: nodeResults.get(node.id),
                                                    prompt:
                                                        node.type === NodeType.LLM &&
                                                        typeof node.data?.content === 'string'
                                                            ? node.data.content.trim()
                                                            : '',
                                                    promptNodeId: node.id,
                                                    nodeSubAgentContent,
                                                })}
                                            </div>
                                        )}

                                    <div className="tw-mt-1 tw-mb-1 tw-border-t tw-border-[var(--vscode-panel-border)]" />
                                    <div>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
                                            <h4 className="tw-text-sm tw-font-semibold tw-text-[var(--vscode-foreground)]">
                                                Result
                                            </h4>
                                            {node.id !== pendingApprovalNodeId && (
                                                <div className="tw-flex tw-items-center tw-gap-1">
                                                    <CopyToClipboardButton
                                                        text={nodeResults.get(node.id) || ''}
                                                        className="tw-h-6 tw-px-2 tw-py-0"
                                                        title="Copy Raw Result"
                                                        size="sm"
                                                        variant="secondary"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => onResultUpdate(node.id, '')}
                                                        className="tw-h-6 tw-px-2 tw-py-0 tw-gap-1"
                                                        title="Reset Result"
                                                    >
                                                        <RotateCcw className="tw-h-4 tw-w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => setPreviewNodeId(node.id)}
                                                        className="tw-h-6 tw-px-2 tw-py-0 tw-gap-1"
                                                        title="Open Preview"
                                                    >
                                                        <Eye className="tw-h-4 tw-w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {node.id === pendingApprovalNodeId ? (
                                            <Textarea
                                                value={
                                                    modifiedCommands.get(node.id) ||
                                                    nodeResults.get(node.id) ||
                                                    ''
                                                }
                                                readOnly={
                                                    !(
                                                        node.type === NodeType.CLI &&
                                                        node.id === pendingApprovalNodeId
                                                    )
                                                }
                                                onChange={e =>
                                                    handleCommandChange(node.id, e.target.value)
                                                }
                                            />
                                        ) : (
                                            <div
                                                className="tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)] tw-max-h-64 tw-overflow-auto tw-cursor-pointer"
                                                onDoubleClick={() => {
                                                    const content = nodeResults.get(node.id) || ''
                                                    if (content.trim().length === 0) return
                                                    setPreviewNodeId(node.id)
                                                }}
                                                role="button"
                                                title="Open Preview"
                                            >
                                                {executingNodeIds.has(node.id) ? (
                                                    <div>
                                                        <div className="tw-text-xs tw-text-[var(--vscode-descriptionForeground)] tw-mb-1">
                                                            Running... (live output)
                                                        </div>
                                                        <Markdown
                                                            content={nodeResults.get(node.id) || ''}
                                                            className="tw-text-xs"
                                                        />
                                                    </div>
                                                ) : (
                                                    <Markdown
                                                        content={nodeResults.get(node.id) || ''}
                                                        className="tw-text-xs"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {node.id === pendingApprovalNodeId && node.type === NodeType.CLI && (
                                        <div className="tw-mt-2 tw-space-y-2 tw-text-xs">
                                            <div className="tw-grid tw-grid-cols-2 tw-gap-2">
                                                <div className="tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]">
                                                    <div className="tw-font-semibold">Mode</div>
                                                    <div>
                                                        {
                                                            ((node as any).data?.mode ??
                                                                'command') as string
                                                        }
                                                    </div>
                                                </div>
                                                <div className="tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]">
                                                    <div className="tw-font-semibold">Shell</div>
                                                    <div>
                                                        {((node as any).data?.shell ?? 'bash') as string}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="tw-grid tw-grid-cols-2 tw-gap-2">
                                                <div className="tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]">
                                                    <div className="tw-font-semibold">Safety</div>
                                                    <div>
                                                        {
                                                            ((node as any).data?.safetyLevel ??
                                                                'safe') as string
                                                        }
                                                    </div>
                                                </div>
                                                <div className="tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]">
                                                    <div className="tw-font-semibold">Stdin</div>
                                                    <div>
                                                        {
                                                            ((node as any).data?.stdin?.source ??
                                                                'none') as string
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="tw-bg-[var(--vscode-editor-background)] tw-p-2 tw-rounded tw-border tw-border-[var(--vscode-panel-border)]">
                                                <div className="tw-font-semibold">Flags</div>
                                                <div className="tw-flex tw-flex-wrap tw-gap-2">
                                                    {(() => {
                                                        const d = (node as any).data?.flags || {}
                                                        const enabled: string[] = []
                                                        if (d.exitOnError) enabled.push('set -e')
                                                        if (d.unsetVars) enabled.push('set -u')
                                                        if (d.pipefail) enabled.push('set -o pipefail')
                                                        if (
                                                            d.noProfile !== false &&
                                                            ((node as any).data?.shell ?? 'bash') ===
                                                                'pwsh'
                                                        )
                                                            enabled.push('-NoProfile')
                                                        if (
                                                            d.nonInteractive !== false &&
                                                            ((node as any).data?.shell ?? 'bash') ===
                                                                'pwsh'
                                                        )
                                                            enabled.push('-NonInteractive')
                                                        if (d.executionPolicyBypass)
                                                            enabled.push('-ExecutionPolicy Bypass')
                                                        return enabled.length > 0
                                                            ? enabled.join(', ')
                                                            : '—'
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {node.id === pendingApprovalNodeId && (
                                        <div className="tw-flex tw-w-full tw-gap-2 tw-mt-2 tw-justify-center">
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    onApprove(
                                                        node.id,
                                                        true,
                                                        node.type === NodeType.CLI
                                                            ? modifiedCommands.get(node.id)
                                                            : undefined
                                                    )
                                                }
                                                variant="secondary"
                                                style={{
                                                    backgroundColor: 'var(--vscode-testing-iconPassed)',
                                                    color: 'var(--vscode-button-foreground)',
                                                }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => onApprove(node.id, false)}
                                                variant="secondary"
                                                style={{
                                                    backgroundColor: 'var(--vscode-charts-red)',
                                                    color: 'var(--vscode-button-foreground)',
                                                }}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    )}

                                    {node.type === NodeType.LLM && nodeThreadIDs.has(node.id) && (
                                        <div className="tw-mt-3 tw-space-y-2">
                                            <div className="tw-flex tw-items-center tw-justify-between">
                                                <h4 className="tw-text-sm tw-font-semibold tw-text-[var(--vscode-foreground)]">
                                                    Chat
                                                </h4>
                                            </div>
                                            <Textarea
                                                value={chatDrafts.get(node.id) || ''}
                                                onChange={e => {
                                                    const value = e.target.value
                                                    setChatDrafts(prev => {
                                                        const next = new Map(prev)
                                                        next.set(node.id, value)
                                                        return next
                                                    })
                                                }}
                                                placeholder="Write a follow-up message..."
                                                rows={3}
                                                className="tw-resize-none tw-text-xs"
                                                disabled={
                                                    isPaused ||
                                                    executingNodeIds.size > 0 ||
                                                    !!pendingApprovalNodeId
                                                }
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        handleChatSend(node.id)
                                                    }
                                                }}
                                            />
                                            <div className="tw-flex tw-justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="tw-h-6 tw-px-2 tw-py-0"
                                                    disabled={
                                                        !onChat ||
                                                        isPaused ||
                                                        executingNodeIds.size > 0 ||
                                                        !!pendingApprovalNodeId ||
                                                        !(chatDrafts.get(node.id) || '').trim()
                                                    }
                                                    onClick={() => handleChatSend(node.id)}
                                                >
                                                    Send
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        )
    }

    // Auto-scroll: on assistant content updates or when user resumes bottom, scroll to bottom for nodes not paused
    const assistantItemsTick = (() => {
        let count = 0
        for (const items of nodeAssistantContent.values()) {
            if (!Array.isArray(items)) continue
            for (const it of items as AssistantContentItem[]) {
                switch (it.type) {
                    case 'text':
                        count += it.text.length
                        break
                    case 'thinking':
                        count += it.thinking.length
                        break
                    default:
                        count += 1
                        break
                }
            }
        }
        return count
    })()
    useEffect(() => {
        // re-run when assistant content changes (tracked via assistantItemsTick)
        if (assistantItemsTick >= 0) {
            for (const [nodeId, el] of assistantScrollRefs.current) {
                if (el && !pausedAutoScroll.has(nodeId)) {
                    programmaticScrollNodes.current.add(nodeId)
                    el.scrollTop = el.scrollHeight
                }
            }
        }
    }, [assistantItemsTick, pausedAutoScroll])

    return (
        <div
            className="tw-w-full tw-border-r tw-border-border tw-h-full tw-bg-sidebar-background tw-p-4"
            style={{ paddingBottom: '20px' }}
        >
            <div className="tw-flex tw-flex-col tw-gap-2 tw-mb-4">
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onToggleCollapse}
                            disabled={!!pendingApprovalNodeId}
                            aria-label="Toggle Right Sidebar"
                            title="Toggle Right Sidebar"
                            aria-expanded={true}
                            aria-controls="right-sidebar-panel"
                            className="tw-h-7 tw-w-7 tw-p-0"
                        >
                            <Menu size={18} />
                        </Button>
                        <h3 className="tw-text-[var(--vscode-sideBarTitle-foreground)] tw-font-medium">
                            Playbox
                        </h3>
                    </div>
                    {isPaused && (
                        <span className="tw-text-xs tw-bg-[var(--vscode-statusBarItem-warningBackground)] tw-text-[var(--vscode-statusBarItem-warningForeground)] tw-px-2 tw-py-1 tw-rounded">
                            Paused
                        </span>
                    )}
                </div>
                <div
                    className={clsx(
                        'tw-space-y-2',
                        fullscreenNodeId ? 'tw-h-full tw-flex tw-flex-col' : ''
                    )}
                >
                    {fullscreenNodeId
                        ? (() => {
                              const node = sortedNodes.find(n => n.id === fullscreenNodeId)
                              return node ? renderNodeItem(node, false) : null
                          })()
                        : hasParallelAnalysis && parallelGroups.length > 0 && !hasLoopNodes
                          ? allItemsInOrder.map(item => {
                                if (item.type === 'parallel') {
                                    const stepLabel = getStepLabel(
                                        item.parallelGroupIndex,
                                        item.nodes.length
                                    )
                                    return (
                                        <div
                                            key={`step-${item.stepIndex}`}
                                            className="tw-rounded tw-p-3 tw-space-y-2 tw-border tw-border-[var(--vscode-panel-border)]"
                                        >
                                            {stepLabel && (
                                                <div className="tw-text-xs tw-text-[var(--vscode-sideBarTitle-foreground)] tw-font-medium tw-px-2 tw-py-1">
                                                    {stepLabel}
                                                    {getStepBranchSuffix(item.nodeIds)}
                                                </div>
                                            )}
                                            {item.nodes.map(node => (
                                                <div key={node.id}>{renderNodeItem(node, true)}</div>
                                            ))}
                                        </div>
                                    )
                                }
                                return (
                                    <div key={`node-${item.node.id}`}>
                                        {renderNodeItem(item.node, false)}
                                    </div>
                                )
                            })
                          : filteredByActiveNodes.map(node => (
                                <div key={node.id}>{renderNodeItem(node, false)}</div>
                            ))}
                </div>
            </div>
            <CombinedPreviewEditorModal
                isOpen={!!previewNodeId}
                value={previewNodeId ? nodeResults.get(previewNodeId) || '' : ''}
                title={
                    previewNodeId
                        ? sortedNodes.find(n => n.id === previewNodeId)?.data.title || 'Preview'
                        : 'Preview'
                }
                onConfirm={newValue => {
                    if (previewNodeId) onResultUpdate(previewNodeId, newValue)
                    setPreviewNodeId(null)
                }}
                onCancel={() => setPreviewNodeId(null)}
                onSwitchToInput={
                    previewNodeId
                        ? () => {
                              const id = previewNodeId
                              window.dispatchEvent(
                                  new CustomEvent('nebula-edit-node', {
                                      detail: { id, action: 'start' },
                                  })
                              )
                          }
                        : undefined
                }
            />
        </div>
    )
}
