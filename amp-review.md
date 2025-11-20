## High-level summary
The change introduces an “auto-follow active node” feature to the right sidebar:
* When the engine is executing **exactly one** node, that node’s accordion item is automatically expanded and kept in view (`autoFollowActiveNode` state).
* If the user manually expands a different node the auto-follow mode is disabled until the next execution run.
* `autoFollowActiveNode` is re-enabled automatically on every new `executionRunId`.
* A binary bump to `vendor/amp-sdk/amp-sdk.tgz` is included but not reviewable from source.

No other functional areas are touched.

## Tour of changes
Start with `RightSidebar.tsx` at the new `autoFollowActiveNode` logic (around lines 240–260 and the new `useEffect` at 606–623). This is the conceptual core; everything else (memo, event handler tweaks, reset code) supports this behaviour.

## File level review

### `workflow/Web/components/sidebar/RightSidebar.tsx`
#### Added state
```ts
const [autoFollowActiveNode, setAutoFollowActiveNode] = useState<boolean>(true)
const singleActiveNodeId = useMemo(() => { … }, [executingNodeIds])
```
Good:
* `useMemo` avoids recomputing on unrelated renders.
* Correctly resets to `null` when more than one node executes.

Consider:
* A `Set`’s iteration order is insertion-order. If `executingNodeIds` is built from multiple async events the “first” element can be nondeterministic. If deterministic UX is important, sort the set or explicitly track the “primary” executing node elsewhere.

#### Auto-follow side effect
```ts
useEffect(() => {
  if (!autoFollowActiveNode) return
  if (pendingApprovalNodeId) return
  if (!singleActiveNodeId) return
  if (openItemId !== singleActiveNodeId) setOpenItemId(singleActiveNodeId)
}, [autoFollowActiveNode, pendingApprovalNodeId, singleActiveNodeId, openItemId])
```
Good:
* Clean early returns keep the diff readable.
* Guard with `pendingApprovalNodeId` so approval view is not overridden.

Edge cases / bugs:
1. Infinite-update guard: When `openItemId` is updated to `singleActiveNodeId`, the effect re-runs, but the comparison fails (`openItemId === singleActiveNodeId`), preventing loops. ✔️
2. Missing dependency: `setOpenItemId` is stable from `useState`, so not required.

Performance: negligible.

#### Reset behaviour on new run
```ts
if (executionRunId > 0) {
  setOpenItemId(undefined)
  setAutoFollowActiveNode(true)
  …
}
```
Good: guarantees mode resets for each execution.

#### Accordion `onValueChange`
```ts
onValueChange={value => { … }}
```
Logic:
* Compute `nextId`.
* Auto-follow toggles based on whether the clicked item equals the *current* single active node.

Correctness considerations:
* `Accordion` supplies `value: string | null`. Using `value || undefined` keeps local state type aligned (`string | undefined`), but beware `''` (empty string) being treated as falsey; if Accordion can send `''`, we revert to `undefined`, which might be acceptable.
* Potential race: user clicks the single active node while auto-follow already true ⇒ still sets true (idempotent).

Accessibility: unchanged.

Typings:
* `nextId` could be typed `string | undefined` explicitly for clarity.

#### Misc cleanup
* Removed now-unused empty-string default when opening accordion.

No security impact visible.

### `vendor/amp-sdk/amp-sdk.tgz`
Binary tarball replaced. Without inspecting contents we assume it’s an SDK upgrade. Ensure:
* checksum/licence review,
* version bump in lockfile if needed,
* validate that transitive dependencies did not introduce vulnerable packages (run `npm audit`/`yarn audit`).

## Recommendations
1. Clarify the deterministic selection of `singleActiveNodeId` if multiple executing nodes can exist in rapid succession.
2. Consider exposing a small “Auto-follow” toggle in the UI so users can re-enable without restarting a run.
3. Add unit tests:
   • clicking another accordion item disables auto-follow,  
   • new run re-enables it,  
   • pending approval overrides auto-follow.
4. Audit the new `amp-sdk` binary.

Otherwise the implementation is clean, idiomatic React, and appears free of major bugs or performance issues.