# Technical Architecture

This document provides a deep technical overview of NebulaFlow's architecture, focusing on implementation details, code organization, and internal mechanisms. For a high-level overview, see [Architecture](../getting-started/architecture.md).

## Codebase Organization: Vertical Slice Architecture (VSA)

NebulaFlow follows a **Vertical Slice Architecture** where code is organized by features (slices) rather than technical layers. This maximizes context locality and keeps all code required to understand a feature within the fewest possible files and folders.

### Directory Structure

```
src/
  extension.ts                    # VS Code extension entry point
workflow/
  Application/                    # Orchestration and message handling
    register.ts                   # Extension activation and webview setup
    messaging/                    # Protocol converters and message handling
    workflow-session.ts           # Workflow session management
  Core/                          # Pure business logic (no side effects)
    models.ts                     # Node types and data structures
    Contracts/                    # Shared protocol contracts
      Protocol.ts                 # Message types for extension-webview communication
  DataAccess/                     # I/O operations (file system, storage)
    fs.ts                         # File system operations for workflows/subflows
  Execution/                      # Node execution logic
    Application/handlers/         # Workflow execution handler
    Core/engine/                  # Parallel scheduler
    Core/execution/               # Input evaluation, output combination
    Application/node-runners/     # Individual node executors
  LLMIntegration/                 # LLM provider integrations (Amp, OpenRouter)
  Shared/                         # Generic primitives (Host, Infrastructure)
    Host/                         # VS Code host adapter
    Infrastructure/               # Messaging, workspace management
  Web/                           # Webview UI (React + React Flow)
    components/                   # React components
      nodes/                      # Node UI components
    services/                     # Protocol communication
    WorkflowApp.tsx               # Main webview application
```

### Slice Boundaries

Each slice is self-contained and does not import internals from other slices. Communication happens through explicit contracts (interfaces) or events.

- **Application slice**: Orchestrates workflows, handles messages, manages sessions.
- **Core slice**: Contains pure business logic (node types, models, protocol contracts).
- **DataAccess slice**: Handles I/O (file system, storage) – side effects isolated.
- **Execution slice**: Implements node execution logic, parallel scheduler, node runners.
- **LLMIntegration slice**: Integrates with external LLM providers (Amp, OpenRouter).
- **Shared slice**: Generic primitives (Host, Infrastructure) used across slices.
- **Web slice**: React UI, React Flow graph, node components, protocol communication.

## Flow Model (REPR)

Requests flow through four logical stages: Entry → Application → Core → Infra.

### Example: Executing a Workflow

1. **Entry**: VS Code command `nebulaFlow.openWorkflow` creates a webview panel. The webview sends an `execute_workflow` message.
2. **Application**: `ExecuteWorkflow.ts` handler validates nodes/edges, sets up execution context, and delegates to the scheduler.
3. **Core**: Pure functions evaluate inputs (`evalTemplate`), combine outputs (`combineParentOutputsByConnectionOrder`), and manage state (loop states, accumulator values).
4. **Infra**: `executeCLINode` runs shell commands via `child_process`; `executeLLMNode` calls Amp SDK; `safePost` sends messages to the webview.

### Code References

- **Entry**: `src/extension.ts` → `workflow/Application/register.ts`
- **Application**: `workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts`
- **Core**: `workflow/WorkflowExecution/Core/execution/inputs.ts`, `workflow/WorkflowExecution/Core/execution/combine.ts`
- **Infra**: `workflow/WorkflowExecution/Application/node-runners/run-cli.ts`, `workflow/WorkflowExecution/Application/node-runners/run-llm.ts`

## Execution Engine

### Parallel Scheduler

NebulaFlow uses a **parallel scheduler** that executes nodes when their dependencies are satisfied. The scheduler is implemented in `workflow/WorkflowExecution/Core/engine/parallel-scheduler.ts`.

**Key Concepts**:
- **Node Index**: Maps node IDs to `WorkflowNodes` objects.
- **Edge Index**: Maps source/target IDs to edges for dependency tracking.
- **Loop States**: Tracks loop iteration counts and variables.
- **Accumulator Values**: Stores accumulated text across loop iterations.

**Algorithm**:
1. Build indexes for nodes and edges.
2. Compute in-degree for each node (number of incoming edges).
3. Nodes with zero in-degree are scheduled immediately.
4. When a node completes, decrement in-degree of its children; schedule when zero.
5. Loop nodes (`loop-start`, `loop-end`) manage iteration counts via `loopStates`.

**Code Reference**: `workflow/WorkflowExecution/Core/engine/parallel-scheduler.ts` (lines 1–200)

### Node Runners

Each node type has a dedicated runner that handles execution, error handling, and streaming.

| Node Type | Runner File | Key Responsibilities |
|-----------|-------------|----------------------|
| CLI | `run-cli.ts` | Spawn shell process, stream stdout/stderr, handle approval |
| LLM | `run-llm.ts` | Call Amp/OpenRouter SDK, stream assistant content, manage chat history |
| If/Else | `run-if-else.ts` | Evaluate condition, route execution path |
| Loop Start/End | `run-loop-start.ts`, `run-loop-end.ts` | Manage iteration count, loop variable |
| Input/Text | `run-input.ts` | Provide static text input |
| Accumulator | `run-accumulator.ts` | Concatenate inputs into variable |
| Variable | `run-variable.ts` | Set variable value from template |
| Preview | `run-preview.ts` | Display data in execution panel |
| Subflow | `run-subflow.ts` | Execute saved workflow as subgraph |

