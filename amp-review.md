## High-level summary  
Two small but coordinated UI changes were introduced:

1. `Flow.tsx` – when a “pending approval” CLI node appears while the right sidebar is collapsed, the sidebar is programmatically expanded.
2. `RightSidebar.tsx` – while such a pending-approval node exists, the user cannot manually collapse the sidebar (the collapse/expand button is disabled).

Together they guarantee that any approval-requiring CLI step always has its details visible to the user and cannot be hidden.

## Tour of changes (recommended review order)  
Start with `Flow.tsx`. The new `useEffect` explains the feature intention (“auto-expand sidebar when a pending CLI approval enters the scene”). Once that behaviour is understood, proceed to `RightSidebar.tsx` where the second half of the feature (“prevent manual collapse”) is enforced. Reviewing in this order clarifies how the two components cooperate and avoids reading the prop-level plumbing backwards.

## File level review

### `workflow/Web/components/Flow.tsx`

Change  
```tsx
useEffect(() => {
    if (!pendingApprovalNodeId || !rightCollapsed) return
    const node = nodes.find(n => n.id === pendingApprovalNodeId)
    if (node && node.type === NodeType.CLI) {
        setRightCollapsed(false)
    }
}, [pendingApprovalNodeId, rightCollapsed, nodes])
```

Correctness & behaviour  
• Early–exit guards avoid unnecessary work and eliminate infinite loops: once `setRightCollapsed(false)` runs, `rightCollapsed` becomes `false`, so the effect immediately stops triggering.  
• `nodes.find` is O(N); acceptable given typical workflow sizes.  
• Effect runs whenever `nodes` array reference changes, which may be frequent. This is safe but could fire more often than needed. A lightweight optimisation:

```tsx
// optional optimisation
const cliPending = useMemo(
  () => pendingApprovalNodeId
      ? nodes.find(n => n.id === pendingApprovalNodeId && n.type === NodeType.CLI)
      : undefined,
  [pendingApprovalNodeId, nodes]
);
useEffect(() => {
  if (cliPending && rightCollapsed) setRightCollapsed(false);
}, [cliPending, rightCollapsed]);
```

Security  
No user-supplied data used; no risks introduced.

Maintainability  
Consider isolating “getNodeById” logic into a selector/helper used by both components to avoid knowledge duplication.

### `workflow/Web/components/sidebar/RightSidebar.tsx`

Change  
```tsx
<Button
  ...
  onClick={onToggleCollapse}
  disabled={!!pendingApprovalNodeId}
  aria-label="Toggle Right Sidebar"
  ...
/>
```

Correctness  
• `disabled` correctly prevents both click and keyboard activation.  
• `!!pendingApprovalNodeId` is a clear boolean coercion.

Accessibility  
Because the element is now disabled, screen-reader users lose the ability to collapse but receive no explanation. Consider adding `title="Cannot collapse while approval is pending"` or `aria-describedby` to clarify why the control is disabled.

Potential UX edge case  
If another sidebar action relies on collapsing (e.g., saving space), users may be frustrated. Confirm with Product/UX that disabling is acceptable.

Performance / security  
No concerns.

---

Overall the change set is small, well-scoped and consistent. The only actionable feedback is an optional dependency optimisation in `Flow.tsx` and a minor accessibility message for the disabled button.