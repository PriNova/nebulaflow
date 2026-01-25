# Workflow Design

## Overview

NebulaFlow workflows are directed acyclic graphs (DAGs) composed of nodes and edges that execute in a parallel, streaming fashion. The workflow engine uses a **Kahn's topological sort** algorithm with ordered edges to determine execution order, enabling efficient parallel execution while respecting dependencies.

## Workflow Structure

### Nodes and Edges

A workflow consists of:
- **Nodes**: Individual execution units with specific types (LLM, CLI, Loop, etc.)
- **Edges**: Connections between nodes that define data flow and execution dependencies

Each node has:
- `id`: Unique identifier
- `type`: Node type (e.g., `llm`, `cli`, `loop-start`)
- `data`: Configuration and state (title, content, active status, etc.)
- `position`: Visual coordinates in the webview
- `selected`: Selection state (UI only)

Edges define:
- `id`: Unique identifier
- `source`: Source node ID
- `target`: Target node ID
- `sourceHandle` / `targetHandle`: Optional handle identifiers for multi-port nodes

### Execution Context

The workflow maintains several runtime contexts:
- **Node Outputs**: Map of node IDs to their execution results
- **Variable Values**: Map of variable names to their current values
- **Loop States**: Track iteration counts and loop variables
- **Accumulator Values**: Track accumulated values across iterations
- **Conditional Decisions**: Store IF/ELSE branch decisions
- **Disabled Nodes**: Nodes that should not execute (pruned branches)

## Execution Model

### Parallel Scheduler

The workflow engine uses a **parallel scheduler** that executes nodes concurrently when dependencies are satisfied. The scheduler implements Kahn's algorithm with the following optimizations:

1. **In-Degree Tracking**: Each node tracks how many dependencies must complete before it can start
2. **Ready Queue**: Nodes with zero in-degree are queued for execution
3. **Priority Sorting**: Ready nodes are sorted by edge order for deterministic execution
4. **Concurrency Control**: Per-node-type caps prevent resource exhaustion (e.g., 8 LLM nodes, 8 CLI nodes)

### Execution Flow

```
1. Initialize in-degree for all nodes
2. Populate ready queue with nodes having zero in-degree
3. While ready queue is not empty:
   a. Sort ready queue by edge order
   b. Start nodes up to concurrency limits
   c. Wait for node completion
   d. Decrement in-degree of children
   e. Add newly ready nodes to queue
4. Handle completion, errors, and pauses
```

### Hybrid Execution for Loops

Loops require special handling because they create cycles in the execution graph:

1. **Pre-Loop Nodes**: Nodes that execute before the loop starts
2. **Loop Body**: Nodes inside the loop (between LOOP_START and LOOP_END)
3. **Post-Loop Nodes**: Nodes that execute after the loop completes

The scheduler uses a **hybrid approach**:
- Parallel execution for non-loop segments
- Sequential execution within loop blocks
- Loop iterations are expanded at execution time

## Node Types

### LLM Node (`llm`)

Executes language model calls with streaming output.

**Configuration:**
- `model`: Model ID from available models
- `systemPromptTemplate`: Optional system prompt
- `timeoutSec`: Request timeout (default: 300s)
- `reasoningEffort`: Reasoning effort level (minimal/low/medium/high)
- `attachments`: Image attachments
- `disabledTools`: Tools to disable
- `dangerouslyAllowAll`: Allow all tools (security flag)

**Execution:**
- Streams assistant content (text, thinking, tool use)
- Maintains thread ID for conversation history
- Supports single-node and workflow execution modes

### CLI Node (`cli`)

Executes shell commands with streaming output.

**Configuration:**
- `mode`: `command` or `script`
- `shell`: Shell type (bash/sh/zsh/pwsh/cmd)
- `safetyLevel`: `safe` or `advanced`
- `streamOutput`: Stream stdout/stderr
- `stdin`: Input configuration (none/parents-all/parent-index/literal)
- `env`: Environment variable configuration
- `flags`: Execution flags (exitOnError, pipefail, etc.)

