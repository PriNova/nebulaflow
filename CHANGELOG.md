# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
