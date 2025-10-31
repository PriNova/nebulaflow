import clsx from 'clsx'
import { Loader2Icon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AssistantContentItem } from '../../Core/models'
import { resolveToolName } from '../services/toolNames'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/shadcn/ui/accordion'
import { Button } from '../ui/shadcn/ui/button'
import { Textarea } from '../ui/shadcn/ui/textarea'
import RunFromHereButton from './RunFromHereButton'
import type { SelectionSummary } from './hooks/selectionHandling'
import { NodeType, type WorkflowNodes, formatNodeTitle } from './nodes/Nodes'

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

interface RightSidebarProps {
    sortedNodes: WorkflowNodes[]
    nodeResults: Map<string, string>
    executingNodeIds: Set<string>
    pendingApprovalNodeId: string | null
    onApprove: (nodeId: string, approved: boolean, modifiedCommand?: string) => void
    interruptedNodeId: string | null
    stoppedAtNodeId: string | null
    nodeAssistantContent: Map<string, AssistantContentItem[]>
    executionRunId: number
    isPaused?: boolean
    onRunFromHere?: (nodeId: string) => void
    selection?: SelectionSummary
    parallelSteps?: string[][]
    parallelStepByNodeId?: Map<string, number>
    branchByIfElseId?: Map<string, { true: Set<string>; false: Set<string> }>
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
    executionRunId,
    isPaused,
    onRunFromHere,
    selection,
    parallelSteps,
    parallelStepByNodeId,
    branchByIfElseId,
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

        // Build ordered list by stepIndex
        const ordered: Array<
            | { type: 'parallel'; stepIndex: number; nodeIds: string[]; nodes: WorkflowNodes[] }
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

    const getStepLabel = (stepIndex: number, visibleNodeCount: number): string | null => {
        if (visibleNodeCount <= 1) return null
        if (stepIndex === -1) return 'Unsupported (Loop)'
        return `Parallel Step ${stepIndex + 1} (${visibleNodeCount})`
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
    const [modifiedCommands, setModifiedCommands] = useState<Map<string, string>>(new Map())
    const [expandedJsonItems, setExpandedJsonItems] = useState<Set<string>>(new Set())

    // Auto-scroll management for LLM assistant output per node
    const assistantScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const [pausedAutoScroll, setPausedAutoScroll] = useState<Set<string>>(new Set())

    const handleAssistantScroll = (nodeId: string, el: HTMLDivElement) => {
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
        pairedResultJSON?: string
    ) => {
        const key = `${nodeId}:${index}`
        let title = ''
        switch (item.type) {
            case 'text':
                title = '📝 Assistance Message'
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
                className="tw-border tw-border-[var(--vscode-panel-border)] tw-rounded"
            >
                <AccordionTrigger className="tw-w-full tw-text-xs tw-h-7 tw-py-1 tw-px-2 tw-bg-[var(--vscode-sideBar-background)] tw-rounded-t">
                    <div className="tw-flex tw-items-center tw-w-full tw-text-left tw-truncate">
                        <span className="tw-truncate">{title}</span>
                    </div>
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

    useEffect(() => {
        if (pendingApprovalNodeId) {
            setOpenItemId(pendingApprovalNodeId)
        }
    }, [pendingApprovalNodeId])
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
            setModifiedCommands(new Map())
            setExpandedJsonItems(new Set())
            setPausedAutoScroll(new Set())
            assistantScrollRefs.current.clear()
        }
    }, [executionRunId])

