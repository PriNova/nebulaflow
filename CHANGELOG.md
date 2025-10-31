# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed

### Added

### Changed

### Removed

## [NebulaFlow 0.2.8]

### Global Storage Scope (User vs Workspace) with Live Refresh

- Goal: Add per-user global storage for workflows and custom nodes, default to User; allow switching between User and Workspace; refresh lists without reload
- Added settings in [package.json](file:///home/prinova/CodeProjects/nebulaflow/package.json#L1-L33): `nebulaFlow.storageScope` (user/workspace, default user) and `nebulaFlow.globalStoragePath` (empty → home)
- Persistence reads/writes from workspace `.nebulaflow/` or user path with legacy migration preserved in [fs.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/fs.ts#L1-L432)
- Extended protocol with `get_storage_scope`, `storage_scope`, and `toggle_storage_scope` in [Protocol.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/Protocol.ts#L127-L251) and guards in [guards.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/guards.ts#L169-L313)
- Webview/extension wiring: scope request/updates, settings change listener, and badge hydration in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L128-L599)
- Sidebar shows a scope badge; clicking toggles scope and updates library immediately in [WorkflowSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/WorkflowSidebar.tsx#L18-L116) and [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L88-L451)
- Message handling updated to request and consume storage scope, avoiding race on initial load in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L129-L370)
- Ignored `tasks/` folder in [.gitignore](file:///home/prinova/CodeProjects/nebulaflow/.gitignore#L1-L6)

#### Behavior
- User scope shows global items across projects; Workspace shows project-local items
- Changing the setting or clicking the badge updates both the badge and the library list live, no window reload

## [NebulaFlow 0.2.7]

### Workflow Pause and Resume Functionality

#### Added
- **Pause Button in SidebarActionsBar**: New pause/resume button visible during workflow execution, positioned next to Stop button
  - Added `pause_workflow` command to [Protocol.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/Protocol.ts#L92-L99) for webview→extension pause requests
  - Added `execution_paused` event to [Protocol.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/Protocol.ts#L144-L147) for extension→webview pause state notification
  - Updated runtime guards in [guards.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/guards.ts) to accept pause messages
  - **Why**: Users can now pause long-running workflows and resume from where they stopped without losing execution state, improving workflow iteration and debugging

#### Changed
- **Core Engine Pause Gate**: Added pause gate to parallel scheduler in [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts)
  - Added `pause?: () => void` option to `ParallelOptions` interface for pause gate callback
  - Updated `tryStart()` method to consult pause gate before starting new nodes, preventing execution continuation while paused
  - Added pause detection in main loop to throw `PausedError` when inflight tasks drain, signaling clean pause point
  - Updated seed preload to skip already-completed seeded nodes even when included in seed set
  - **Why**: Pause mechanism respects parallel execution by waiting for inflight nodes to complete before pausing, ensuring consistent state

- **Extension Pause Request Handling**: Extended [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts) to manage pause state
  - Added `pauseRequested` flag to `ExecutionContext` for tracking active pause requests
  - Added message handler for `pause_workflow` command that sets pause flag and posts confirmation
  - Updated `abort_workflow` handler to properly reset pause state when stopping from paused state
  - Passed `pauseRef` callback to `executeWorkflow` function to connect webview pause requests with scheduler
  - **Why**: Pause requests from webview are properly integrated into extension execution flow without affecting other concurrent panels

- **Pause Event Handling in ExecuteWorkflow**: Modified handler in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts) to emit correct completion semantics
  - Added catch block to handle `PausedError` and post `execution_paused` event instead of `execution_completed`
  - Added `paused` flag to suppress `execution_completed` event when workflow is paused, keeping UI state synchronized
  - Cached AbortController before nulling to prevent controller leak in finally block
  - **Why**: Pause correctly signals paused state without clearing execution flags, enabling smooth resume workflow

- **Webview Resume Logic**: Updated [useWorkflowExecution.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts) to handle pause/resume transitions
  - Added `isPaused` state to track paused status
  - Added `onPauseToggle` handler that posts pause request when pausing and posts execute with complete seeds when resuming
  - Created new `AbortController` on resume to replace stale controller from prior execution
  - **Why**: Resume from pause correctly seeds all node outputs and decisions, allowing workflows to continue without re-execution of already-completed nodes

- **Message Handler Pause Support**: Extended [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts) to track pause events
  - Added `execution_paused` event handler that keeps execution open and sets paused flag
  - Updated state reset paths for `execution_started` and `execution_completed` to clear pause flag
  - **Why**: Webview correctly tracks pause state and distinguishes between paused, running, and completed states

- **Pause Button UI in SidebarActionsBar**: Added toggle button in [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx#L85-L101)
  - Button visible only during active execution
  - Icon toggles between Pause and Play icons based on paused state
  - Includes descriptive tooltips and ARIA labels for accessibility
  - **Why**: Clear visual button allows users to pause and resume workflows with single click

- **Paused State Indicator in RightSidebar**: Added "Paused" badge in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L760-L764) to make pause state unmissable
  - Warning-colored pill displayed near Playbox header when paused
  - **Why**: Users cannot miss paused state; clear visual indicator prevents confusion about workflow state

#### Fixed
- **Resume Restarting from Beginning Instead of Continuing**: Fixed critical issue where resume operations re-executed previously completed nodes instead of skipping them
  - Root cause: Only nodes without `bypass=true` were being disabled when seeded, causing bypass-seeded nodes to be considered for execution during resume
  - Solution: Updated seed preload in [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L157-L171) to unconditionally disable all seeded included nodes regardless of bypass status
  - Effect: Resume now correctly continues from the paused point by skipping all cached nodes and executing only remaining unexecuted nodes
  - **Why**: Resume semantics must guarantee that previously-completed nodes are skipped, maintaining execution state consistency

- **Bypass-Seeded Parent Deadlock**: Fixed critical issue where unconditional disabling of seeded bypass nodes caused in-degree deadlocks for downstream children
  - Root cause: In-degree calculation explicitly expects bypass-seeded parents to complete and emit signals even when cached; disabling them prevented signal emission
  - Solution: Restored conditional check to preserve bypass exception - only disable seeded nodes when bypass is NOT true ([parallel-scheduler.ts#L160-L170](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L160-L170))
  - Effect: Bypass nodes can now execute and unblock children even when their output is cached, restoring proper in-degree accounting
  - **Why**: Bypass logic depends on node execution flow for completion signals; disabling them entirely breaks downstream dependency resolution

#### Behavior
- Pause waits for all currently-executing nodes to complete before pausing the workflow
- Stop button works while paused and immediately terminates execution
- RunFromHere resets pause state and resumes execution from specified node
- Parallel execution respects pause gate: no new node starts while paused, inflight nodes complete
- Resume continues from paused point using cached outputs, decisions, and variables
- Bypass-seeded nodes remain executable when paused and seeded, allowing their completion signals to propagate to children

### Agent Node Token Percentage Indicator in RightSidebar

#### Added
- **Token Percentage Display on Agent Node Header**: Added real-time token usage percentage indicator to the Agent Node header in the RightSidebar
  - New utility `getLatestTokensPercent()` [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L13-L31) extracts the most recent token percentage from tool_result events in assistant content
  - New utility `formatPercentLabel()` [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L33-L39) formats percentage as "x %" with minimal decimals
  - Updated header rendering [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L561-L586) to display percentage indicator aligned right before Play button
  - Indicator updates automatically as tool_result events arrive; preserves last known value when subsequent events lack token data
  - **Why**: Users can now monitor token usage in real-time while Agent Nodes execute, improving visibility into token budget consumption during long-running operations

### Fixed
- **Pause/Resume Bypass IF/ELSE Node Silent Default Decision**: Fixed critical issue where bypass IF/ELSE nodes with no cached result would silently default their decision to `false`, potentially pruning the wrong branch and causing "Parallel scheduler cannot proceed" errors on resume
  - Root cause: Bypass IF/ELSE pre-completion (lines 242-255 in [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts)) evaluated `asText.trim().toLowerCase() === 'true'` with empty-string fallback when no seed existed, always defaulting to `false`
  - Solution: Added guard at [parallel-scheduler.ts#L243-L247](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L243-L247) to skip pre-completion for bypass IF/ELSE nodes without explicit seeds, deferring completion until upstream resume provides an explicit seeded decision
  - Effect: Pause/resume with bypass IF/ELSE nodes now completes without silent branch selection; users must provide explicit decisions for conditional bypass nodes
  - **Why**: Bypass nodes require user intent for branch selection; silent defaults obscure which branches execute and cause unexpected data flow and scheduler stalls

- **Parallel Scheduler Stall During Bypass Node Unblocking**: Fixed deadlock where scheduler would report "Parallel scheduler cannot proceed" when bypass nodes could still unblock downstream work
  - Root cause: Bypass pre-completion only ran once during scheduler initialization; subsequent stalls during execution did not recheck for newly-ready bypass nodes
  - Solution: Integrated `precompleteBypassFrontier()` into main scheduler loop at [parallel-scheduler.ts#L279-L287](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L279-L287), executing after each inflight task completes to detect and auto-complete ready bypass nodes
  - Effect: Bypass nodes now continuously unblock child dependencies mid-execution, eliminating false "cannot proceed" stalls in pause/resume workflows
  - **Why**: Bypass pre-completion must run iteratively during execution to handle dynamic node readiness after parent completion

- **Scheduler Stall Diagnostics Clarity**: Improved error messages when scheduler cannot proceed by listing blocked nodes and their missing parent dependencies
  - Solution: Enhanced diagnostic reporting at [parallel-scheduler.ts#L410-L429](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L410-L429) to compute and display "Node X blocked by [Y, Z]" relationships
  - Effect: Users see explicit dependency-chain information instead of generic "cannot proceed" errors, enabling faster root-cause analysis
  - **Why**: Blocking relationships clarify exactly where the dependency chain breaks and guide debugging of complex pause/resume scenarios

- **Resume Seeds from Stale Hook State**: Fixed resume operations incorrectly sourcing node outputs from hook's internal state rather than Flow's authoritative execution state
  - Root cause: `onPauseToggle()` in [workflowExecution.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts) was seeding from local `nodeResults` Map instead of `currentNodeResults` prop (the Flow-managed state continuously updated by message handlers)
  - Solution: Updated [workflowExecution.ts#L166-L201](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L166-L201) resume seeding to use `currentNodeResults` parameter plus variable state from hook, ensuring resume includes all completed outputs and decisions from actual execution
  - Effect: Resume now correctly continues from pause point with complete execution history instead of restarting workflow
  - **Why**: Flow component maintains authoritative `nodeResults` synced with backend messages; hook must respect this as the single source of truth to avoid state divergence

### Added

### Changed

### Removed

## [NebulaFlow 0.2.6]

### Bypass Checkbox for Node Results

#### Added
- **Bypass Mode Toggle for All Nodes**: New checkbox in PropertyEditor to skip re-execution and use cached node results
  - Added `bypass?: boolean` field to `BaseNodeData` in both [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx#L72-L79) and [models.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/models.ts#L32-L39)
  - Checkbox rendered in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/PropertyEditor.tsx#L143-L158) directly under "Node Active" control
  - **Why**: Users can bypass specific nodes during workflow execution to reuse previous results without re-running, accelerating iteration and testing workflows

#### Changed
- **Execution Short-Circuit for Bypassed Nodes**: Updated scheduler to skip node execution when bypass is enabled
  - Modified [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L152-L163) to preload seeds for bypass nodes before execution starts
  - Added short-circuit logic in `startNode` at [parallel-scheduler.ts#L512-L523](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L512-L523) to return cached result without re-executing node
  - Seeds cascade to child nodes, allowing bypassed outputs to propagate correctly through the workflow
  - **Why**: Prevents unnecessary node re-execution while preserving data flow through the graph

- **Bypass Result Propagation in Web Hook**: Extended [workflowExecution.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts) to collect and seed bypass results
  - In `onExecute`: Collects current results for bypassed nodes at [L73-L80](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L73-L80), computes bypass seeds before clearing results
  - In `onResume`: Merges bypass seeds with explicit seeds at [L122-L131](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L122-L131) to preserve cached results across resume operations
  - **Why**: Ensures bypass results flow correctly through both full executions and resume operations

- **Resume Filter Preserves Bypass Seeds**: Updated [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L232-L259) to maintain bypass node seeds even when pruning forward subgraph during resume
  - When filtering nodes for resume, bypass node seeds are preserved and passed to scheduler to ensure cached results are available to re-executed nodes
  - **Why**: Bypass results remain accessible to child nodes even during partial workflow resume operations

#### Behavior
- When bypass is checked on a node, execution uses the node's last-known result (or empty string if no prior result exists)
- Bypassed nodes do not execute; their cached output is immediately available to downstream nodes
- Empty results are treated like any other cached result and propagated unchanged
- Results persist through save/load cycles, enabling bypass reuse across editor sessions

#### Code Quality Recommendations (Not Implemented)
- Remove unnecessary `any` casts around `data.bypass` field accesses in [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts) at lines 123, 162, and 523 for improved type safety
- Update comment at [parallel-scheduler.ts L119](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L119-L126) to clarify bypass exception: "Treat seeded parents as satisfied unless the parent is included and bypassed"

### Reset Button for Workflow Results

#### Added
- **Reset Button on SidebarActionsBar**: New button to clear all node results and preview content without modifying workflow structure
  - Added `RotateCcw` icon import from lucide-react in [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx)
  - Added `onReset: () => void` prop to `SidebarActionsBarProps` interface for reset handler callback
  - Rendered Reset button between Execute/Stop and Clear buttons with tooltip "Reset Results"
  - Button disabled during workflow execution to prevent race conditions with active handlers
  - **Why**: Users can now clear execution results and start fresh without losing workflow structure. Disabled state during execution prevents state inconsistency.

#### Changed
- **Flow Component Reset Handler**: Implemented `onResetResults` callback in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L331-L343) that:
  - Clears `nodeResults` Map to remove all result text from nodes
  - Clears `nodeAssistantContent` Map to remove LLM assistant outputs
  - Clears `nodeErrors` Map to remove execution error messages
  - Blanks all Preview node content and resets their tokenCount to 0
  - Leaves workflow structure, topology, and If/Else decisions untouched
  - Enables repopulation of results as new execution messages arrive
  - **Why**: Reset operation preserves workflow integrity while providing clean slate for re-execution or testing

### Preview Node Read-Only Modal

#### Added
- **Read-Only Modal for Preview Node**: Added a modal interface to Preview nodes matching Text node UX for viewing content
  - Extended [TextEditorModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/TextEditorModal.tsx) to support read-only mode via optional `readOnly` prop (defaults to `false`)
  - Made `onChange` handler optional with guard: `onChange?.(e.target.value)` to support read-only viewers
  - Added double-click handler to [Preview_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Preview_Node.tsx) to open modal when user double-clicks textarea
  - Fixed component signature to use `BaseNodeProps & { data: BaseNodeData }` pattern for proper `isEditing` property access
  - Rendered modal in read-only mode with content persistence (no editing allowed)
  - **Why**: Users can now inspect full Preview node content in a modal interface, improving readability and content discovery for long outputs

#### Changed
- **Modal Button Labeling for Read-Only Mode**: Updated button labels in [TextEditorModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/TextEditorModal.tsx) for clarity when modal is read-only
  - When `readOnly={true}`, button text changes from "OK" to "Close" and "Cancel" button is hidden
  - Maintains full button set for editable mode to preserve Text node workflow
  - **Why**: Read-only button labels clarify that the modal is for viewing only, not editing, reducing user confusion about the intended interaction

### Fixed

### Added

### Changed

### Removed

## [NebulaFlow 0.2.5]

### Text Node Modal Portal Rendering with Viewport-Relative Sizing

#### Changed
- **Dialog Portal Rendering**: Moved dialog overlay and content rendering into a React Portal anchored to `document.body`, escaping parent stacking contexts and preventing z-index constraint issues
  - Added `createPortal` import from `react-dom` in [dialog.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/ui/shadcn/ui/dialog.tsx#L2)
  - Dialog overlay now renders via `createPortal(overlay, document.body)` to bypass parent z-index layering; includes SSR guard (`typeof document !== 'undefined'`) for safety in non-DOM environments
  - **Why**: Portal rendering isolates the modal from parent layout contexts, ensuring the blurred overlay and modal container appear as self-contained UI elements without being constrained by parent CSS or stacking order

- **Viewport-Relative Modal Sizing**: Updated TextEditorModal to fill approximately 90% of viewport height with flexbox layout for responsive textarea sizing
  - DialogContent now uses `tw-h-[90vh] tw-flex tw-flex-col` to establish viewport-relative container and flex column layout in [TextEditorModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/TextEditorModal.tsx#L45)
  - Textarea element changed from `tw-min-h-[50vh]` to `tw-flex-1 tw-resize-none`, allowing it to fill remaining flex space without manual resize capability
  - **Why**: Viewport-relative sizing makes the modal approximately 2x larger than the previous 50vh minimum height, improving readability and interaction surface for text editing while keeping it responsive to viewport size changes

- **Fixed Dialog State Management**: Restored boolean parameter check in onOpenChange handler to prevent unintended cancel calls
  - Changed from `onOpenChange={() => onCancel()}` to `onOpenChange={next => { if (!next) onCancel() }}` in [TextEditorModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/TextEditorModal.tsx#L39-L42)
  - Ensures `onCancel()` only fires when the modal closes (`next === false`), not on every state change including open transition
  - **Why**: The previous handler called cancel on every state change, which immediately closed the modal after opening. The fix restores proper dialog lifecycle by only invoking cancel during close transitions

- **Escape Key Propagation Fix**: Updated keydown handler to allow Escape key to propagate to the overlay for proper modal dismissal
  - Modified [dialog.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/ui/shadcn/ui/dialog.tsx#L62-L66) content keydown handler to explicitly check `if (e.key !== 'Escape') e.stopPropagation()`, allowing Escape to bubble up
  - Maintains stopPropagation for all other keys to prevent textarea's keydown from interfering with dialog behavior
  - **Why**: Allows users to dismiss the modal with the Escape key, matching standard modal interaction patterns and the Delete confirmation modal's behavior

### Preview Merge Order Respects Ordered Edges

#### Fixed
- **Preview Node Output Ordering in Multi-Parent Scenarios**: Fixed issue where preview content merge order failed to respect edge ordering when multiple parents fed into a preview node
  - Root cause: Message handler built its parent edge order map from base `edges` array which lacked the computed `orderNumber` field (set during edge sorting)
  - Solution: Pass `orderedEdges` (containing the computed `orderNumber` from edge index position) into message handling instead of base `edges` array for edge sorting in `computePreviewContent`
  - Updated [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts) to accept and use `orderedEdges` for edge order map construction
  - **Why**: Preview nodes now correctly concatenate parent outputs in their proper execution order, ensuring content is merged predictably when multiple parents produce output in a defined sequence
  - Verified: Edge ordering flows through [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) and integrates with existing `orderedEdges` computation

### Parallel Step Group Styling Update

#### Changed
- **Parallel Step Group Border Color**: Updated parallel step group borders from blue to grey for better visual distinction from execution state indicators
  - Updated [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx) to apply grey border color to parallel step group headers
  - **Why**: Grey borders provide clearer visual hierarchy, reducing confusion with blue execution state indicators while maintaining grouping clarity

### Sequential Task Width Responsive Adjustment

#### Fixed
- **RightSidebar Resize Responsiveness for Sequential Tasks**: Fixed issue where sequential task node items did not expand to fill available width when RightSidebar was resized
  - Updated [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx) layout styling to use flex layout with appropriate `flex-grow` property on node items
  - Node items now scale horizontally to match the parallel group border width, maintaining alignment with parallel step group boundaries
  - **Why**: Users can now resize the sidebar and see all node items expand uniformly, improving layout consistency and making better use of available sidebar space

### Dynamic Input (Fan-In) Connections - Explicit Handle Assignment on Connect

#### Fixed
- **Fan-In Edge Anchor Misalignment**: Resolved issue where connections dropped onto fan-in node bodies created edges without concrete `targetHandle`, causing visual anchor drift and incorrect handle count derivation
  - Root cause: Edges anchored without specific handle (targetHandle = undefined) rendered off-axis and caused fan-in count to jump by "+1 free" after drop because handle count derived via `toNode.length + 1` instead of `maxIdx + 2`
  - Solution: On connect, if target node has `fanInEnabled` and `targetHandle` is missing, assign the next free slot (`in-0`, `in-1`, etc.) before creating the edge
  - Updated [edgeOperations.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/edgeOperations.ts#L64-L101) to compute patchedParams with assigned handle before edge creation
  - **Why**: Every connection into a fan-in node now gets a specific handle ID, keeping handle count stable ("connected + 1 free" via `maxIdx + 2`) and edge geometry aligned to the exact handle's x-position
  - Verified: Fan-in spacing ([FanInTargetHandles.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/FanInTargetHandles.tsx#L4-L21)) uses `layoutSlots = Math.max(2, count)` and centers via `translateX(-50%)`; fan-in count derivation ([nodeStateTransforming.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/nodeStateTransforming.ts#L7-L21)) already stable; all nodes properly call `useUpdateNodeInternals` on handle count changes

### Added

### Changed

### Removed

## [NebulaFlow 0.2.4]

### Workflow Execution Stop Indicator - Orange Border for Completed Runs

#### Added
- **Visual Stop Indicator for Completed and Interrupted Workflows**: Workflows now show where execution stopped with a persistent orange border, even when completed successfully or interrupted
  - New `stoppedAtNodeId` field in [ExecutionCompletedEvent](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/Protocol.ts#L135-L138) (optional, backward compatible) to track final execution position
  - Backend handlers ([ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L138-L144), [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L57-L85)) capture last executed node and include in completion event
  - Frontend state management in [workflowExecution.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L25-L113) tracks `stoppedAtNodeId` with proper reset on new execution
  - Message handler in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L83-L231) tracks `lastExecutedNodeId` via ref and applies fallback when stop event doesn't carry explicit node ID
  - Node styling reuses existing `interrupted` flag in [nodeStateTransforming.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/nodeStateTransforming.ts#L15-L43) to apply orange border to stopped nodes
  - **Why**: Users can now visually identify where execution paused or completed without manually scanning the graph, improving workflow debugging and resume operations. Visible stop indicators work with "Start", "RunFromHere", and "RunOnlyThis" execution modes.

#### Fixed
- **Stale Last Executed Node Ref on Execution Start**: Fixed bug where `lastExecutedNodeIdRef` was not reset when `execution_started` event arrived, causing prior run's node to leak into fallback when current run completed no node
  - Added explicit ref reset in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L221-L224) on `execution_started` event
  - **Why**: Prevents stale node IDs from previous executions from incorrectly influencing current execution UI state and ensures each run starts with clean indicators

### Parallel Execution Path Analysis and RightSidebar Grouping

#### Added
- **Parallel Execution Step Analysis Engine**: Implemented topological step assignment to identify which nodes execute in parallel and which sequentially
  - New module: [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts) provides `computeParallelSteps()` using Kahn's algorithm to assign all nodes to dependency-chain levels (execution steps)
  - Parallel nodes (same step index) can execute concurrently; sequential chains increment step index through dependencies
  - Loop nodes excluded from parallel analysis (assigned step -1 "unsupported")
  - Efficient adjacency-list indexing and O(V+E) edge ordering for deterministic step assignment
  - Branch-aware subgraph mapping via `computeBranchSubgraphs()` to identify true/false branch-exclusive node sets for visual decoration
  - **Why**: Workflows with parallel paths lack clarity on which nodes run together; step assignment makes execution parallelism immediately visible

- **Web Hook for Parallel Analysis Integration**: Memoized hook normalizes ReactFlow edges and invokes Core analysis functions
  - New module: [parallelAnalysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/parallelAnalysis.ts) exports `useParallelAnalysis()` hook
  - Returns `stepByNodeId` map (node → execution step), `steps` 2D array (step → nodes), and branch subgraph mapping
  - Normalizes null edge handles to undefined for consistent shape
  - **Why**: Decouples Web UI from Core analysis; recomputation only when edges/nodes change

- **RightSidebar Node Grouping by Parallel Step**: Nodes in sidebar now grouped by execution step with visual headers
  - Updated [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx) to render step groups with header "Parallel Step N (X nodes)"
  - Branch hints appended ("– True" or "– False") when all nodes in a step are branch-exclusive
  - Falls back to ungrouped display when parallel analysis unavailable
  - Preserves all existing node accordions, status icons, and approval workflows
  - **Why**: Users can immediately see which nodes execute in parallel vs. sequentially without analyzing the graph manually

- **Flow Component Integration**: Parallel analysis wired into Flow component and passed to RightSidebar
  - Updated [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) to call `useParallelAnalysis()` hook
  - Results passed to RightSidebar via props; optional `parallelStep` data augmented to sorted nodes for future canvas badge display
  - **Why**: Centralizes analysis computation and enables optional visual feedback on nodes

#### Fixed
- **Branch Exclusivity Accuracy**: Fixed IF/ELSE node analysis to correctly identify exclusive branch sets
  - Previous BFS traversal collected all reachable nodes, causing merge-point nodes to appear in both true/false sets
  - New implementation: merge-aware traversal stops at convergence points; exclusive sets computed as `true XOR false` per IF node
  - Ensures sidebar branch hints ("True"/"False") only appear when nodes are genuinely exclusive to one branch
  - Changes in [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L166-L186) with helper functions at [L234-L283](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L234-L283)

- **Kahn Traversal Algorithmic Complexity**: Reduced from O(V×E) to O(V+E) through adjacency indexing
  - Built adjacency maps `Map<source, targetIds[]>` and `id → node` lookup to eliminate linear node searches in inner loops
  - Replaced `find` over `activeNodes` with O(1) map lookups
  - Changes in [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L60-L137)

- **Edge Ordering Determinism**: Stabilized step assignment order independence via sorted edge keys
  - Added `buildOrderIndexForParallelAnalysis()` function to establish stable sort key based on `source|target|sourceHandle|targetHandle`
  - Replaces reliance on ambient incoming-edge array position which could shift if React Flow reorders edges
  - Changes in [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L183-L205)

- **React Recomputation Hygiene**: Eliminated unnecessary `sortedNodes` recalculation on every render
  - Preserved full edge objects in web hook (spreading instead of selective mapping) to maintain metadata and stabilize derived outputs
  - Changes in [parallelAnalysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/parallelAnalysis.ts#L29-L35)

### Selected Node Highlighting in RightSidebar

#### Added
- **Selection Border for Sidebar Node Items**: When a user selects a node on the ReactFlow canvas, the corresponding item in RightSidebar now renders with a green border to provide visual feedback of the current selection
  - Updated [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L43-L51) `getBorderColorClass` helper to render green border for selected nodes using `var(--vscode-testing-iconPassed)` CSS variable
  - Selection border respects precedence: Executing (yellow) > Interrupted (orange) > Selected (green) > Default (transparent)
  - Added selection summary helper [selectionHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/selectionHandling.ts#L5-L29) to extract `selectedNodeId` from `selectedNodes` array
  - Threaded selection summary through [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L509-L510) to [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx) for active item highlighting
  - **Why**: Users can now visually identify which node is selected on the canvas by seeing its corresponding item highlighted with a green border in the sidebar, improving UX clarity

#### Fixed
- **Selection Summary Memoization**: Memoized `buildSelectionSummary(selectedNodes)` in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L95-L98) using `useMemo` with dependency on `selectedNodes` to prevent referential churn and unnecessary re-renders of `RightSidebar`
  - Selection summary is now computed only when `selectedNodes` changes, avoiding new object creation on every render cycle
  - **Why**: Prevents unnecessary re-renders of the sidebar component which was recalculating summary on every parent render

### Delete Workflow Confirmation Modal

#### Added
- **User Approval Mechanism for Delete Workflow Action**: Added confirmation modal to guard the destructive "Clear" (Delete) workflow action, preventing accidental deletion
  - New component: [ConfirmDeleteWorkflowModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/ConfirmDeleteWorkflowModal.tsx) provides reusable modal with Cancel/Delete buttons using existing dialog primitives and button variants
  - Modal accepts `open`, `onOpenChange`, `onConfirm`, and `onCancel` callbacks for complete control over lifecycle
  - Delete button uses "danger" variant for visual distinction of destructive action
  - Updated [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx) to manage modal visibility via local state and wire Trash button to open modal instead of immediately executing `onClear()`
  - User must confirm deletion in modal before `onClear()` is invoked; confirmation wires through the `onConfirm` callback
  - **Why**: Guards destructive workflow deletion behind user confirmation, reducing accidental data loss and improving user confidence in the UI

### Fixed

### Changed

### Removed

## [NebulaFlow 0.2.3]

### RightSidebar Title Header Renamed to "Playbox" with Center Alignment

#### Changed
- **RightSidebar Title Text and Styling**: Updated title header from default text to "Playbox" with horizontal center alignment
  - Changed heading text in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L416) to "Playbox"
  - Added `tw-text-center` class for horizontal centering of title
  - **Why**: Provides clearer labeling of the right sidebar content area and improves visual alignment consistency

### RunOnlyThis Button Disabled State During Execution

#### Added
- **Execution State Feedback for RunOnlyThis Buttons**: All node types now disable the "Run only this node" button while a single-node execution is active
  - Updated button disabling in [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx#L51-L56), [IfElse_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/IfElse_Node.tsx#L50-L55), [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx#L64-L69), [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx#L108-L113), [Variable_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Variable_Node.tsx#L50-L55)
  - [RunOnlyThisButton.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RunOnlyThisButton.tsx#L5-L11) accepts and forwards `disabled` prop to button element
  - Node data type already models `executing?: boolean` from execution context in [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx#L47-L58) and [models.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/models.ts#L32-L47)
  - **Why**: Prevents accidental double-click triggering while node execution is in-flight, providing visual feedback that an operation is active and reducing UI confusion

### LLM Node Workspace Root Prioritization for Active Workflows

#### Added
- **Active Workflow Workspace Detection**: LLM nodes now prioritize the workspace root of the active workflow when resolving SDK context paths
  - New module [workspace.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/workspace.ts) tracks the currently active workflow URI and exposes `getActiveWorkspaceRoots()` helper
  - `setActiveWorkflowUri()` called when workflows are loaded or created in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L130-L131), and cleared on panel disposal (line 413)
  - Workspace roots reordered with active workflow's folder first, followed by remaining workspace folders in original order
  - **Why**: When multiple workflows are open, LLM nodes should execute with context from their own workflow's workspace, not whichever workflow was opened last. This enables correct SDK path resolution and cross-workspace workflow execution.

#### Changed
- **ExecuteWorkflow LLM Handler**: Replaced hardcoded workspace folder enumeration with call to `getActiveWorkspaceRoots()`
  - [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L493-L494) now imports and calls `getActiveWorkspaceRoots()` instead of inline `vscode.workspace.workspaceFolders` mapping
  - Removed debug log statement that was adjacent to workspace roots retrieval
  - **Why**: Centralizes workspace root resolution logic and ensures consistent behavior across execution contexts

- **ExecuteSingleNode LLM Handler**: Extended workspace root prioritization to single-node execution path
  - [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L97-L98) now uses `getActiveWorkspaceRoots()` for consistency with full-workflow execution
  - **Why**: Single-node and full-workflow paths should respect the same workspace root priority to maintain behavioral parity

### RunOnlyThisButton Extended to Text, Variable, CLI, and If/Else Nodes

#### Added
- **Run Only This Node UI Expansion**: Extended "Run only this" feature to additional node types beyond LLM
  - Updated [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx#L104-L112) to render RunOnlyThisButton alongside "Run From Here" action
  - Updated [Variable_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Variable_Node.tsx#L46-L53) to support single-node execution
  - Updated [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx#L47-L55) to render RunOnlyThisButton with consistent placement
  - Updated [IfElse_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/IfElse_Node.tsx#L46-L54) to support single-node condition evaluation
  - All buttons dispatch consistent `nebula-run-only-this` custom event routed through Flow component
  - **Why**: Provides consistent user experience across all node types for rapid iteration and debugging

#### Fixed
- **If/Else Single-Node Execution Support**: Extended single-node handler to evaluate If/Else conditions in isolation
  - Added [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L36-L49) dispatch case for runIfElse
  - Implemented [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L255-L268) `executeSingleIfElseNode` helper that evaluates condition string with input replacement, returning `'true'` or `'false'` consistent with full-workflow behavior
  - **Why**: Enables testing If/Else logic without full workflow execution overhead, matching single-node semantics for all supported node types

### Centralized Node Dispatch and Extended Single-Node Execution

#### Added
- **Shared Node Dispatch Router**: Extracted node-type routing logic into a single source of truth to reduce duplication between full-workflow and single-node execution paths
  - New file: [NodeDispatch.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/NodeDispatch.ts) exports `routeNodeExecution` function that centralizes node-type dispatch
  - Function signature: `(node, context, options) => Promise<NodeResult>` supporting all node types with unified handler selection
  - Both [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L75-L110) and [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L35-L49) delegate to this shared router
  - **Why**: Single dispatch point ensures consistent behavior across execution paths and eliminates risk of divergence when handler logic evolves

- **Extended Single-Node Execution Type Support**: Single-node execution now handles Preview, Input, and Variable nodes in addition to LLM and CLI
  - [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L236-L259) implements handlers for Preview (posts token_count, returns templated output), Input (applies templating via replaceIndexedInputs), and Variable (returns computed value)
  - Unsupported types (IF_ELSE, LOOP_START/END, ACCUMULATOR) are explicitly rejected with clear error messages
  - Reuses shared input replacement helper `replaceIndexedInputs` for consistent content transformation
  - **Why**: Enables rapid iteration and testing of additional node types without full workflow overhead; maintains feature parity with future node type additions

#### Fixed
- **CLI Node Error Semantics in Single-Node Mode**: Preserved `AbortedError` as a distinct error type instead of wrapping all errors generically
  - [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L219-L229) now re-throws `AbortedError` unchanged and wraps only non-abort errors
  - Enables correct distinction between intentional cancellation and actual failures in caller error handling
  - **Why**: Preserves abort semantics so webview and UI can correctly respond to user-initiated cancellations vs. execution failures

### RunOnlyThis Single-Node Execution

#### Added
- **Run Only This Node**: New feature enabling users to execute a single node in isolation without running the entire workflow
  - Added `execute_node` command to [Protocol.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/Protocol.ts#L179-L198) with payload `{ node: WorkflowNodeDTO, inputs?: string[], runId?: number }` for self-contained single-node execution
  - Registered message routing and concurrency guard in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L259-L294) mirroring full-run start/completed events
  - New handler [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts) supporting LLM and CLI node types with input replacement via `replaceIndexedInputs`
  - LLM path uses Amp SDK with timeout/abort pattern matching full workflow behavior; CLI path reuses shell execution with optional approval flow
  - Posts `node_execution_status` events for running/completed/error/interrupted states, keeping UI consistent with full execution
  - UI button [RunOnlyThisButton.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RunOnlyThisButton.tsx) with distinct icon and tooltip, wired into [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx#L60-L66)
  - Webview listener in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L327-L354) gathers immediate parent outputs ordered by edge `orderNumber` and converts node to `WorkflowNodeDTO` via [nodeDto.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/utils/nodeDto.ts#L41-L58)
  - **Why**: Enables rapid iteration and testing of individual nodes without full workflow execution overhead, improving developer efficiency

#### Fixed
- **Concurrent-Run Guard for Single-Node Execution**: Removed premature `execution_completed` event when a run is already in progress
  - Changed [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L261-L266) to return early with info message instead of posting completion without matching start, preventing webview state machine confusion
  - **Why**: Execution guard should only post completion events after actually executing; posting without a start event breaks state tracking

### Inactive Nodes Visibility on ReactFlow Canvas

#### Fixed
- **Inactive Nodes Disappearing from Canvas**: Resolved issue where deactivating a node removed it entirely from the ReactFlow canvas instead of rendering it as transparent
  - Added `GraphCompositionMode` type to [node-sorting.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/node-sorting.ts#L257-L266) supporting `'execution'` (default) and `'display'` modes
  - Extended `processGraphComposition()` signature to accept optional `options` parameter with `mode` field to control node filtering behavior
  - In `'display'` mode, inactive nodes are included in the sorted graph; edges are preserved if both endpoints exist in the graph composition
  - Updated [nodeStateTransforming.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/nodeStateTransforming.ts#L100) canvas hook to explicitly request `mode: 'display'`, enabling inactive nodes to flow through to ReactFlow
  - Execution paths remain active-only via default `'execution'` mode, preserving runtime semantics
  - Existing node component styling (opacity and border color for inactive nodes) now applies correctly since nodes are no longer filtered before rendering
  - **Why**: The filtering was happening in the graph composition layer before nodes reached the canvas. By adding a display mode, the canvas can render the complete graph structure while execution remains unchanged, and users can see inactive nodes as transparent elements for workflow understanding

#### Optimized
- **Edge Filtering Performance**: Improved edge filtering from O(E·N) to O(E) in [node-sorting.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/node-sorting.ts#L269-L273)
  - Replaced repeated `some()` checks with precomputed `Set` for node ID lookups
  - Reused existing `filterEdgesForNodeSet` helper for edge filtering
  - **Why**: Avoiding repeated array searches significantly reduces computational overhead in large workflows during display and execution composition

### Fix DataCloneError When Saving Custom Nodes

#### Fixed
- **Custom Node Save DataCloneError**: Resolved `Failed to execute 'postMessage' on 'MessagePort': Ye=>P(me.id,Ye) could not be cloned` error when saving LLM nodes as custom nodes
  - Added sanitizer utility [nodeDto.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/utils/nodeDto.ts) to convert ReactFlow nodes to clone-safe `WorkflowNodeDTO` format
  - Sanitizer whitelists safe fields (`id`, `type`, `position`, `data`, `selected`) and recursively strips functions, symbols, and undefined values from nested data
  - Added cycle protection with `WeakSet` tracking to prevent infinite recursion on circular references
  - Updated [nodeOperations.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/nodeOperations.ts) to send sanitized DTO instead of raw node for `save_customNode` operations
  - Hardened [vscode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/utils/vscode.ts) with defensive try/catch wrapper around `postMessage` for better error visibility
  - **Why**: Runtime-injected fields like `data.onUpdate` (callbacks attached during render) are not serializable. Sanitization enforces the `WorkflowNodeDTO` contract expected by guards and handlers, enabling successful serialization across the webview boundary

### Text Node Inline Editing Support

#### Added
- **Inline Text Editing for INPUT Nodes**: Users can now double-click TEXT nodes to edit content inline, with real-time persistence and keyboard shortcuts
  - New file: [titleValidation.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/validation/titleValidation.ts) provides centralized title validation with max-length enforcement and default fallback
  - Updated [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx) to support edit mode: double-click to activate textarea, Enter to commit, Escape to cancel, Shift+Enter for newlines
  - Added `isEditing` and `onUpdate` callback to [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx) BaseNodeData type for edit state management
  - Global `nebula-edit-node` custom event in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) centralizes edit lifecycle (start/commit/cancel) and persists `content` to ensure display consistency
  - **Why**: Edits get persisted to `content`. Now the `content` field is synchronized from the textarea, ensuring edited text appears immediately in the `PropertyEditor`.

#### Enhanced
- **Drag-and-Drop Canvas Support**: TEXT nodes can now be created by dragging from the sidebar onto the canvas
  - Added `handleCanvasDragOver` and `handleCanvasDrop` handlers in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) to detect drag-over and drop-zone interactions
  - Drop position uses `reactFlowInstance.screenToFlowPosition()` to convert client coordinates to graph space
  - New TEXT nodes land in edit mode (`isEditing: true`) for immediate inline editing workflow
  - **Why**: Drag-and-drop creation is more discoverable than the sidebar button, reducing friction for adding input nodes

- **Node Update Callback Injection**: [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) now injects memoized `onUpdate` callbacks per node via `nodeUpdateCallbacks` map, allowing nodes to trigger parent updates directly
  - Updated [nodeOperations.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/nodeOperations.ts) `onNodeAdd` signature to accept optional `options` parameter (position, initialData) for customized node creation
  - [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) `sortedNodes` now includes `onUpdate` in node data, enabling nodes to call back without event dispatch
  - **Why**: Direct callbacks provide cleaner, more type-safe state updates than global event dispatch, reducing coupling and improving extensibility

- **Improved Node Creation Flow**: Topologically sorted nodes (`sortedNodes`) are now passed to ReactFlow instead of `nodesWithState`, ensuring correct graph traversal order in UI rendering
  - [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) computes `sortedNodes` with memoization and injects `onUpdate` callback per node
  - **Why**: Sorted node order helps with correct data flow visualization and matches execution order in complex workflows

### Edge Rendering Default Style Change to Bezier

#### Changed
- **Default Edge Style Switched to Bezier**: All edges now render as bezier curves by default instead of smoothstep
  - Updated `EDGE_STYLE_DEFAULT` from `'smoothstep'` to `'bezier'` in [CustomOrderedEdge.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/CustomOrderedEdge.tsx#L15)
  - Connection preview updated to display bezier curves while connecting nodes in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L336)
  - New edges seeded with `data: { edgeStyle: 'bezier' }` in [edgeOperations.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/edgeOperations.ts#L64-L69)
  - Removed hardcoded `type: 'smoothstep'` from programmatic edge creation in [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx#L117-L122)
  - Imported `ConnectionLineType` enum for preview styling in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L1)
  - **Why**: Provides consistent bezier rendering across seeded edges, connection previews, and saved edges; maintains extensibility through optional per-edge `edgeStyle` overrides in `edge.data`

### Modular Edge Path Styling Strategy

#### Added
- **Modular Edge Path Strategy System**: Extracted edge path selection into a reusable strategy pattern for flexible edge styling support
  - New file: [edgePaths.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/edges/edgePaths.ts) with `bezierPathStrategy` and `smoothStepPathStrategy` functions
  - Implemented `selectEdgePathStrategy(styleKey)` selector that maps style names to path generators with fallback to default
  - Strategy functions return tuple `[path, labelX, labelY, offsetX, offsetY]` matching @xyflow/react helpers
  - **Why**: Modular strategy enables easy addition of new edge styles and provides a clean integration point for future settings-based style selection without modifying render logic

#### Changed
- **CustomOrderedEdge Path Generation**: Refactored to use modular edge path strategy system
  - Replaced direct `getSmoothStepPath` call with `selectEdgePathStrategy(EDGE_STYLE_DEFAULT)`
  - Wrapped strategy selection in `useMemo` to avoid recomputation on each render
  - Default style set to `'smoothstep'` to maintain visual consistency with prior behavior
  - All edge properties (markers, styles, animation) preserved unchanged
  - **Why**: Memoization prevents unnecessary strategy recomputation; default unchanged preserves existing visual behavior

### Auto-Fit Workflow View on Load

#### Added
- **Automatic View Fitting on Workflow Load**: Workflows now automatically fit the view to display all nodes and edges when loaded, improving visibility for complex workflows
  - Added `FitViewHandler` child component that orchestrates fit-to-view logic inside the ReactFlow provider context
  - Created `requestFitOnNextRender` callback to trigger fit operations from message handlers
  - Fit operation respects sensible padding (0.2) and zoom bounds (0.5–1.5) to prevent excessive zoom-out
  - Empty workflows reset to default viewport instead of attempting to fit
  - RAF ID is stored and cleaned up on component unmount to prevent stale DOM operations
  - **Why**: Users can now load workflows of any size and see the complete graph at a glance, improving workflow understanding and navigation for larger or complex graphs

#### Fixed
- **useReactFlow Hook Context Error**: Resolved React error where `useReactFlow()` was called outside the ReactFlow provider
  - Moved hook invocation into a child component (`FitViewHandler`) rendered inside the `<ReactFlow>` provider boundary
  - Ensures hook always runs in correct context and prevents provider-related errors

- **Request Animation Frame Memory Leak**: Fixed cleanup of animation frame requests on component unmount
  - RAF ID is now stored in a ref and explicitly canceled in effect cleanup
  - Prevents scheduled operations from executing after component disposal

### Added

### Changed

### Removed

## [NebulaFlow 0.2.2]

### Workflow State Persistence Across Save and Load

#### Added
- **Node Output State Preservation**: Workflows now persist node execution results when saved, enabling "Run From Here" resume operations without state loss
  - Added `NodeSavedState` contract to capture result, status, error, and token count per node
  - Added `WorkflowStateDTO` envelope for persisting node results and If/Else branch decisions alongside workflow structure
  - Versioned format to 1.1.0 for workflows with saved state; backward compatible with 1.0.0 files
  - State hydration on load populates in-memory node results and decision maps without triggering workflow reset
  - **Why**: Users can now save workflows mid-execution, reload them with results intact, and resume from any node without errors due to missing prior output

### Fixed

### Changed

### Removed

## [NebulaFlow 0.2.1]

### If/Else Node Support in Parallel Workflow Execution

#### Added
- **If/Else Node Support in Parallel Scheduler**: Extended parallel execution engine to support If/Else control-flow nodes alongside already-supported sequential nodes
  - Added `ifElseDecisions` map to execution context for tracking If/Else branch outcomes
  - Implemented `buildConditionalEdges()` to identify all true/false branches from If/Else nodes
  - Conditional edges are excluded from initial in-degree calculation; placeholder counts applied upfront to prevent premature node readiness
  - Added `processIfElseCompletion()` to materialize chosen branches and prune non-chosen branches during execution
  - Added `disabledNodes` and `conditionalInPlaceholders` tracking to support branch pruning and deadlock detection refinement
  - If/Else nodes can now execute in parallel with other independent nodes, with proper in-degree accounting for conditional targets

#### Fixed
- **Parallel Scheduler - Incorrect In-Degree for Conditional Targets**: Fixed critical bug where conditional targets of If/Else nodes were not assigned placeholder in-degrees during initialization
  - Conditional targets now receive placeholder counts upfront, preventing premature queue readiness before If/Else completion
  - Ensures correct topological ordering and prevents race conditions in parallel execution
  
- **Parallel Scheduler - Unsupported Node Type Error Message**: Updated error message to accurately reflect supported node types
  - Changed from "Exclude IF/ELSE and LOOP nodes" to "Exclude LOOP nodes" since If/Else is now supported
  
- **Parallel Scheduler - Case-Sensitive Decision Parsing**: Made seed decision parsing case-insensitive
  - Seed decisions now normalized with `.toLowerCase()` before comparison to prevent mismatches from mixed-case inputs

#### Changed
- **ParallelOptions Interface**: Extended to accept `seeds.decisions` for seeding If/Else branch outcomes during workflow resume
- **ExecutionContext Interface**: Added `ifElseDecisions`, `disabledNodes`, `conditionalOutEdges`, and `conditionalInPlaceholders` maps
- **runNode() Handler**: Added If/Else case delegation to existing `executeIfElseNode()` helper

#### Resume and UI Integration
- **Webview Decision Persistence**: If/Else branch decisions are now captured and stored in webview execution state
- **Resume Seeding**: When resuming, captured decisions flow through `seeds.decisions` to ensure consistent branch paths
- **Deadlock Detection Refinement**: Disabled (pruned) nodes are now excluded from deadlock detection to prevent false positives

### Parallel Workflow Execution – Code Review Fixes and Tuning

### Fixed
- **Workflow Execution - Type Error in Parallel Execution State Migration**: Resolved type error in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L182)
  - Replaced `setExecutingNodeId(null)` with `setExecutingNodeIds(prev => new Set())` to correctly clear the set-based executing state after `executingNodeIds` migration
  - Ensures parallel execution state cleanup compiles without type errors

- **Parallel Scheduler - Remove Debug Log**: Removed stray `console.log("In parallel")` from [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L79)
  - Keeps extension console output clean during parallel execution

- **Parallel Scheduler - Tune Default Concurrency**: Reduced default concurrency limits from 8 to 2 in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L133) for both LLM and CLI node types
  - Aligns with safer operational defaults and reduces resource contention
  - Improves reliability of parallel execution on systems with constrained resources

### Added

### Changed

### Removed

## [NebulaFlow 0.2.0]

### Added
- **Parallel Workflow Execution**: Enabled multiple NebulaFlow panes to execute workflows concurrently without blocking each other
  - Refactored global execution state to per-panel execution context using WeakMap keyed by webview
  - Each panel now manages its own `AbortController`, approval state, and execution lifecycle independently
  - `panelExecutionRegistry` stores execution context (controller, pending approval promise) per webview
  - All message handlers (`execute_workflow`, `abort_workflow`, `node_approved`, `node_rejected`) scoped to requesting panel
  - Panel disposal cleanup and deactivation now abort only respective panel's controller deterministically via active controller tracking Set
  - **Why**: Users can now open multiple workflows and execute them simultaneously without the "execution blocked" notification

### Fixed
- **Workflow Execution - Concurrent Approval Guard**: Prevented approval overwrites when multiple approval requests arrive in rapid succession
  - Added validation to reject concurrent approval requests with a clear error message
  - Only one approval can be pending per panel at any time, ensuring approval promises resolve correctly and deterministically

- **Workflow Execution - Robust Disposed Webview Detection**: Improved reliability of disposed webview detection across VS Code versions and localizations
  - Replaced string inclusion check with regex pattern `/webview\s+is\s+disposed/i` to tolerate version variations and localized error messages
  - Maintains simplicity while handling edge cases in messaging layer where webviews may be disposed

- **Input Node Live Rendering Recursion Guard**: Protected workflow execution from infinite loops when live-rendering active INPUT nodes in `combineParentOutputsByConnectionOrder`
  - Added cycle detection via `visited` set tracking to prevent recursive traversal through misconfigured edges
  - Avoids undefined behavior if workflows contain cycles in their edge graph

- **Input Node Output Integrity**: Preserved workflow data integrity by removing unintended trimming on live INPUT node output
  - Removed `.trim()` normalization that was breaking workflows dependent on trailing whitespace or newlines
  - Retained CRLF normalization for consistent line ending handling

- **LLM Node Default Model Selection**: Fixed new LLM nodes defaulting to undefined model; now defaults to Sonnet 4.5
  - Added `DEFAULT_LLM_MODEL_ID` and `DEFAULT_LLM_MODEL_TITLE` constants for centralized model defaults across node creation and seed data
  - Updated `onNodeAdd` in nodeOperations.ts to assign default model when creating new LLM nodes
  - Enhanced `normalizeModelsInWorkflow` migration to handle legacy workflows without models by injecting Sonnet 4.5 defaults at load time, ensuring backward compatibility

- **LLM Node Reasoning Effort Default Selection**: Fixed missing default reasoning effort button selection in Property Editor when a new LLM node is added to the workflow
  - Added `DEFAULT_LLM_REASONING_EFFORT` constant to centralize 'medium' default across node creation, duplication, and seed data
  - Updated `createNode` factory in Nodes.tsx to apply default when LLM node lacks reasoning effort
  - Added `useEffect` hook in PropertyEditor.tsx to backfill missing `reasoningEffort` value on node selection via `onNodeUpdate()`
  - Updated PropertyEditor button display logic to show 'medium' button as selected when value is undefined using nullish coalescing
  - Enhanced ExecuteWorkflow.ts to validate and apply 'medium' fallback at runtime when executing LLM nodes, ensuring consistent `reasoning.effort` value sent to Amp SDK

### Added

### Changed

### Removed

## [NebulaFlow 0.1.9]

### Fixed
- **CLI Node Workspace Directory Resolution**: Fixed CLI node commands failing with ENOENT when executed in workspace paths other than VS Code installation directory
  - Extended shell executor to accept optional `cwd` parameter
  - CLI node now resolves the first workspace folder via `vscode.workspace.workspaceFolders` and passes it to the executor
  - When no workspace is open, gracefully falls back to extension process directory with user notification
  - Allows `npm run package:vsix` and other workspace-relative commands to execute correctly

### Fixed
- **LLM Node Dangerously Allow All Commands Regression**: Fixed regression where "Dangerously allow all commands" setting was not auto-approving blocked bash commands when the SDK's `toAllow` array was empty or missing
  - Broadened auto-approval condition to check `shouldApplyAllowAll` flag directly, ensuring all blocked commands are auto-approved when "dangerously allow all" is enabled, regardless of `toAllow` enumeration
  - Added observability logging when auto-approving without explicit `toAllow` list for audit trail visibility
  - Guard remains active: if Bash tool is disabled, `shouldApplyAllowAll` is false and user approval flow activates as safeguard

### Added
- **Preview Node Displays Parent Output Immediately**: Fixed Preview node to show content as soon as parent node completes, rather than waiting for Preview node execution
  - Added `getDownstreamPreviewNodes()` and `computePreviewContent()` helpers to resolve graph topology and aggregate parent outputs
  - Enhanced `useMessageHandler` hook to accept `edges` and `nodeResults` parameters for tracking parent completions
  - Updated `node_execution_status` message handler to propagate completion to downstream Preview nodes: when any non-Preview node finishes, connected Preview nodes compute new content from available parent outputs and update via `onNodeUpdate()`
  - Edge ordering (via optional `orderNumber` field) determines output concatenation order for multi-parent previews
  - Token count calculation preserved through `onNodeUpdate()` call
  - **Why**: Users expect preview content to appear as parents finish, providing immediate feedback during workflow execution rather than seeing blank previews until all nodes complete

- **Window Title Shows Loaded Workflow**: Display workflow filename in the NebulaFlow window title for multi-instance differentiation
  - Window title shows "NebulaFlow — <filename.json>" when a workflow is loaded, or "NebulaFlow — Untitled" when no file is open
  - Each panel instance maintains independent workflow state, allowing multiple workflows to be open simultaneously without blocking each other
  - Title updates on file save and load operations

- **LLM Node Reasoning Effort Control**: Added reasoning effort selector to LLM node configuration
  - UI buttons in Property Editor for selecting reasoning effort level (`minimal`, `low`, `medium`, `high`)
  - Buttons positioned between "Dangerously allow all commands" and "Tools" section with radio-button semantics (only one selectable at a time)
  - Optional `reasoningEffort` field in LLMNode data type persists through save/load cycles
  - ExecuteWorkflow handler validates effort value against allowed set and conditionally passes `'reasoning.effort'` to SDK settings
  - Defaults to undefined when not selected; SDK uses its default behavior
  - Version bumped to reflect new feature

### Changed
- **Preview Node Message Handler Optimization**: Improved performance and correctness of preview content computation
  - Pre-built `Map<edgeId, orderNumber>` to eliminate O(E²) sorting overhead from repeated `edges.find()` calls in comparator (now O(E log E))
  - Fixed parent aggregation to gather all incoming edges to preview node, not just from the recently completed parent

- **Sidebar Layout Restructuring**: Extracted action header from WorkflowSidebar into dedicated SidebarActionsBar component
  - SidebarActionsBar now positioned outside scroll container in Flow.tsx, fixed at the top of the left panel
  - Flow.tsx left sidebar refactored from single container to two-part layout: fixed actions bar + scrollable content area
  - Eliminates sticky positioning issues by anchoring actions bar at Flow layout level
  - WorkflowSidebar now contains only node palettes, custom nodes, and property editor

- **Right Sidebar Reset on Workflow Re-execution**: Introduced monotonic `executionRunId` to reset sidebar state on fresh run without affecting per-node resume
  - `useWorkflowExecution` hook now tracks `executionRunId` (incremented on full execute, unchanged on resume)
  - `RightSidebar` listens to `executionRunId` changes and resets local state: `openItemId`, `modifiedCommands`, `expandedJsonItems`, `pausedAutoScroll`, `assistantScrollRefs`
  - `nodeAssistantContent` cleared before posting new execute message, preventing stale content from prior runs
  - Order of operations ensures UI reset and content clearing happen before workflow message is posted
  - **Why**: Full workflow re-execution should reset the sidebar UI to initial state, while per-node resume preserves assistant content and UI state. The monotonic ID ensures clean state separation without interfering with resume functionality.
  
### Added
- SidebarActionsBar component (new) - dedicated toolbar containing Save, Load, Execute/Stop, Clear, and Help buttons
  - Manages Help modal state locally for self-contained functionality
  - Receives action handlers as props from Flow.tsx parent
  - ARIA labels added to all three icon-only buttons (Open, Save, Execute/Abort) for accessibility
  - Maintains all existing button behaviors and event handlers

- `executionRunId` prop forwarded from `useWorkflowExecution` hook through `Flow` to `RightSidebar` component for state reset triggering

### Removed
- Sticky toolbar markup from WorkflowSidebar (header wrapper, action buttons, Help button)
- Header-related props from WorkflowSidebar (`onSave`, `onLoad`, `onExecute`, `onClear`, `isExecuting`, `onAbort`)
