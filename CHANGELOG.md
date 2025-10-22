# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **LLM Node Reasoning Effort Control**: Added reasoning effort selector to LLM node configuration
  - UI buttons in Property Editor for selecting reasoning effort level (`minimal`, `low`, `medium`, `high`)
  - Buttons positioned between "Dangerously allow all commands" and "Tools" section with radio-button semantics (only one selectable at a time)
  - Optional `reasoningEffort` field in LLMNode data type persists through save/load cycles
  - ExecuteWorkflow handler validates effort value against allowed set and conditionally passes `'reasoning.effort'` to SDK settings
  - Defaults to undefined when not selected; SDK uses its default behavior
  - Version bumped to reflect new feature

### Changed
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
