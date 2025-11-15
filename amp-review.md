## High-level summary
This patch introduces in-editor copy / paste of graph selections for NebulaFlow workflows.

Key elements added 
• Two new messages on the workflow ⇄ extension protocol:  
  – `copy_selection` (workflow ➜ extension)  
  – `paste_selection` (workflow ➜ extension) and return event `clipboard_paste` (extension ➜ workflow)  
• Host-side (`workflow/Application/register.ts`) logic to keep an in-memory clipboard and to read / write the system clipboard.  
• Web-view-side logic (`Flow.tsx`, `messageHandling.ts`, `FlowCanvas.tsx`) to surface context menus, build the payload to copy, request a paste, and materialise the pasted sub-graph.  
• Guard / type updates to keep runtime validation in sync with the new protocol.

No existing behaviour is removed; all changes are additive.

## Tour of changes
The best place to start is `workflow/Application/register.ts`.  
It shows the end-to-end flow:

1. A `copy_selection` message arrives.  
2. The payload is validated, put into an in-memory clipboard, and mirrored to the OS clipboard.  
3. A `paste_selection` message triggers reading from the OS clipboard (fallback to in-memory) and the result is sent back to the web-view via `clipboard_paste`.  

Once you understand this file, jump to:

* `workflow/Core/Contracts/Protocol.ts` & `guards.ts` – protocol surface.  
* `workflow/Web/components/Flow.tsx` – UI & graph manipulation.  
* `workflow/Web/components/hooks/messageHandling.ts` – reception of the `clipboard_paste` event.  
* `workflow/Web/components/canvas/FlowCanvas.tsx` – just passes new handlers through.

## File level review

### `workflow/Application/register.ts`
+ Introduces `inMemoryClipboard` and two new message cases.

Correctness / bugs
• ✅ Validation: `isWorkflowPayloadDTO` is used on ingest and egress.  
• ❗ The in-memory copy is global for the whole extension host.  If multiple web-views are open they will overwrite each other.  Consider indexing by `webview` or `panelId`.  
• ❗ Race: `paste_selection` reads the system clipboard first, falls back to `inMemoryClipboard`.  Between the read and validation another app can write to the clipboard; unlikely but possible.  
• ❗ Potential large-payload freeze – `JSON.stringify(payload)` is done with no size cap; a malicious workflow could try to exhaust memory.  Consider bounding nodes / edges counts.  
• 📄 Error handling looks OK; failures fall back silently which is fine.

Security
• The clipboard text is blindly parsed with `JSON.parse`.  Validation mitigates prototype-pollution issues, but you still allocate the full string.  Again a size guard would help.  
• No leaking of VS Code secrets observed.

### `workflow/Core/Contracts/Protocol.ts`
+ Adds three interfaces and extends the union types.

No issues; the interfaces are minimal.

### `workflow/Core/Contracts/guards.ts`
+ Runtime guards updated.

Correctness
• Returning `true` for `paste_selection` (no payload) is correct.  
• `clipboard_paste` guard allows `undefined` data – matches event semantics.  
• Consider adding a `hasOwnProperty('type')` check at top for consistency with other guards.

### `workflow/Web/components/Flow.tsx`
Large patch: UI, context menu, copy/paste helpers.

Correctness
• Two different implementations of node/edge cloning exist:  
  – `buildClipboardGraphFromPayload` (not used anywhere).  
  – `applyClipboardPayload` (used).  
  Remove the dead helper or refactor to share logic.

• `lastPasteScreenPositionRef` actually stores *flow* coords; rename to avoid confusion.

• In `applyClipboardPayload` you calculate `minX/minY` to align to anchor.  
  If anchor is undefined you still add a default +40 offset ⇒ pasted graphs drift every time, not just first.  That mimics many tools but flag if not intentional.

• `handleCopySelection` omits edge `type`, style, label etc.  Pasted edges will lose these attributes.  Include the full DTO or restore defaults.

• `handleNodeContextMenu`: `event.preventDefault()` may block React Flow’s internals, but tests show it works.  Keep an eye on it.

• `NodeContextMenu` is unmounted only when centre pane gets a click or ESC; clicks outside VS Code panel do not close it.  Consider listening to `window.mousedown`.

Performance
• Each paste produces new UUIDs via `uuidv4()` per node/edge – fine.

Accessibility
• Menu items are not keyboard navigable apart from ESC. Acceptable MVP, but aria roles should be added later.

### `workflow/Web/components/canvas/FlowCanvas.tsx`
+ Simply forwards `onNodeContextMenu` / `onPaneContextMenu`.  
No concerns.

### `workflow/Web/components/hooks/messageHandling.ts`
+ Adds support for `clipboard_paste`.

Correctness
• `onClipboardPaste?.(payload)` is guarded by a basic sanity check.  
• `console.log` statements should be wrapped in a dev flag to avoid polluting user logs.

### Other observations
1. Duplicate code paths (two clone helpers) → deduplicate.
2. Logging: many `console.log` calls without `isDev` guard on web side.
3. Tests / telemetry not updated – ensure integration tests cover multi-panel copy/paste and cross-window copy/paste.

## Recommendations
1. Scope the in-memory clipboard by `panel` to avoid cross-workflow interference.
2. Add upper bounds (e.g. 5 000 nodes, 10 000 edges) when serialising / parsing clipboard JSON to mitigate DoS vectors.
3. Consolidate clone logic into a single util shared by both web and extension to avoid divergence.
4. Restore complete edge DTO (type, label, marker) in `handleCopySelection`.
5. Rename `lastPasteScreenPositionRef` to `lastPasteFlowPositionRef` (or update value type) for clarity.
6. Wrap web-view `console` calls in dev guards for production builds.
7. Add `window` click listener to close context menu when clicking outside the panel.

With these minor fixes the feature looks solid and integrates cleanly with existing runtime guards.