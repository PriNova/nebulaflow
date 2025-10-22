import { CircleStop, Edit, File, Play, Save, Trash2 } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/shadcn/ui/accordion'
import styles from '../ui/shadcn/ui/accordion.module.css'
import { Button } from '../ui/shadcn/ui/button'
import { Input } from '../ui/shadcn/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/shadcn/ui/tooltip'
import { HelpModal } from './HelpModal'
import { PropertyEditor } from './PropertyEditor'
import { NodeType, type WorkflowNodes } from './nodes/Nodes'

interface WorkflowSidebarProps {
    onNodeAdd: (nodeOrLabel: WorkflowNodes | string, nodeType?: NodeType) => void
    selectedNode?: WorkflowNodes | null
    onNodeUpdate?: (nodeId: string, data: Partial<WorkflowNodes['data']>) => void
    onSave?: () => void
    onLoad?: () => void
    onExecute?: () => void
    onClear?: () => void
    isExecuting?: boolean
    onAbort?: () => void
    models: { id: string; title?: string }[]
    onSaveCustomNode: (node: WorkflowNodes) => void
    onDeleteCustomNode: (nodeId: string) => void
    onRenameCustomNode: (oldNodeTitle: string, newNodeTitle: string) => void
    customNodes: WorkflowNodes[]
    nodeErrors?: Map<string, string>
}

type CustomNodesByType = { [key in NodeType]?: WorkflowNodes[] }

const buttonStyle = {
    backgroundColor: 'transparent',
    padding: '0px 4px',
    margin: '0px 12px',
    height: '18px',
    minHeight: '18px',
    color: 'var(--foreground)',
    fontSize: '0.85rem',
    textAlign: 'left',
    display: 'inline-block',
    width: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
} as React.CSSProperties

const displayCategoryLabel = (type: string): string => {
    const categoryLabels: Record<string, string> = {
        [NodeType.LLM]: 'Agents',
        [NodeType.INPUT]: 'Text',
    }
    return categoryLabels[type] || type
}

