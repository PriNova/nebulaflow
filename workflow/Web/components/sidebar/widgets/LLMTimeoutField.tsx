import type React from 'react'
import { useEffect, useState } from 'react'
import { Input } from '../../../ui/shadcn/ui/input'
import type { LLMNode } from '../../nodes/LLM_Node'

interface LLMTimeoutFieldProps {
    node: LLMNode
    onUpdate: (nodeId: string, data: Partial<LLMNode['data']>) => void
}

export const LLMTimeoutField: React.FC<LLMTimeoutFieldProps> = ({ node, onUpdate }) => {
    const [val, setVal] = useState<string>('')
    useEffect(() => {
        const v = node.data.timeoutSec
        setVal(v === undefined ? '' : String(v))
    }, [node.data.timeoutSec])
    const commit = () => {
        const trimmed = val.trim()
        if (trimmed === '') {
            onUpdate(node.id, { timeoutSec: undefined })
            return
        }
        const n = Number.parseInt(trimmed, 10)
        if (Number.isFinite(n) && n >= 0) {
            onUpdate(node.id, { timeoutSec: n })
        }
    }
    return (
        <Input
            id={`llm-timeout-sec-${node.id}`}
            className="tw-h-8 tw-py-1 tw-text-sm"
            type="number"
            min={0}
            value={val}
            onChange={(e: { target: { value: string } }) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e: any) => {
                if (e.key === 'Enter') commit()
            }}
            placeholder="300"
        />
    )
}
