## High-level summary  
This patch removes all support for the “Search Context” node type from the workflow system (backend execution, shared model, React UI, node factory, helpers, and the dedicated node component). All code paths that referenced `NodeType.SEARCH_CONTEXT` have been deleted, and the UI elements that allowed a user to create or edit such nodes are gone.

---

## Tour of changes (recommended review order)

1. `workflow/Web/components/nodes/SearchContext_Node.tsx` – the entire component is deleted; this shows the intent of the change most clearly.  
2. `workflow/Core/models.ts` and `workflow/Web/components/nodes/Nodes.tsx` – `NodeType.SEARCH_CONTEXT` is removed from both enum definitions; this ripples through the rest of the code-base.  
3. UI removals (`WorkflowSidebar.tsx`, `PropertyEditor.tsx`) – verify no user can add/edit a “Search Context” node any more.  
4. Helper logic (`hooks/nodeOperations.ts`) – cloning/initialisation adjustments.  
5. Execution path (`Application/handlers/ExecuteWorkflow.ts`) – runtime support removed.  
6. Quick project-wide grep for lingering references (outside this diff) – ensure compilation will still succeed.

---

## File level review

### `workflow/Application/handlers/ExecuteWorkflow.ts`
Change  
• Removed the `SEARCH_CONTEXT` case from the big `switch` (~4 LOC).  

Review  
✔ Correct, since the node type no longer exists.  
⚠️ If old workflows can still contain a “search-context” node (e.g. saved JSON, DB records), execution will now fall through to the `default` case and throw `Unknown node type` (or a later error). Consider adding upfront validation / migration to prevent runtime failures.

### `workflow/Core/models.ts`
Change  
• Deleted `SEARCH_CONTEXT` from the authoritative `NodeType` enum.  

Review  
✔ Keeps shared model in sync with UI removal.  
⚠️ Be sure that every consumer uses *string* enums (as you do). If we ever switched to numeric enums elsewhere, index shifting would be dangerous—looks fine here.

### `workflow/Web/components/PropertyEditor.tsx`
Change  
• Entire JSX block for editing Search-Context nodes removed.  

Review  
✔ No issues.  
⚠️ Remember to delete the dangling `import type { SearchContextNode }` to avoid `tsc --noUnusedLocals` warnings (already done).  
⚠️ Small perf nit: after removal, the surrounding `if` cascade has an empty branch gap—nothing functional, just readability.

### `workflow/Web/components/WorkflowSidebar.tsx`
Change  
• Removed accordion section and button that created Search-Context nodes.  

Review  
✔ Button hovered colour handling code deleted with it – good.  
⚠️ Confirm accordion `value`s remain unique (`context` removed).

### `workflow/Web/components/hooks/nodeOperations.ts`
Change  
• Removed two `SEARCH_CONTEXT` branches:  
  1. `cloneNodeData`’s switch.  
  2. `addNode()` initialiser path.  

Review  
✔ Logic is consistent with feature removal.  
🔍 Confirm no other path relies on `local_remote` defaulting.

### `workflow/Web/components/nodes/Nodes.tsx`
Change  
• Removed `SEARCH_CONTEXT` from enum, union type, `createNode`, and `nodeTypes` map.  

Review  
✔ All compile-time references removed.  
⚠️ Be sure to bump any documentation or sample JSON that still mention `"search-context"`; otherwise the UI will refuse to render imported workflows.

### `workflow/Web/components/nodes/SearchContext_Node.tsx` (deleted)
Change  
• Full deletion (56 LOC).  

Review  
✔ File elimination matches feature removal.  
🔍 Double-check imports in any Storybook / test files.

---

### Other considerations

1. Data migration: If users might already have workflows containing `"search-context"` nodes, you must provide a migration script or gracefully warn on load and strip/replace them.
2. Build sanity: run `yarn tsc -b` or equivalent to catch any stray `NodeType.SEARCH_CONTEXT` references.  
3. Docs: Update README, API docs, and any screenshots/tutorials.
4. Tests: Remove / rewrite unit & e2e tests that depended on this node.

No security or performance regressions observed—this is a pure feature removal.