export const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({
    onNodeAdd,
    selectedNode,
    onNodeUpdate,
    onSave,
    onLoad,
    onExecute,
    onClear,
    isExecuting,
    onAbort,
    models,
    onSaveCustomNode,
    customNodes,
    onDeleteCustomNode,
    onRenameCustomNode,
    nodeErrors,
}) => {
    const handleSave = async (): Promise<void> => {
        if (onSave) {
            onSave()
        }
    }

    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [renamingNode, setRenamingNode] = useState<string | null>(null)
    const [newNodeTitle, setNewNodeTitle] = useState<string>('')

    const handleRenameClick = (nodeTitle: string) => {
        setRenamingNode(nodeTitle)
        setNewNodeTitle(nodeTitle)
    }
    const handleRenameConfirm = (oldNodeTitle: string) => {
        if (onRenameCustomNode && newNodeTitle) {
            onRenameCustomNode(oldNodeTitle, newNodeTitle)
            setRenamingNode(null)
            setNewNodeTitle('')
        }
    }
    const handleRenameCancel = () => {
        setRenamingNode(null)
        setNewNodeTitle('')
    }

    const customNodesByType: CustomNodesByType = customNodes.reduce(
        (acc: CustomNodesByType, node: WorkflowNodes) => {
            const type = node.type || NodeType.CLI
            if (!acc[type]) {
                acc[type] = []
            }
            acc[type]?.push(node)
            return acc
        },
        {}
    )

    return (
        <div className="tw-w-full tw-border-r tw-border-border tw-h-full tw-bg-sidebar-background tw-p-4">
            <div className="tw-sticky tw-top-0 tw-z-10 tw-bg-sidebar-background tw-pb-4 tw-mb-2 tw-border-b tw-border-border">
                <div className="tw-flex tw-flex-col tw-gap-1">
                    <div className="tw-flex tw-flex-row tw-gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="tw-flex-1"
                                    onClick={onLoad}
                                >
                                    <File size={18} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open Workflow</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="tw-flex-1"
                                    onClick={handleSave}
                                >
                                    <Save size={18} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Save Workflow</TooltipContent>
                        </Tooltip>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="tw-flex-1"
                                onClick={isExecuting ? onAbort : onExecute}
                            >
                                {isExecuting ? <CircleStop size={18} /> : <Play size={18} />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {isExecuting ? 'Stop Execution' : 'Start Execution'}
                        </TooltipContent>
                    </Tooltip>
                    <Button variant="outline" size="sm" className="tw-w-full" onClick={onClear}>
                        Clear Workflow
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="tw-w-full"
                        onClick={() => setIsHelpOpen(true)}
                    >
                        Show Help
                    </Button>
                </div>
            </div>

            <Accordion type="single" collapsible>
                <AccordionItem value="cli">
                    <AccordionTrigger className="tw-text-sm">Shell Nodes</AccordionTrigger>
                    <AccordionContent>
                        <div className="tw-flex tw-flex-col tw-gap-2">
                            <Button
                                onClick={() => onNodeAdd('Shell Command', NodeType.CLI)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                Shell
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="llm">
                    <AccordionTrigger className="tw-text-sm">Agent Nodes</AccordionTrigger>
                    <AccordionContent>
                        <div className="tw-flex tw-flex-col tw-gap-2">
                            <Button
                                onClick={() => onNodeAdd('General Agent', NodeType.LLM)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                General Agent
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="preview">
                    <AccordionTrigger className="tw-text-sm">Preview Nodes</AccordionTrigger>
                    <AccordionContent>
                        <div className="tw-flex tw-flex-col tw-gap-2">
                            <Button
                                onClick={() => onNodeAdd('Preview', NodeType.PREVIEW)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                Preview
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="input">
                    <AccordionTrigger className="tw-text-sm">Text Nodes</AccordionTrigger>
                    <AccordionContent>
                        <div className="tw-flex tw-flex-col tw-gap-2">
                            <Button
                                onClick={() => onNodeAdd('Text', NodeType.INPUT)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                Text
                            </Button>
                            <Button
                                onClick={() => onNodeAdd('Accumulator', NodeType.ACCUMULATOR)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                Accumulator
                            </Button>
                            <Button
                                onClick={() => onNodeAdd('Variable', NodeType.VARIABLE)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                Variable
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="conditionals">
                    <AccordionTrigger className="tw-text-sm">Conditionals</AccordionTrigger>
                    <AccordionContent>
                        <div className="tw-flex tw-flex-col tw-gap-2">
                            <Button
                                onClick={() => onNodeAdd('If/Else', NodeType.IF_ELSE)}
                                className="tw-flex-1"
                                style={{ ...buttonStyle }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--vscode-button-secondaryHoverBackground)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                If/Else
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                {Object.entries(customNodesByType).length > 0 && (
                    <AccordionItem value="custom_nodes">
                        <AccordionTrigger className="tw-text-sm">Custom Nodes</AccordionTrigger>
                        <AccordionContent>
                            {Object.entries(customNodesByType).map(([type, nodes]) => (
                                <div key={type} className="tw-mb-2">
                                    <h4 className="tw-text-sm tw-font-medium tw-mb-1">
                                        {displayCategoryLabel(type)}
                                    </h4>
                                    <ul className="tw-space-y-1">
                                        {nodes?.map(node => (
                                            <li
                                                key={node.id}
                                                className="tw-flex tw-items-center tw-justify-between"
                                            >
                                                <button
                                                    type="button"
                                                    className="tw-flex-1 tw-text-left tw-px-2 tw-py-1 hover:tw-bg-[var(--vscode-button-secondaryHoverBackground)]"
                                                    style={buttonStyle}
                                                    onClick={() => onNodeAdd(node)}
                                                >
                                                    <span className="tw-truncate">
                                                        {node.data.title}
                                                    </span>
                                                </button>
                                                <div className="tw-ml-2 tw-flex tw-flex-row tw-gap-1">
                                                    {renamingNode === node.data.title ? (
                                                        <div className="tw-flex tw-flex-row tw-gap-1">
                                                            <Input
                                                                value={newNodeTitle}
                                                                onChange={e =>
                                                                    setNewNodeTitle(e.target.value)
                                                                }
                                                                className="tw-h-6 tw-text-sm"
                                                            />
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2 tw-text-sm"
                                                                onClick={() =>
                                                                    handleRenameConfirm(node.data.title)
                                                                }
                                                            >
                                                                Save
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2 tw-text-sm"
                                                                onClick={handleRenameCancel}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2"
                                                                title="Rename"
                                                                onClick={() =>
                                                                    handleRenameClick(node.data.title)
                                                                }
                                                            >
                                                                <Edit size={14} />
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                className="tw-h-6 tw-px-2"
                                                                title="Delete"
                                                                onClick={() =>
                                                                    onDeleteCustomNode(node.data.title)
                                                                }
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>

            <div className="tw-my-4 tw-border-t tw-border-border" />
            <div className={`tw-text-sm ${styles['accordion-trigger']}`}>Property Editor</div>
            <div className="tw-p-2">
                {selectedNode ? (
                    <PropertyEditor
                        node={selectedNode}
                        onUpdate={onNodeUpdate!}
                        models={models}
                        onSaveCustomNode={onSaveCustomNode}
                        nodeError={nodeErrors?.get(selectedNode.id)}
                    />
                ) : (
                    <p className="tw-text-sm tw-text-muted-foreground tw-mt-2">
                        Select a node to edit its properties
                    </p>
                )}
            </div>
            <div className="tw-my-4 tw-border-t tw-border-border" />

            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </div>
    )
}
