import type { EdgeDTO, WorkflowNodeDTO, WorkflowPayloadDTO } from '../../Core/Contracts/Protocol'
import type { Edge, NodeType, WorkflowNode, WorkflowNodes } from '../../Core/models'

export function toProtocolNode(node: WorkflowNode): WorkflowNodeDTO {
    return {
        id: node.id,
        type: node.type as unknown as string,
        data: node.data as unknown as Record<string, unknown>,
        position: node.position,
        selected: node.selected,
    }
}

export function toProtocolPayload(payload: {
    nodes: WorkflowNodes[]
    edges: Edge[]
    state?: any
}): WorkflowPayloadDTO {
    const nodes = payload.nodes.map(n => toProtocolNode(n as WorkflowNode))
    const edges: EdgeDTO[] = payload.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
    }))
    return { nodes, edges, state: payload.state }
}

export function fromProtocolNode(dto: WorkflowNodeDTO): WorkflowNode {
    return {
        id: dto.id,
        type: dto.type as unknown as NodeType,
        data: dto.data as unknown as WorkflowNode['data'],
        position: dto.position,
        selected: dto.selected,
    }
}

export function fromProtocolPayload(dto: WorkflowPayloadDTO): {
    nodes: WorkflowNodes[]
    edges: Edge[]
    state?: any
} {
    const nodes: WorkflowNodes[] = (dto.nodes ?? []).map(n => fromProtocolNode(n))
    const edges: Edge[] = (dto.edges ?? []).map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
    }))
    return { nodes, edges, state: dto.state }
}
