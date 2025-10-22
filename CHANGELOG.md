# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Sidebar Layout Restructuring**: Extracted action header from WorkflowSidebar into dedicated SidebarActionsBar component
  - SidebarActionsBar now positioned outside scroll container in Flow.tsx, fixed at the top of the left panel
  - Flow.tsx left sidebar refactored from single container to two-part layout: fixed actions bar + scrollable content area
  - Eliminates sticky positioning issues by anchoring actions bar at Flow layout level
  - WorkflowSidebar now contains only node palettes, custom nodes, and property editor
  
### Added
- SidebarActionsBar component (new) - dedicated toolbar containing Save, Load, Execute/Stop, Clear, and Help buttons
  - Manages Help modal state locally for self-contained functionality
  - Receives action handlers as props from Flow.tsx parent
  - ARIA labels added to all three icon-only buttons (Open, Save, Execute/Abort) for accessibility
  - Maintains all existing button behaviors and event handlers

### Removed
- Sticky toolbar markup from WorkflowSidebar (header wrapper, action buttons, Help button)
- Header-related props from WorkflowSidebar (`onSave`, `onLoad`, `onExecute`, `onClear`, `isExecuting`, `onAbort`)
