## High-level summary
This PR introduces incremental–preview functionality:  
when any non-preview node finishes executing, every directly-connected Preview node now concatenates the available parent outputs and refreshes immediately.  
Key elements:

* `getDownstreamPreviewNodes()` – walks the edge list to find direct Preview children of a completed node and collects **all** their inbound edges.  
* `computePreviewContent()` – sorts parent outputs by an `orderNumber` stored on edges and joins them.  
* `useMessageHandler()` – signature expanded with `edges` and `nodeResults`; inside the `node_execution_status` handler it now calls the two helpers above to update Preview nodes in real-time.  
* Flow.tsx passes the new props through.  
* Changelog and future-enhancements docs updated.

No database/model changes; the scope is limited to the web front-end.

---

## Tour of changes
Start with `workflow/Web/components/hooks/messageHandling.ts`, because
1. All runtime logic lives here.
2. Every other code change (Flow.tsx prop plumbing, docs) merely supports or describes this logic.

After understanding the new helpers and the amended `node_execution_status` branch, the other diffs are straightforward.

---

## File level review

### `CHANGELOG.md`
Additions accurately document the new feature and the small optimisation.  
No issues.

### `future-enhancements.md`
Minor markdown edits and two follow-up tasks are recorded.  
Observation: The “Remove Unused Parameter” task is relevant—the parameter is still present in this PR (see below).

### `workflow/Web/components/Flow.tsx`
+ Props `edges` and `nodeResults` are forwarded to `useMessageHandler`.

Review:
* **Correctness** – Assumes the parent `Flow` component already holds authoritative `edges` / `nodeResults`. Verify they are up-to-date and not local stale snapshots; otherwise previews could lag behind.  
* **Typing** – Component generics unchanged, passing extra props does not harm; ensure `useMessageHandler` declaration is synchronised in every call-site if Flow is reused elsewhere.

### `workflow/Web/components/hooks/messageHandling.ts`

#### New helpers
1. `getDownstreamPreviewNodes(completedNodeId, edges, nodes)`  
   * Complexity: O(E) filtering – good.  
   * Aggregates all incoming edges for each Preview node: ✔ resolves earlier bug.  
   * Returns duplicates only once (guard via `result.find`) – fine.  
   * Potential improvement: Use a `Set` instead of `Array.find` for O(1) duplicate check (minor).

2. `computePreviewContent(previewNode, parentEdges, nodeResults, edgeOrderMap)`  
   * `previewNode` parameter is unused – dead code; flagged in future-enhancements.  
   * Empty-string outputs are skipped (`if (parentOutput)`). If an upstream node legitimately returns `''`, the preview will silently drop it. Consider using `parentOutput !== undefined` instead.  
   * When multiple edges have the same or missing `orderNumber` they default to `0` and will fallback to source list order of `.sort()`. Clarify tie-break logic.

#### Hook signature changes
```ts
export const useMessageHandler = (
  ...
  notify,
  edges,
  nodeResults
)
```
and dependency array:
```ts
}, [
  ...,
  edges,
  nodeResults,
])
```
Good: prevents stale closure.  
But `edges`/`nodeResults` are likely re-created on every ReactFlow change, so the effect may re-register handlers frequently. Ensure that `vscodeAPI.onMessage` is not duplicated; currently the handler is re-added each time. Consider `useRef` for a stable listener or deregister on cleanup.

#### `node_execution_status` handling
* Correctly differentiates Preview vs non-Preview nodes.  
* Builds `edgeOrderMap` once per message. Could hoist **outside** the Preview loop, but negligible.  
* `updatedResults` mutates a fresh Map copy; safe. Yet it only inserts the **just completed** node – if other parents finished previously, they must already be in `nodeResults` or will be missing in the preview. Assumption seems valid.

Edge cases / bugs:
1. **Race condition** – If two parents finish nearly simultaneously, both `onMessage` invocations read the same stale `nodeResults`, compute content, and the later one might overwrite the earlier composite. Using the real-time `updatedResults` Map is good, but only one parent’s value is added per call. Consider merging `nodeResults` each time (`new Map(nodeResults)` already contains prior values, so effect is fine).
2. **Performance** – For large graphs, repeatedly filtering `edges` in helpers may cost. Caching inbound edge lists by node id would remove redundant work.
3. **Robustness** – If `result` is NULLish the code stores `''`; that treats “node failed/no result” the same as empty string. Might hide errors.

Security: no direct user-supplied input is evaluated; concatenation of parent outputs is inert. Safe.

### Unit / integration tests
No test additions. A regression test for “preview updates after first parent completes” is recommended.

---

## Recommendations
1. Remove the unused `previewNode` parameter in `computePreviewContent()` (already noted).  
2. Accept empty string outputs (`!== undefined`) to avoid data loss.  
3. Guard against multiple event-listener registrations or add cleanup in the effect.  
4. Optional: Replace `result.find()` with a `Set` for minor speed gain.  
5. Write tests to cover:
   * Single-parent preview (baseline).  
   * Multi-parent with differing `orderNumber`.  
   * Rapid concurrent parent completions.