**Execution:**
- Streams output chunks to webview
- Captures exit code
- Supports approval workflow for unsafe commands

### Loop Nodes

#### Loop Start (`loop-start`)

Initiates a loop block.

**Configuration:**
- `iterations`: Number of iterations
- `loopVariable`: Variable name for iteration counter
- `overrideIterations`: Allow iteration count override
- `loopMode`: `fixed` or `while-variable-not-empty`
- `collectionVariable`: Variable to iterate over
- `maxSafeIterations`: Safety limit

**Execution:**
- Sets up loop state
- Executes loop body multiple times
- Updates loop variable each iteration

#### Loop End (`loop-end`)

Marks the end of a loop block.

**Execution:**
- Signals loop completion
- Allows post-loop nodes to start

### Conditional Nodes

#### IF/ELSE Node (`if-else`)

Branches execution based on condition.

**Configuration:**
- `truePathActive`: Visual indicator for true branch
- `falsePathActive`: Visual indicator for false branch

**Execution:**
- Evaluates input (truthy/falsy)
- Prunes non-chosen branch
- Materializes chosen branch edges

### Data Nodes

#### Variable Node (`variable`)

Sets a variable value.

**Configuration:**
- `variableName`: Name of the variable
- `initialValue`: Optional initial value

**Execution:**
- Evaluates template with parent inputs
- Stores result in variable map
- Output available to downstream nodes

#### Accumulator Node (`accumulator`)

Appends to a variable across iterations.

**Configuration:**
- `variableName`: Name of the accumulator variable
- `initialValue`: Optional initial value

**Execution:**
- Appends input to existing value
- Preserves value across loop iterations

#### Input Node (`text-format`)

Provides text input to the workflow.

**Configuration:**
- `content`: Text content

**Execution:**
- Outputs content directly
- Can be used as workflow input or loop override

### Utility Nodes

#### Preview Node (`preview`)

Displays text content without execution.

**Configuration:**
- `content`: Text to display

**Execution:**
- No actual execution
- Used for documentation or notes

#### Subflow Node (`subflow`)

Executes a reusable workflow.

**Configuration:**
- `subflowId`: ID of the subflow to execute
- `inputPortCount`: Number of input ports
- `outputPortCount`: Number of output ports

**Execution:**
- Loads subflow definition
- Maps inputs/outputs
- Executes subflow graph

## State Management

### Workflow State Persistence

Workflow state is persisted across save/load operations:

```typescript
interface WorkflowStateDTO {
  nodeResults: Record<string, NodeSavedState>
  ifElseDecisions?: Record<string, 'true' | 'false'>
  nodeAssistantContent?: Record<string, AssistantContentItem[]>
  nodeThreadIDs?: Record<string, string>
}
```

### Resume Support

Workflows can be resumed from any point:

```typescript
interface ResumeDTO {
  fromNodeId?: string
  seeds?: {
    outputs?: Record<string, string>
    decisions?: Record<string, 'true' | 'false'>
    variables?: Record<string, string>
  }
}
```

**Resume Behavior:**
- Nodes before `fromNodeId` are not re-executed
- Seed outputs are pre-loaded into context
- Seed decisions prune branches
- Seed variables initialize variable map

### Approval Workflow

Nodes can require user approval before execution:

1. Node enters `pending_approval` status
2. User reviews command in webview
3. User approves or rejects
4. Execution continues or aborts

## Flow Control

### Dependency Resolution

Nodes execute when all dependencies are satisfied:
- All parent nodes have completed
- IF/ELSE decisions have been made for conditional edges
- Loop iterations are complete

### Error Handling

**Fail-Fast Mode** (default):
- First error aborts all in-flight nodes
- Workflow stops immediately

**Continue-Subgraph Mode**:
- Errors in one branch don't affect other branches
- Useful for independent subgraphs

### Pause/Resume

Workflows can be paused:
- Pause signal prevents new node starts
- In-flight nodes complete normally
- Workflow can be resumed later

## Subflows

### Definition

Subflows are reusable workflow components with:
- **Inputs**: Named input ports
- **Outputs**: Named output ports
- **Graph**: Internal nodes and edges

