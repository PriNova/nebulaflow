import type { Edge } from '@graph/CustomOrderedEdge'
import type { WorkflowNodes } from '@nodes/Nodes'
import { useMemo } from 'react'
import {
    type BranchSubgraphsResult,
    type ParallelAnalysisResult,
    computeBranchSubgraphs,
    computeParallelSteps,
} from '../../../WorkflowExecution/Core/engine/parallel-analysis'

export interface ParallelAnalysisHookResult {
    stepByNodeId: Map<string, number>
    steps: string[][]
    branchByIfElseId: Map<string, { true: Set<string>; false: Set<string> }>
}

/**
 * Hook to compute parallel analysis on the webview.
 * Memoizes the parallel step computation and branch subgraph analysis
 * based on changes to nodes and edges.
 *
 * @param nodes - Current workflow nodes
 * @param edges - Current workflow edges
 * @returns ParallelAnalysisHookResult with step mappings and branch info
 */
export function useParallelAnalysis(nodes: WorkflowNodes[], edges: Edge[]): ParallelAnalysisHookResult {
    const result = useMemo(() => {
        // Normalize handles but preserve all edge fields to avoid data loss
        const normalizedEdges = edges.map(e => ({
            ...e,
            sourceHandle: e.sourceHandle ?? undefined,
            targetHandle: e.targetHandle ?? undefined,
        }))

        const parallelSteps: ParallelAnalysisResult = computeParallelSteps(nodes, normalizedEdges)
        const branchSubgraphs: BranchSubgraphsResult = computeBranchSubgraphs(nodes, normalizedEdges)

        return {
            stepByNodeId: parallelSteps.stepByNodeId,
            steps: parallelSteps.steps,
            branchByIfElseId: branchSubgraphs.byIfElseId,
        }
    }, [nodes, edges])

    return result
}
