## High-level summary  
The change is purely UI-side and limited to two React components:

1. `WorkflowSidebar.tsx` – minor style tweak: adds `tw-text-sm` to the library button for smaller text.  
2. `ToolsSelector.tsx` – substantial refactor:
   • Replaces the per-tool `<Button>` chip UI with an accordion containing check-boxes.  
   • Adds “Select / Deselect all” (master checkbox).  
   • Ensures `dangerouslyAllowAll` is turned off when the user disables every tool.  
   • Introduces new ShadCN components (`Accordion`, `Checkbox`) and drops `Button`.

No business logic beyond tool-enable/disable is touched.

---

## Tour of changes  
Start with `ToolsSelector.tsx`.  
It carries the functional refactor (imports, new state derivation, bulk-toggle logic, new JSX structure).  
`WorkflowSidebar.tsx` only receives a one-class Tailwind addition, best reviewed afterwards.

---

## File level review  

### `workflow/Web/components/sidebar/widgets/ToolsSelector.tsx`

Changes made  
• Replaces `Button`-based tags with a collapsible accordion and check-boxes.  
• Adds master checkbox (`allEnabled`) logic + `onToggleAll`.  
• Updates imports accordingly.

Review  

Correctness & behaviour  
✓ `allEnabled` is computed with `every`, producing the right truthiness even for an empty list.  
✓ `onToggleAll` correctly resets `dangerouslyAllowAll` when disabling all tools – good safety measure.  
✓ Id generation (`llm-tools-all-${node.id}` / `llm-tool-${node.id}-${tool}`) prevents clashes across nodes.  
✓ Checkbox event uses `checked === true` to coerce `indeterminate` to *false*; works with ShadCN’s `CheckedState`.

Potential issues / recommendations  
1. **Unused `onClick` stop-propagation**  
   In the master checkbox (`<Checkbox … onClick={event => event.stopPropagation()}/>`) the intention is to avoid the accordion toggle when the checkbox is clicked. This works, but also blocks the checkbox’s own onClick propagation to parent forms (if any). Acceptable, yet consider switching to `onKeyDown={(e)=>e.stopPropagation()}` + `onPointerDown` to cover full pointer/key spectrum or use ShadCN’s `data-collapsible` control API, if available, for cleaner semantics.

2. **Missing `Button` import removal**  
   The diff shows the original `Button` import deleted; ensure ESLint or the compiler flags any other residual references. Nothing else found in this file.

3. **Memoization / recomputation**  
   `allEnabled` and `disabled` arrays are recomputed every render. For large `toolNames` lists, consider `useMemo` with `[disabled]` deps:

   ```ts
   const allEnabled = useMemo(
       () => toolNames.every(tool => !disabled.includes(tool)),
       [disabled]
   )
   ```

   Not critical for small lists.

4. **Accessibility**  
   • Each checkbox is paired with a `<Label htmlFor=…>` improving a11y—good.  
   • Accordion trigger still receives focus, but the child checkbox inside may lead to double-tab stops. Confirm desired UX.

Security  
No user-input processing or external requests added; only in-memory state toggling, so no new XSS / injection surfaces.

Performance  
Minimal impact; accordion rendering is O(n) over tool count, same as old button list.

### `workflow/Web/components/sidebar/WorkflowSidebar.tsx`

Change  
Adds `tw-text-sm` to `libraryButton` constant.

Review  
Straightforward, no logic impact. Style string remains consistent; low risk.

---

## Overall  
The refactor simplifies the UI, adds a bulk-toggle feature, and handles an edge case (`dangerouslyAllowAll`). Code is clean and typed. Beyond minor memoization and event-propagation polishing, everything looks sound.