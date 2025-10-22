## High-level summary
This patch introduces a monotonic `executionRunId` that is bumped every time a **new workflow execution** starts.  
The id is threaded

1. From the custom hook `useWorkflowExecution`
2. To the top–level `Flow` component
3. Down to `RightSidebar`.

`RightSidebar` listens to the id and resets its local UI/scroll state when it detects a new run, guaranteeing that artefacts from a previous run (open accordion items, modified commands, paused scrolling, etc.) do not bleed into the next run.

No functional behaviour besides this state-reset is changed.

## Tour of changes
Start in `workflowExecution.ts`.  
That file defines and mutates `executionRunId`, so understanding it first clarifies every other change (new prop plumb-throughs and the reset logic).

## File level review

### `workflow/Web/components/hooks/workflowExecution.ts`

Changes
• `const [executionRunId, setExecutionRunId] = useState(0)` – new state slot.  
• In `resetExecutionState` it:
  – Clears existing assistant content (previously leaked across runs)  
  – `setExecutionRunId(prev => prev + 1)` increments the run id.

Returned object now contains `executionRunId`.

Review
✔️ Correct place to bump the id; ensures monotonic increase, so React prop comparisons work.  
✔️ Clearing `nodeAssistantContent` avoids leftover messages – good.  

Potential improvements / minor issues
• Race condition unlikely, but if `onExecute` can be called in rapid succession, two increments may coalesce (React batches). Not harmful, but a dedicated `Date.now()` or UUID would also work.  
• Initial value `0` is relied on by `RightSidebar` to skip the first mount reset. Consider adding a comment.  

Security: N/A.

### `workflow/Web/components/Flow.tsx`

Changes
• Accepts `executionRunId` from hook and passes it to `RightSidebar`.  
• Prop list updated in two places.

Review
✔️ Simple plumb-through, no functional risk.  
⚠️ Type safety: If this codebase uses strict TS props elsewhere, make sure `Flow`’s prop interface is updated in *all* call sites. (Appears OK in this diff.)  
• Tests / Storybook stories that mount `Flow` without the hook will now have to supply `executionRunId`. Consider marking the prop optional or providing a default when used outside the hook context.

### `workflow/Web/components/RightSidebar.tsx`

Changes
• New prop `executionRunId: number`.  
• `useEffect` listening to that id; when it changes (>0) it:
  – resets `openItemId`, `modifiedCommands`, `expandedJsonItems`, `pausedAutoScroll`, and clears `assistantScrollRefs`.

Review
✔️ All state containers that should be wiped are included.  
✔️ `assistantScrollRefs.current.clear()` prevents memory leaks.  

Edge cases / suggestions
1. Dependency list: the effect only depends on `executionRunId`. That is correct; internal setters are stable.  
2. Condition `if (executionRunId > 0) { … }`  
   • Guarantees no reset on first mount, which is intentional.  
   • If at some point we decide to “run” immediately on first mount, this condition will skip the reset: revisit then.
3. Because the component’s state is wiped *after* new props arrive, there is a tiny flicker window where old open items may render once. Not noticeable, but if it matters, reset could also be done in a layout effect.  
4. Consider exporting a small helper to collect all “sidebar resettable state” so the logic stays DRY if more fields appear.

Security / performance: no concerns.

## Overall assessment
The change is small, focused, and correct. It removes an observable UI bug where remnants from a previous workflow execution polluted the next one. The plumbing is straightforward and type-safe. Only minor stylistic comments remain.