# Future Enhancements

Recommended improvements and optimizations for future implementation.

## Accessibility Improvements (P1)

### Sticky Toolbar - ARIA Labels
- **File**: [WorkflowSidebar.tsx](workflow/Web/components/WorkflowSidebar.tsx#L114)
- **Issue**: Icon-only buttons in the sticky toolbar lack `aria-label` attributes
- **Recommendation**: Add descriptive `aria-label` to each button (Open, Save, Start/Stop, Clear, Help) to improve screen reader accessibility
- **Priority**: P1 (Medium)
- **Status**: Pending

## UI/Styling Confirmations (P2)

### Sticky Toolbar - Visual Interactions
- **File**: [WorkflowSidebar.tsx](workflow/Web/components/WorkflowSidebar.tsx#L114)
- **Scope**: Verify visual behavior during testing
- **Checks**:
  - Sticky positioning engages correctly within the `tw-overflow-y-auto` scroll container
  - z-index layering maintains: toolbar (z-10) > accordions > content, below modals
  - Divider appearance and spacing are visually consistent
  - Tooltip and modal interactions are preserved during scrolling
- **Priority**: P2 (Low)
- **Status**: Ready for manual verification