### Execution

Subflows execute as single nodes in parent workflows:
- Inputs are mapped to internal input nodes
- Internal execution follows standard rules
- Outputs are collected from output nodes

### Port Mapping

```typescript
interface SubflowPortDTO {
  id: string
  name: string
  index: number
}
```

Ports are ordered by index for consistent mapping.

## Best Practices

### Design Principles

1. **Keep Nodes Small**: Single responsibility per node
2. **Use Meaningful Names**: Descriptive node titles
3. **Organize Visually**: Group related nodes
4. **Document with Preview Nodes**: Add notes to workflows

### Performance

1. **Limit Concurrency**: Use per-type caps for resource-intensive nodes
2. **Batch Operations**: Combine related CLI commands
3. **Cache Results**: Use variables to avoid recomputation

### Safety

1. **Require Approval**: Enable `needsUserApproval` for dangerous commands
2. **Set Timeouts**: Configure timeouts for LLM nodes
3. **Validate Inputs**: Use IF/ELSE nodes to validate data
4. **Limit Iterations**: Set `maxSafeIterations` for loops

### Debugging

1. **Use Preview Nodes**: Document expected behavior
2. **Check Outputs**: Inspect node results after execution
3. **Use Single-Node Execution**: Test nodes individually
4. **Monitor Token Counts**: Track LLM usage

## Protocol

### Message Flow

**Webview → Extension:**
- `save_workflow`: Save current workflow
- `load_workflow`: Load saved workflow
- `execute_workflow`: Start execution
- `node_approved` / `node_rejected`: Approval responses
- `execute_node`: Execute single node

**Extension → Webview:**
- `workflow_loaded`: Workflow data loaded
- `execution_started`: Execution began
- `node_execution_status`: Node status update
- `node_assistant_content`: LLM streaming content
- `execution_completed`: Execution finished

### Streaming

LLM and CLI nodes stream output in chunks:
- `node_output_chunk`: Individual output chunks
- `node_assistant_content`: Structured assistant content

## Configuration

### Environment Variables

- `AMP_API_KEY`: Required for LLM nodes
- `OPENROUTER_API_KEY`: Alternative LLM provider
- `NEBULAFLOW_DISABLE_HYBRID_PARALLEL`: Disable hybrid execution (debug)

### Execution Settings

- **Concurrency**: Global limit on parallel nodes
- **Per-Type Caps**: Limits for LLM (8) and CLI (8) nodes
- **Error Policy**: `fail-fast` or `continue-subgraph`
- **Timeout**: Default LLM timeout (300s)

## Examples

### Simple Linear Workflow

```
Input → LLM → Preview
```

### Branching Workflow

```
Input → IF/ELSE → LLM (true) → Preview
                → CLI (false) → Preview
```

### Loop Workflow

```
Input → Loop Start → LLM → Accumulator → Loop End → Preview
```

### Subflow Workflow

```
Input → Subflow (Process Data) → Output
```

## Troubleshooting

### Common Issues

**Node Never Starts:**
- Check in-degree (dependencies)
- Verify all parent nodes completed
- Check for disabled nodes

**Loop Doesn't Iterate:**
- Verify `iterations` is set
- Check `loopVariable` name
- Ensure LOOP_END exists

**LLM Timeout:**
- Increase `timeoutSec`
- Check API key configuration
- Verify model availability

**CLI Command Fails:**
- Check `safetyLevel` setting
- Verify shell compatibility
- Review approval workflow

### Debug Mode

1. **Single Node Execution**: Test nodes individually
2. **Preview Nodes**: Add checkpoints in workflow
3. **Variable Inspection**: Check variable values after execution
4. **Token Counts**: Monitor LLM usage

## See Also

- [LLM Nodes](./nodes/llm-nodes.md) - Detailed LLM node configuration
- [CLI Nodes](./nodes/cli-nodes.md) - CLI node options and safety
- [Loop Nodes](./nodes/loop-nodes.md) - Loop patterns and best practices
- [Variables & State](./variables-state.md) - Variable management