**Approval System**: CLI nodes require explicit user approval before execution. The node enters `pending_approval` state; the webview displays a prompt; user approves (`node_approved`) or rejects (`node_rejected`).

### State Management

Execution state is stored in `IndexedExecutionContext`:

```typescript
interface IndexedExecutionContext {
    nodeOutputs: Map<string, string | string[]>
    nodeIndex: Map<string, WorkflowNodes>
    edgeIndex: IndexedEdges
    loopStates: Map<string, { currentIteration: number; maxIterations: number; variable: string }>
    accumulatorValues?: Map<string, string>
    cliMetadata?: Map<string, { exitCode: string }>
    variableValues?: Map<string, string>
    ifelseSkipPaths?: Map<string, Set<string>>
}
```

**Pause/Resume**: Workflows can be paused and resumed from any node. The `ResumeDTO` contains seeds for variables, decisions, and outputs.

## Protocol

The extension and webview communicate using a custom workflow message protocol defined in `workflow/Core/Contracts/Protocol.ts`. All messages extend `BaseWorkflowMessage` with a `type` field.

### Message Flow

1. **Webview → Extension**: Commands (e.g., `execute_workflow`, `node_approved`).
2. **Extension → Webview**: Events (e.g., `execution_started`, `node_execution_status`).

### Example: CLI Node Execution

1. Webview sends `execute_workflow` with nodes/edges.
2. Extension validates, starts parallel scheduler.
3. Scheduler selects CLI node, calls `executeCLINode`.
4. `executeCLINode` checks `needsUserApproval`; if true, sends `node_execution_status` with `status: 'pending_approval'`.
5. Webview shows approval prompt; user clicks approve → sends `node_approved`.
6. Extension spawns shell process, streams `node_output_chunk` events.
7. On completion, sends `node_execution_status` with `status: 'completed'`.

### Payload Types

- `WorkflowPayloadDTO`: Contains nodes, edges, state, resume metadata.
- `NodeExecutionPayload`: Node status, result, error information.
- `AssistantContentItem`: Structured LLM content (text, thinking, tool use).
- `SubflowDefinitionDTO`: Reusable workflow definition.

## Build System

### Webview Build (Vite)

The webview is built using Vite with React plugin. Configuration: `workflow/Web/vite.config.mts`.

**Build Process**:
1. `npm run build:webview` → Vite bundles React app into `dist/webviews/`.
2. Output includes `workflow.html` and static assets.
3. Extension loads `workflow.html` into webview panel.

### Extension Build (esbuild)

The extension is bundled using esbuild. Configuration: `scripts/build-extension.ts`.

**Build Process**:
1. `npm run build:ext` → esbuild bundles extension + SDK into `dist/extension.js`.
2. SDK sync: `sync:sdk` script copies Amp SDK from upstream location.
3. Environment variables: `AMP_API_KEY`, `OPENROUTER_API_KEY` are required at runtime.

### Full Build

`npm run build` triggers both webview and extension builds, plus SDK sync.

## Development Workflow

### Type Checking

`npm run check` runs TypeScript 5.x type checking. Configuration: `tsconfig.json`.

### Linting & Formatting

Biome is configured for linting and formatting. Commands:
- `npm run lint` – lint only
- `npm run format` – format code
- `npm run biome` – auto-fix lint issues

### Debugging

1. Set `AMP_API_KEY` environment variable.
2. Launch VS Code extension host (F5).
3. Open NebulaFlow panel.
4. Test workflows with LLM/CLI nodes.

### Watching

- `npm run watch:webview` – watch webview changes (Vite HMR).
- Extension changes require reload (F5).

## Security

### CLI Execution

- **Approval System**: CLI nodes require explicit user approval.
- **Safety Levels**: Configurable safety levels (`safe` | `advanced`).
- **Environment Isolation**: Controlled environment variable exposure.
- **Shell Selection**: Configurable shell (bash, zsh, pwsh, etc.).

### LLM Integration

- **API Key Management**: Keys stored in environment variables (not in workflow files).
- **Model Selection**: User chooses models per node.
- **Content Filtering**: Optional content safety checks.

### File System

- **Workspace Isolation**: Workflows stored in workspace or user scope.
- **Path Validation**: Sanitized file paths.
- **Subflow Sandboxing**: Subflows execute in isolated contexts.

## Extensibility

### Custom Nodes

Users can save custom node configurations. Nodes are stored as JSON definitions and loaded via `provide_custom_nodes` event.

### Subflows

Reusable workflow components defined with input/output ports. Stored in workspace or global storage.

### Protocol Extensions

Message types are extensible via union types. New commands/events can be added without breaking existing functionality. Backward compatibility maintained through versioning.

## Testing Strategy

### Type Checking

- `npm run check` ensures TypeScript correctness.

### Linting

- `npm run lint` enforces code style and catches potential errors.

### Manual Testing

- Run extension via F5.
- Create workflows with various node types.
- Verify execution, streaming, approval, pause/resume.

### Future Automated Tests

- Unit tests for pure functions (Core slice).
- Integration tests for node runners.
- End-to-end tests for workflow execution.

## References

- [Vertical Slice Architecture Guide](../../../agent-docs/vsa-architecture.md)
- [Protocol Definition](../../workflow/Core/Contracts/Protocol.ts)
- [Node Types](../../workflow/Core/models.ts)
- [Execution Handler](../../workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts)
- [Parallel Scheduler](../../workflow/WorkflowExecution/Core/engine/parallel-scheduler.ts)