    const renderNodeItem = (node: WorkflowNodes, isInParallelGroup = false) => (
        <div
            className={clsx(
                'tw-flex tw-flex-col tw-gap-1 tw-px-2 tw-py-1 tw-rounded tw-bg-[var(--vscode-sideBar-dropBackground)]',
                'tw-border tw-w-full',
                getBorderColorClass(node.id)
            )}
        >
            <Accordion
                type="single"
                collapsible
                value={openItemId}
                onValueChange={value => setOpenItemId(value || '')}
            >
                <AccordionItem value={node.id}>
                    <AccordionTrigger className="tw-w-full tw-text-sm tw-h-6 tw-py-[.1rem]">
                        <div className="tw-flex tw-items-center tw-w-full">
                            <div className="tw-w-4 tw-mr-2">
                                {executingNodeIds.has(node.id) && (
                                    <Loader2Icon
                                        stroke="#33ffcc"
                                        strokeWidth={3}
                                        size={24}
                                        className="tw-h-4 tw-w-4 tw-animate-spin"
                                    />
                                )}
                            </div>
                            {formatNodeTitle(node.type as NodeType, node.data.title)}
                            {(() => {
                                const assistantItems = nodeAssistantContent.get(node.id) || []
                                const latestPercent =
                                    node.type === NodeType.LLM
                                        ? getLatestTokensPercent(assistantItems)
                                        : null
                                return (
                                    <div className="tw-ml-auto tw-flex tw-items-center tw-gap-2">
                                        {node.type === NodeType.LLM && latestPercent != null && (
                                            <span className="tw-text-xs tw-tabular-nums tw-opacity-70">
                                                {formatPercentLabel(latestPercent)}
                                            </span>
                                        )}
                                        {onRunFromHere && (
                                            <RunFromHereButton
                                                nodeId={node.id}
                                                className="tw-w-[1.75rem] tw-h-[1.75rem]"
                                                disabled={isPaused || executingNodeIds.size > 0}
                                                onClick={() => onRunFromHere(node.id)}
                                            />
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        {(nodeResults.has(node.id) ||
                            (node.type === NodeType.LLM && nodeAssistantContent.has(node.id))) && (
                            <div className="tw-mt-1 tw-space-y-4">
                                {node.type === NodeType.LLM && nodeAssistantContent.has(node.id) && (
                                    <div
                                        className="tw-max-h-64 tw-overflow-y-auto"
                                        ref={el => {
                                            if (el) {
                                                assistantScrollRefs.current.set(node.id, el)
                                            } else {
                                                assistantScrollRefs.current.delete(node.id)
                                            }
                                        }}
                                        onScroll={e => handleAssistantScroll(node.id, e.currentTarget)}
                                    >
                                        <Accordion type="multiple">
                                            {(() => {
                                                const items = nodeAssistantContent.get(node.id) || []

                                                const filterLastTextMatchingResult = (
                                                    arr: AssistantContentItem[],
                                                    result: string | undefined
                                                ): AssistantContentItem[] => {
                                                    const r = (result || '').trim()
                                                    if (!r) return arr
                                                    for (let i = arr.length - 1; i >= 0; i--) {
                                                        const it = arr[i]
                                                        if (it.type === 'text' && it.text.trim() === r) {
                                                            return [
                                                                ...arr.slice(0, i),
                                                                ...arr.slice(i + 1),
                                                            ]
                                                        }
                                                    }
                                                    return arr
                                                }

                                                const finalResult = nodeResults.get(node.id)
                                                const displayItems =
                                                    node.type === NodeType.LLM
                                                        ? filterLastTextMatchingResult(
                                                              items,
                                                              finalResult
                                                          )
                                                        : items

                                                const pairedMap = new Map<string, string | undefined>()
                                                for (const it of items) {
                                                    if (it.type === 'tool_result' && it.toolUseID) {
                                                        pairedMap.set(it.toolUseID, it.resultJSON)
                                                    }
                                                }
                                                return displayItems
                                                    .filter(it => it.type !== 'tool_result')
                                                    .map((it, idx) =>
                                                        renderAssistantAccordionItem(
                                                            it,
                                                            idx,
                                                            node.id,
                                                            it.type === 'tool_use'
                                                                ? pairedMap.get(it.id)
                                                                : undefined
                                                        )
                                                    )
                                            })()}
                                        </Accordion>
                                    </div>
                                )}

                                <div>
                                    <h4 className="tw-text-xs tw-font-semibold tw-text-[var(--vscode-foreground)] tw-mb-1">
                                        Result
                                    </h4>
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
                                            onChange={e => handleCommandChange(node.id, e.target.value)}
                                        />
                                    ) : (
                                        <Textarea
                                            value={nodeResults.get(node.id) || ''}
                                            readOnly={true}
                                            style={{
                                                backgroundColor: 'var(--vscode-sideBar-background)',
                                            }}
                                        />
                                    )}
                                </div>

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
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )

    // Auto-scroll: on assistant content updates or when user resumes bottom, scroll to bottom for nodes not paused
    const assistantItemsTick = (() => {
        let count = 0
        for (const items of nodeAssistantContent.values()) {
            count += Array.isArray(items) ? items.length : 0
        }
        return count
    })()
    useEffect(() => {
        // re-run when assistant content changes (tracked via assistantItemsTick)
        if (assistantItemsTick >= 0) {
            for (const [nodeId, el] of assistantScrollRefs.current) {
                if (el && !pausedAutoScroll.has(nodeId)) {
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
                <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
                    <h3 className="tw-text-[var(--vscode-sideBarTitle-foreground)] tw-font-medium tw-text-center">
                        Playbox
                    </h3>
                    {isPaused && (
                        <span className="tw-text-xs tw-bg-[var(--vscode-statusBarItem-warningBackground)] tw-text-[var(--vscode-statusBarItem-warningForeground)] tw-px-2 tw-py-1 tw-rounded">
                            Paused
                        </span>
                    )}
                </div>
                <div className="tw-space-y-2">
                    {hasParallelAnalysis && parallelGroups.length > 0
                        ? allItemsInOrder.map(item => {
                              if (item.type === 'parallel') {
                                  const stepLabel = getStepLabel(item.stepIndex, item.nodes.length)
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
        </div>
    )
}
