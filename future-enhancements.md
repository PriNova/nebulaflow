# Future Enhancements

### Tool Catalog Alignment – Alias and UI Polish

- Goal: Refine alias behavior and webview tool listing now that tool-name metadata is sourced from the Amp SDK.
- What:
  - Clarify or adjust alias precedence between SDK and NebulaFlow-local aliases in [toolNames.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/services/toolNames.ts), documenting that SDK resolution wins when both define the same alias (e.g., `GitDiff`).
  - Decide whether to keep or remove redundant local aliases that duplicate SDK entries (such as `GitDiff`), or clearly mark them as defensive back-compat shims.
  - If future UX requires hiding or reordering tools in the LLM node "Tools" selector, introduce a thin filtering/ordering layer on top of the SDK-provided `getAllToolNames()` output so the UI retains control without forking canonical metadata.
- Why: Keeps alias semantics explicit and maintainable as the SDK evolves, avoids silent override assumptions, and preserves flexibility to shape the UI tool list while still using the SDK as the single source of truth.

Recommended improvements and optimizations for future implementation.

## Pending Enhancements

### VSA Refactor – Follow-ups

- Goal: Tighten typing, safety posture, and add tests after the large-file refactor.
- What:
  - Typed CustomEvents: Replace string-typed CustomEvents in effect hooks with typed constants and payloads; extend `WindowEventMap` and define payload interfaces for `nebula-edit-node`, `nebula-run-from-here`, `nebula-run-only-this`, subflow events. Affects [useEditNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/effects/useEditNode.ts), [useRunFromHere.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/effects/useRunFromHere.ts), [useRunOnlyThis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/effects/useRunOnlyThis.ts), and subflow hooks.
  - CLI safety posture: Denylist-based guard remains in place; consider moving to an allowlist or capability-scoped execution model for higher assurance. Track in Core execution [sanitize.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/execution/sanitize.ts).
  - Unit tests for Core helpers: Add unit coverage for pure functions in Core/execution, e.g., [inputs.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/execution/inputs.ts), [combine.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/execution/combine.ts), [sanitize.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/execution/sanitize.ts), and [graph.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/execution/graph.ts).
  - Minor polish: Deduplicate `HANDLE_THICKNESS` across [LeftSidebarContainer.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/layout/LeftSidebarContainer.tsx) and [RightSidebarContainer.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/layout/RightSidebarContainer.tsx); forward and/or remove unused props (`onRunFromHere`) in [RightSidebarContainer.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/layout/RightSidebarContainer.tsx); consider `useCallback` on small inline handlers where beneficial (e.g., [FlowCanvas.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/canvas/FlowCanvas.tsx)).
- Why: Improves type safety and reliability, strengthens security posture over time, and adds confidence via tests without increasing complexity.
- Priority: P2 (typing/robustness)
### Input/Results Editor Switch – Follow-ups

- Goal: Polish typing, reuse, and small edge cases for the new modal switching UX.
- What:
  - Add typed custom events to the global `WindowEventMap` for `nebula-open-result-editor` and reuse the existing typed shape for `nebula-edit-node` to remove `any` casts in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/sidebar/RightSidebar.tsx#L235-L248).
  - Disable or guard the "Save" action when input is empty or unchanged in [TextEditorModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/modals/TextEditorModal.tsx#L81-L88) to reduce accidental saves; keep semantics simple.
  - Extract a small helper (e.g., `openResultEditorForNode(id: string)`) to dispatch `nebula-open-result-editor` and reuse it across nodes: [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx), [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx), [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx), [Variable_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Variable_Node.tsx).
  - Optionally handle re-opening the same preview id by toggling `previewNodeId` through `null` before setting it again in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/sidebar/RightSidebar.tsx#L239-L248) to force a fresh open when needed.
- Why: Improves type safety, removes duplication, and polishes interaction edge cases without increasing complexity.
- Priority: P2 (polish/typing)

### Webview Feature Slices & Aliases – Follow-ups

- Goal: Small polish items to keep imports and aliases consistent and ergonomic.
- What:
  - Normalize import style in the one remaining file noted in the review to match the alias-first pattern (prefer alias imports over deep relative paths consistently).
  - Optional alias polish: consider adding an alias for `services` if future refactors increase cross-feature usage; keep unused aliases out of config to avoid clutter.
- Why: Maintains consistency after the slice/alias migration and keeps config lean.
- Priority: P3 (polish)

### Slice Router – Cleanup and Consolidation

- Goal: Finish the transition to slice-first routing and reduce duplication/maintenance risk.
- What:
  - Guard duplicate router registrations and remove dead legacy switch cases that are now handled by slices; the `load_workflow` stub in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L136-L139) can be removed once consumers are fully on the slice path.
  - Centralize common slice wiring types (`SliceEnv`, `Router`) and small helpers (e.g., `readStorageScope`) under Shared to avoid copy/paste across slice registers. A good home would be `workflow/Shared/Infrastructure` with named exports; update imports in [Library register](file:///home/prinova/CodeProjects/nebulaflow/workflow/Library/Application/register.ts#L1-L12), [Subflows register](file:///home/prinova/CodeProjects/nebulaflow/workflow/Subflows/Application/register.ts#L1-L10), and [WorkflowPersistence register](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowPersistence/Application/register.ts#L1-L12).
  - Add consistent `try/catch` error guards to Library CRUD handlers to match the defensive pattern used in Subflows and WorkflowPersistence; see [Library register](file:///home/prinova/CodeProjects/nebulaflow/workflow/Library/Application/register.ts#L18-L63).
  - Normalize `safePost` usage with minimal error handling for symmetry across slices (log or user warning on failure where appropriate).
  - Consider dropping explicit ".js" extensions in TS import specifiers in slice files to reduce bundling brittleness across tooling; verify current bundler settings resolve extensionless paths reliably.
- Why: Prevents drift between legacy and slice paths, reduces boilerplate across slices, and keeps error handling and module resolution consistent.

### Shell Node Modal Editing – Minor Polish

- Goal: Refine modal editing ergonomics and typing for the Shell (CLI) node without changing behavior.
- What:
  - Ensure a safe string fallback for the Command input value in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/PropertyEditor.tsx#L260-L266) to avoid uncontrolled→controlled warnings when `content` is undefined.
  - Clear the local `draft` state after commit/cancel in [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx#L57-L63) to prevent stale values on subsequent edits.
  - Type the `nebula-edit-node` payload explicitly in [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx#L32-L45) for stronger compile-time safety.
- Why: Improves robustness (no React console warnings), prevents subtle UX nits with stale drafts, and strengthens type safety with minimal code.
- Priority: P3 (polish)

### Shell Node – Live Streaming and Validation Polish

- Goal: Provide true live streaming of process output to the UI and improve input validation feedback.
- What:
  - Implement buffer-by-buffer streaming from spawn to the webview so users see output as it arrives (maintain truncation guard).
  - Surface JSON parse errors for Static Env editor inline (with a small error state) instead of silently ignoring invalid JSON.
  - Clarify parent-index stdin semantics: validate out-of-range indices and allow choosing 0- or 1-based indexing explicitly; show a brief helper hint.
  - Unify shell imports (named vs dynamic) across workflow/single-node handlers to keep style consistent.
- Why: Aligns UX with terminal expectations, prevents silent misconfiguration, and keeps code style consistent.
- Priority: P2 (UX/robustness)

### Selection Handling – Keyboard Consolidation and Focus Ergonomics

- Goal: Consolidate keyboard handling and confirm focus reachability after handler relocation.
- What:
  - Move Enter-key deselection logic exclusively to `handleBackgroundKeyDown` and remove duplication from `handleBackgroundClick` in [selectionHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/selectionHandling.ts#L88-L106).
  - Verify keyboard focus is intuitive when the inner canvas holds `role`/`tabIndex` and the outer wrapper no longer does, especially on narrow layouts in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L983-L986).
- Why: Reduces duplication and ensures accessible, predictable keyboard navigation after scoping handlers to the canvas.
- Priority: P2 (robustness/a11y)

### RightSidebar Event Containment – Hardening and Consistency

- Goal: Standardize containment and add an extra safety stop.
- What:
  - Add `onMouseDown={e => e.stopPropagation()}` on the right sidebar panel to prevent mouse-down from bubbling, matching click/key containment in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L1629-L1634).
  - Choose a single strategy (stopPropagation vs target guards) and apply it consistently for background deselection and sidebar containment.
  - Add a narrow type guard in selection handlers to reduce casts when refining `MouseEvent`/`KeyboardEvent` branches in [selectionHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/selectionHandling.ts#L78-L96).
  - Confirm/document Shift+click semantics on empty canvas (currently a no-op that keeps selection) in [selectionHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/selectionHandling.ts#L82-L87).
  - If/when tests exist, consider coverage for sidebar/canvas Shift/Enter containment behavior.
- Why: Further reduces accidental deselection and keeps containment behavior uniform across inputs.
- Priority: P3 (polish/consistency)

### Subflow Open – Follow-ups

- Goal: Harden and polish the open/provide subflow pipeline without changing core behavior.
- What:
  - Add a typed `CustomEvent<{ subflowId: string }>` alias for the open event and a sibling alias for provide to remove `any` and improve maintainability.
  - Add minimal dev-only logging or a user notification when `postMessage` calls throw, to aid diagnosis without spamming users.
  - Consider centralizing the deep snapshot logic into a tiny `cloneGraph(nodes, edges)` helper to guarantee deep copies and avoid drift across call sites.
  - Optional micro-optimization: coalesce ref-sync effects (nodes/edges/activeSubflowId) if profiling shows reflow pressure.
  - Optional: subtle visual hint (e.g., a brief highlight) when opening a subflow during execution to acknowledge the action.
- Why: Improves type safety and debuggability, keeps snapshots consistent, and adds small UX clarity without increasing complexity.
- Priority: P3 (robustness/UX polish)

### Subflow Live Progress – Type Safety and Clone Helper

- Goal: Tighten typing for subflow-scoped webview events and centralize deep cloning used on subflow open.
- What:
-   - Replace `any` payloads in subflow message handlers with exact Protocol types by importing the discriminated message contracts in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts).
-   - Introduce a small `cloneGraph(nodes, edges)` that prefers `structuredClone` with a JSON fallback to replace ad-hoc deepClone usage in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx).
-   - Optional: route dev logs through a minimal logger with levels behind a dev flag to keep console noise controlled as the surface grows.
- Why: Improves type safety and maintainability for subflow live updates, and ensures consistent, safe snapshotting when opening subflows mid-run.
- Priority: P2 (robustness/maintainability)

### Tool Safety and Resolver Hygiene

- Goal: Prevent future drift in Bash detection and reduce runtime overhead in tool name normalization.
- What:
  - Extract a shared helper `isBash(name: string): boolean` used by both settings and runtime guards to centralize case/trim normalization.
  - Remove unnecessary `as string` cast in normalization path in [llm-settings.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/llm-settings.ts#L12-L18) to tighten types.
  - Cache SDK resolver availability from `safeRequireSDK()` in [llm-settings.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/llm-settings.ts#L21-L28) to avoid repeated try/catch on frequent normalization calls.
- Why: A single source of truth for Bash checks prevents subtle mismatches; minor type cleanup improves safety; caching avoids unnecessary overhead during frequent operations.
- Priority: P3 (code quality/robustness)


### IF/ELSE Property Editor – Polish Items

- Goal: Refine the new condition editor UX and typing without changing behavior
- What:
  - Reset `conditionDraft` when the selected node changes to avoid stale draft values.
  - Avoid a static `id` on the condition textarea (e.g., derive from `node.id`) to prevent potential collisions in multi-panel contexts.
  - Add a small "Edit" button next to the textarea for keyboard users to open the modal without requiring double‑click.
  - Tighten `onChange` typing to `React.ChangeEvent<HTMLTextAreaElement>` (remove `any`).
- Why: Improves accessibility, prevents minor edge‑case collisions, and strengthens type safety with minimal complexity.
- Priority: P3 (polish)

### Unified Preview/Edit Modal – A11y and UX Polish

- Goal: Improve tab accessibility and small interaction details in the combined modal
- What:
  - Add `aria-pressed` and `aria-controls` to the Preview/Edit toggle buttons; use `role="tablist"`/`role="tab"` semantics for better screen reader support.
  - Restore focus to the toggle that opened the current view when switching tabs for keyboard users.
  - Optional: remember the last-used tab per session and open the modal with that tab selected (still default to Preview on first open).
  - Optional: show a subtle "Edited" indicator when the draft differs from the initial value before saving.
- Why: Enhances accessibility and clarity without changing core behavior or adding dependencies.
- Priority: P3 (polish)

### Prompt for LLM – RightSidebar Tool Status Indicators Follow‑Ups

- Goal: Harden status parsing and polish visual consistency for tool run indicators
- What:
  - Fix null-check edge case in `hasToolRunError` so `null` is not treated as an object when checking `error` fields.
  - Support string-form error payloads (e.g., `error: "message"`) in addition to object-shaped errors when deriving failure state.
  - Memoize or cache JSON parsing of paired `tool_result` once per item to avoid repeated `JSON.parse` work across renders.
  - Replace hard-coded spinner color with theme tokens (VS Code variables) for consistent theming; verify success/error icon colors also use tokens.
- Why: Improves correctness for mixed error shapes, reduces unnecessary parsing overhead, and aligns UI with the current theme for clarity and consistency.
- Priority: P2 (robustness/UX polish)

### Subflow Node – Remaining Review Items

- Goal: Tighten subflow editor UX and execution semantics
- What:
  - Add autosave and Ctrl/Cmd+S shortcut in subflow editor; show unsaved indicator next to title.
  - Propagate abort/fail-fast semantics from inner nodes to parent subflow node with clear status mapping (success/error/interrupted) and error surface in RightSidebar.
  - Preserve and edit subflow output mapping UI (rename, reorder, delete) with validation against duplicate names and stable indices.
  - Carry ordered inner edges out as deterministic order metadata when mapping outputs to parent connections.
  - Improve keyboard accessibility: visible focus ring, Enter/Space to open editor, ARIA label with subflow title.
  - Optional: preview unsaved changes diff before leaving subflow (nodes/edges/outputs) to help users decide to discard or save.
- Why: Rounds out the subflow user journey (edit, save, navigate, execute) with predictable persistence, clear failure behavior, and accessible controls.

### Bypass Mode – Interactivity and Typing Polish

- Goal: Clarify bypass-node interactivity and widen style typing for future-proofing
- What:
  - Consider making bypassed nodes non-interactive by applying `pointerEvents: 'none'` in `getNodeStyle` when `bypass === true` (opt-in; verify UX trade-offs)
  - Broaden `defaultBorderStyle` parameter typing in [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx) to `React.CSSProperties['borderStyle']` to support all valid CSS border styles
  - Fix minor nit: remove leading space before color value in any `border` string interpolations to ensure consistent CSS parsing
- Why: Provides a clear UX option for bypass behavior, strengthens typing for style extensibility, and tidies up minor styling nits

### Clipboard Feedback Timer Cleanup

- Goal: Prevent state updates after unmount and avoid timer leaks in the clipboard button
- What: Store the `setTimeout` handle in [CopyToClipboardButton.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/CopyToClipboardButton.tsx) and clear it in a `useEffect` cleanup to prevent `setCopied(false)` from firing after unmount
- Why: React may warn about state updates on unmounted components; cleaning up the timer removes a subtle footgun and improves component hygiene

### Workflow Clipboard and Copy/Paste – Follow-ups

- Goal: Refine the workflow clipboard protocol, selection DTOs, and context menu UX beyond the initial implementation.
- What:
-  - Preserve and round-trip any additional edge metadata in the `WorkflowPayloadDTO` (such as labels or ordering hints) when copying and pasting selections so future edge features are not lost during clipboard operations.
-  - Consolidate the clipboard graph cloning logic into a single helper that remaps node/edge IDs and applies offsets, and reuse it across webview clipboard handlers to avoid drift between different copy/paste paths.
-  - Clarify and, if needed, extend clipboard precedence semantics so users have predictable behavior when the system clipboard contains non-NebulaFlow content (e.g., explicit rules for when in-memory vs system clipboard wins).
-  - Add small dev-only logging and optional visual hints around context-menu copy/paste actions to aid debugging without increasing noise in normal usage.
- Why: Keeps the clipboard flow data-oriented and robust as the protocol evolves, reduces duplication in cloning helpers, makes behavior predictable across panels, and leaves room for UX polish without complicating the core implementation.

### Right Sidebar Min-Width Flexibility

- Goal: Make the RightSidebar minimum width user-friendly and adaptable across displays
- What: Revisit the `useRightSidebarResize` configuration in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) to avoid locking the minimum at 380px; consider a smaller min, responsive breakpoint logic, and/or persisting user-chosen width
- Why: A fixed larger minimum can constrain canvas space on smaller screens; flexibility improves ergonomics without sacrificing readability

### Sidebar Collapse Controls – Accessibility and UX Polish

### CLI Approval Sidebar Auto-Expand – Dependency and Contract Polish

- Goal: Tighten the auto-expand effect and document the `pending_approval` contract for Shell (CLI) nodes.
- What:
  - Narrow the `useEffect` dependency surface in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx) that auto-expands the Right Sidebar on CLI `pending_approval` so it reacts only to the minimal state required (e.g., `pendingApprovalNodeId`, `rightCollapsed`, and the specific node type), avoiding unnecessary renders.
  - Capture the `pending_approval` status contract and expectations (who emits it, when it clears, and what UI it drives) in a small vertical-slice note or inline docs so future changes to execution events keep Shell approval behavior aligned.
- Why: Keeps the auto-expand behavior explicit and efficient while making the status contract discoverable for future engine or UI changes.

### Playbox Toggle – Disabled State Messaging and Collapse Rules

- Goal: Improve accessibility and consistency for the Playbox toggle while approvals are pending.
- What:
  - Add a short `aria-disabled`-friendly message or tooltip to the disabled Playbox burger in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/sidebar/RightSidebar.tsx) that explains it cannot be collapsed during Shell approval (e.g., "Sidebar locked while a Shell approval is pending").
  - Centralize the rules that determine when the Right Sidebar may collapse (e.g., no pending approvals, no blocking dialogs) into a small helper so toggle behavior stays consistent as new approval surfaces or safety flows are added.
- Why: Makes the disabled state understandable for keyboard and screen reader users and reduces the risk of drift in collapse behavior as the Playbox evolves.

- Goal: Refine sidebar toggle behavior and discoverability beyond the minimal collapse/expand implementation
- What:
  - Disable or ignore drag resizing while a sidebar is collapsed, or store/restore the last expanded width when re-expanding to avoid surprising size jumps
  - Make the sidebar headers sticky (`tw-sticky tw-top-0`) so the burger remains pinned even when content scrolls, in both collapsed and expanded states
  - Return keyboard focus to the toggle button after collapsing/expanding to improve keyboard navigation
  - Normalize burger button dimensions between collapsed and expanded headers (consistent `tw-h-8 tw-w-8 tw-p-0`) for visual consistency
  - Review the Help (`?`) control for labeling consistency; ensure clear `title`/`aria-label` and consider icon consistency with shadcn button sizing
  - Optional: persist `leftCollapsed`/`rightCollapsed` in workspace settings or webview state so layout preference survives reloads
  - Optional: add a keyboard shortcut to toggle each sidebar for power users (e.g., `[` and `]` with a modifier), ensuring shortcuts are discoverable and conflict-free
- Why: Reduces accidental layout changes during collapse, improves accessibility and keyboard UX, and makes the UI more predictable and consistent across states without increasing complexity

### RightSidebar Result Viewer – Accessibility and Controls

- Goal: Improve accessibility and affordances of the inline Markdown Result viewer
- What:
  - Add `tabIndex`, `role="region"`, and an `aria-label` (e.g., "Node Result (Markdown)") to the container for keyboard and screen reader support
  - Optional: add a small "Copy" button to copy rendered Markdown source or plain text for quick reuse
- Why: Ensures the rendered results remain discoverable and navigable via keyboard/screen readers and improves usability for quick copy operations

### RightSidebar Result Viewer – Large Output Handling

- Goal: Keep the UI responsive for very large Markdown outputs without losing detail
- What:
  - Add a simple truncation with "Show more" expand control after a configurable threshold (e.g., first 2,000–5,000 characters)
  - Optionally support a collapse/expand control for long code blocks to reduce scroll fatigue
- Why: Extremely large outputs can impact render performance and overwhelm the sidebar. A progressive disclosure pattern keeps the UI fast and readable while still allowing full inspection when needed

### Markdown Modal and Link Handling Polish

- Goal: Align Markdown link behavior and sanitizer with extension handler and improve editor navigation UX
- What:
  - Make `#Lxx`/`#Lxx-Lyy` fragment parsing case-insensitive when extracting line anchors in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L460-L468)
  - When a line range is present, select the full range instead of a single cursor point after revealing in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L477-L483)
  - Expand DOMPurify allowed attributes for Markdown to include `id`, `aria-*`, and `data-*` to preserve anchors and accessibility/data hooks in [Markdown.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Markdown.tsx#L36-L49)
- Why: Ensures robust navigation for line-anchored links, preserves useful attributes for accessibility and in-page anchors, and keeps sanitizer aligned with supported link schemes without over-restricting content.

### Vendored Amp SDK Flow – Optional Automation and Resilience

- Goal: Streamline updates and add resilience for the new vendored SDK approach
- What:
  - Add integrity/hash check and size sanity check for `vendor/amp-sdk/amp-sdk.tgz` during `npm run updateAmpSDK` to catch corrupt artifacts early
  - Optional fallback: when `@prinova/amp-sdk` fails to resolve at runtime, log a clear message suggesting `npm run updateAmpSDK` (keep dynamic require as-is to avoid hard failures)
  - Consider a small script to bump the vendored SDK from a known upstream path or registry tag with a single command (kept manual to avoid CI side effects)
  - Document expected require path for contributors to avoid reintroducing `@sourcegraph/amp-sdk`
- Why: Ensures the vendored SDK remains easy to refresh and reduces friction when resolving local environment mismatches without re-coupling the build to external paths

### Storage Scope Toggle and Configuration Polish

- Goal: Improve robustness and UX around storage scope switching and configuration
- What:
  - Deduplicate storage scope initialization messages by removing any redundant `get_storage_scope`/eager `storage_scope` sends so the webview receives a single authoritative update per load
  - Debounce or temporarily disable rapid scope toggles in the sidebar badge to avoid overlapping config updates; re-enable on `storage_scope` acknowledgment
  - Pre-create default directories for the current scope before opening Save dialogs to prevent surprising empty paths or permission errors
  - Tighten guards around user base path: validate `nebulaFlow.globalStoragePath` exists, is absolute, and is writable; surface actionable error when invalid
  - Minor cleanup: remove unused `dirUri` helper and any unused locals (e.g., transient `scope` variables) if no longer required
  - Centralize config reads (`storageScope`/`globalStoragePath`) into a single shared helper to avoid drift across modules
- Why: Reduces race conditions and edge-case errors, improves perceived responsiveness, and consolidates configuration logic for maintainability

### Pause/Resume - Bypass IF/ELSE Node Policy

- **Goal**: Define and enforce explicit policy for bypass on conditional nodes
- **What**: IF/ELSE nodes marked as `bypass` currently require an explicit seeded decision to complete; if no seed exists, pre-completion is deferred. Define whether to:
  - (A) Disallow bypass on IF/ELSE nodes entirely (simplest, prevents accidental misuse)
  - (B) Require explicit decision seed and fail/warn if seed is missing (requires user discipline)
  - (C) Allow auto-pause when bypass IF/ELSE lacks a seed, prompting user for decision (safest but more complex)
- **Why**: Bypass IF/ELSE nodes have no "default" sensible value; choosing a branch without user intent risks silent data loss and unexpected control flow. Current implementation defers completion (option B), but the policy should be explicit and documented.
- **Priority**: P1 (robustness; defines semantics for unsafe edge case)
- **Status**: Deferred pending policy decision; implementation ready for any choice

### Pause/Resume - Bypass Node Empty-String Fallback Warning

- **Goal**: Surface visibility when bypass nodes fall back to empty-string seeds
- **What**: When a bypass node lacks cached output and must use empty string as placeholder, emit a debug log or UI warning (once per run) to clarify the fallback behavior
  - Affects [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L233-L241) bypass pre-completion and [workflowExecution.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L183-L191) seed computation
- **Why**: Empty-string propagation through the workflow can cause silent data loss or unexpected behavior for downstream nodes. Users should understand when bypass is using a placeholder vs. actual cached output.
- **Priority**: P2 (debuggability; improves observability)
- **Status**: Not included in pause feature release; deferred for future visibility enhancement

### Pause Workflow - RunOnlyThis Pause Awareness

- **Goal**: Extend pause semantics to single-node execution
- **What**: Make `RunOnlyThis` button honor the pause gate; when pause is requested during single-node execution, wait for that node to complete before pausing
  - Affects [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts) single-node handler
  - Currently pause is only enforced by the parallel scheduler path; single-node execution skips pause logic
- **Why**: Pause should provide consistent semantics across all execution modes. Currently, `RunOnlyThis` ignores pause requests, potentially confusing users who expect uniform behavior.
- **Priority**: P2 (consistency; improves semantic uniformity of pause feature)
- **Status**: Not included in pause feature release; deferred for future enhancement
+
+### RunOnlyThis – Type Safety, Coverage, and Guard Consolidation

### CLI Node Typing and Save Path – Follow-ups

- Goal: Tighten CLI node typing across core and webview and remove minor DTO nits without changing behaviour.
- What:
  - Extend the core `WorkflowNodes` union to include `CLINode` so helpers that switch on `node.type` get the richer CLI-specific data shape by default.
  - Remove the redundant `?? undefined` on `sourceHandle`/`targetHandle` when building edge DTOs in [workflowActions.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowActions.ts) since JSON serialisation already drops `undefined`.
  - Audit and, if needed, clean up any remaining direct `shouldAbort` assumptions on CLI node `data` to rely on the shared `BaseNodeData.shouldAbort?` contract instead.
- Why: Completes the type-level integration of CLI nodes in the core model, keeps DTO shapes minimal and explicit, and avoids future drift around CLI abort semantics while preserving the current runtime behaviour.
+
+- **Goal**: Tighten typing and guard behavior for the `RunOnlyThis` affordance in the RightSidebar while keeping execution semantics simple.
+- **What**:
+  - Extend the `WorkflowNodes[NodeType.SUBFLOW]` data type so `subflowId` is modeled explicitly and remove the `(node as any)` access used in the RightSidebar disabled condition for SUBFLOW nodes in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/sidebar/RightSidebar.tsx).
+  - Define a single `RUN_ONLY_THIS_ENABLED_TYPES` (or similar) list alongside node-type definitions in [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx) or [models.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/models.ts) and reuse it in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/sidebar/RightSidebar.tsx) to decide when the button is shown, avoiding drift as new executable node types are added.
+  - Extract a small helper (e.g., `canRunOnlyThis(node, state)`) local to the webview slice to centralize `isPaused`, `executingNodeIds.size > 0`, and SUBFLOW-without-`subflowId` checks so both the button’s disabled state and the `useRunOnlyThis` guard follow the same rules.
+  - Add focused tests (when/where test harness exists) that cover visibility per node type, disabled behavior for paused/executing/SUBFLOW-without-id scenarios, and that clicking the enabled button dispatches the `nebula-run-only-this` event with the correct `nodeId`.
+- **Why**: Makes the RunOnlyThis affordance safer and more maintainable as the node catalog evolves, removes `any` casts around SUBFLOW metadata, and keeps UI/handler guards aligned through a single decision point while preserving the existing single-node execution flow.

### Pause Workflow - Resume After Brief Pause Race Condition

- **Goal**: Prevent race condition when user rapidly alternates pause/resume during active execution
- **What**: Debounce or disable the Resume button briefly after pause is requested, preventing immediate resume while extension still has active task inflight
  - Affects [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx#L85-L101) pause button state logic
  - After pause request posted, button should remain disabled until `execution_paused` event arrives
- **Why**: If user clicks Pause then Resume while tasks are still draining, the resume message arrives before the extension has fully paused, causing it to be rejected by the concurrency guard
- **Priority**: P1 (UX; prevents confusing user-facing error when rapid pause/resume occurs)

### Pause Workflow - Clear Button State During Pause

- **Goal**: Prevent unsafe clearing of workflow structure while paused
- **What**: Disable the "Clear" (Delete workflow) button while execution is paused or active
  - Affects [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx#L80-L89)
  - Currently only the Execute button changes state during execution; Clear remains enabled
- **Why**: Clearing while paused could create ambiguous state or lose workflow structure needed for resume. Disabling prevents accidental destruction during execution/pause states.
- **Priority**: P2 (UX safety; prevents mixed trigger semantics)

### Bypass Checkbox - Remove Unnecessary Any Casts

- **Goal**: Improve type safety of bypass node field access
- **What**: Remove unnecessary `any` casts around `data.bypass` field accesses in [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts) at lines 123, 162, and 523
  - Current pattern: `(parent as any)?.data?.bypass`
  - Recommended: `parent.data?.bypass` (bypass is typed in BaseNodeData)
- **Why**: The `bypass?: boolean` field is already defined in the node data type, so casting to `any` is unnecessary and reduces type safety. Direct property access provides compile-time type checking.
- **Priority**: P2 (code quality; improves type safety)

### Bypass Checkbox - Update Comment for Bypass Exception

- **Goal**: Clarify bypass semantics in bypass node in-degree calculation
- **What**: Update comment at [parallel-scheduler.ts L119](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-scheduler.ts#L119-L126) to reflect bypass exception
  - Current: "Treat seeded parents as satisfied"
  - Recommended: "Treat seeded parents as satisfied unless the parent is included and bypassed"
- **Why**: The code now includes a special case for bypass nodes marked with `bypass === true`, but the comment still reflects the older logic. Updated comment prevents future maintainers from misinterpreting the conditional logic.
- **Priority**: P2 (code quality; improves code clarity and maintainability)

### Bypass Checkbox - Silent Fallback Behavior Documentation

- **Goal**: Clarify and document behavior when bypassing nodes without cached results
- **What**: Add UI hint or tooltip explaining that empty strings are used as fallback when a bypassed node has no prior result cached
  - Consider visual indicator (icon or small label) in PropertyEditor checkbox row
  - Or add help text: "Node will use previous result if available; empty string if none"
- **Why**: Silent fallback to empty string when no cached result exists could confuse users. Explicit documentation prevents expectation mismatches.
- **Priority**: P2 (UX/documentation; nice-to-have for clarity)

### Bypass Checkbox - Distinguish "No Result Yet" vs "Intentionally Empty"

- **Goal**: Improve semantics and observability of bypass fallback behavior
- **What**: Add optional warning or status indicator when bypass is enabled on a node that currently has no cached result, or when the cached result is an empty string
  - Could display: "No cached result available" badge during property editor display
  - Or log/notify when bypass executes without a prior result
- **Why**: Users should understand when bypass will execute with an empty value. A visual cue distinguishes "never executed" from "intentionally empty result" scenarios.
- **Priority**: P2 (UX; nice-to-have improvement for workflow clarity)

### Bypass Checkbox - Resume Filter Cleanup

- **Goal**: Clean up dead code in resume filter pruning logic
- **What**: Remove unused `seedIds` local variable in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L223-L229) where bypass seeds are preserved during resume
- **Why**: Variable is computed but never referenced. Removing it reduces cognitive load and clarifies the actual pruning semantics.
- **Priority**: P2 (code quality; minor cleanup)

### Bypass Checkbox - Extract Bypass Seed Computation Helper

- **Goal**: Reduce duplication of bypass seed computation logic
- **What**: Extract the bypass seed computation logic from [workflowExecution.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L73-L80) and [workflowExecution.ts#L122-L131](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/workflowExecution.ts#L122-L131) into a shared helper function
  - Helper signature: `computeBypassSeeds(nodes: BaseNode[], nodeResults: Map<string, string>, bypassedNodeIds: Set<string>): Record<string, string>`
  - Used in both execute and resume branches
- **Why**: Same logic appears in two places, risking drift if bypass behavior changes. A shared helper improves maintainability and ensures consistent semantics.
- **Priority**: P2 (code quality; improves maintainability)

### Reset Button - Accidental Reset UX Feedback

- **Goal**: Provide user confirmation when results are cleared
- **What**: Add a brief toast/snackbar notification when the Reset button is clicked to acknowledge the action
  - Could display message like "Results cleared" for 2–3 seconds
  - Would appear in the RightSidebar or as a dismissible notification
- **Why**: Silent reset may go unnoticed if the user clicks quickly and navigates away. Visual feedback confirms the action completed successfully.
- **Priority**: P2 (UX; nice-to-have improvement based on user feedback)

### Reset Button - Data Shape Safety During Reset

- **Goal**: Improve robustness when custom nodes extend BaseNodeData
- **What**: Add defensive checks in the reset handler to validate optional fields before clearing:
  - Check if `content` and `tokenCount` fields exist before setting them to empty/zero
  - Consider iterating over node data schema instead of assuming field presence
- **Why**: If custom nodes add required fields or diverge from BaseNodeData shape, the reset logic could inadvertently break node state. Defensive checks prevent failures when custom nodes extend the base contract.
- **Priority**: P2 (robustness; prevents edge cases with extended node data)

### Text Node Modal - Escape Key Accessibility Enhancement

- **Goal**: Provide alternative keyboard navigation for modal dismissal in edge cases where Escape propagation is blocked
- **What**: While Escape key propagation has been enabled for standard dismissal, consider adding additional keyboard affordances (e.g., Ctrl+Enter to confirm, Tab+Enter navigation) for users who may experience keyboard event handling issues in rare environments
  - Related: [TextEditorModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/TextEditorModal.tsx#L39-L66)
  - Related: [dialog.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/ui/shadcn/ui/dialog.tsx#L62-L66)
- **Why**: While Escape works in standard environments, providing fallback keyboard shortcuts improves accessibility for users with non-standard input setups or browser configurations
- **Priority**: P2 (accessibility; nice-to-have improvement)

### Text Node Modal - ARIA Dialog Patterns for Focus Management

- **Goal**: Enhance accessibility of the Text Editor modal dialog with ARIA patterns for focus trapping and return focus
- **What**: Add ARIA dialog patterns to the portal-rendered modal, including:
  - `role="dialog"` on the content wrapper (already present at [dialog.tsx L67](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/ui/shadcn/ui/dialog.tsx#L67))
  - `aria-modal="true"` attribute (already present at [dialog.tsx L68](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/ui/shadcn/ui/dialog.tsx#L68))
  - Focus trapping within modal to prevent keyboard navigation outside dialog bounds
  - Return focus to triggering element when modal closes
  - `aria-labelledby` linking dialog title to heading for screen readers
- **Why**: Standard ARIA dialog patterns improve screen reader support and keyboard navigation accessibility, particularly for users relying on assistive technology
- **Priority**: P2 (accessibility; improves A11y compliance)

### Text Node Modal - SSR Hydration Risk in Portal Rendering

- **Goal**: Evaluate and document SSR hydration considerations for portal-rendered dialogs
- **What**: While the portal includes an SSR guard (`typeof document !== 'undefined'`), document the implications:
  - If SSR is introduced in the future, portal markup rendered on server will differ from client (SSR renders null, client renders portal)
  - Consider mounting portals only after a client-only flag is set via useEffect to prevent hydration mismatches
  - Review hydration behavior with any future static generation or server-side rendering features
  - Related: [dialog.tsx L73](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/ui/shadcn/ui/dialog.tsx#L73)
- **Why**: Current guard is appropriate for client-side-only webview context (VS Code). Document as a known limitation for future SSR contexts to prevent subtle hydration bugs.
- **Priority**: P1 (documentation; prevents future SSR-related issues)

### Text Node Modal - Textarea Resize UX Consideration

- **Goal**: Re-evaluate whether textarea resizing should be allowed based on user feedback
- **What**: Currently textarea uses `tw-resize-none` to disable manual resizing. If user feedback indicates desire for resize control, consider enabling vertical-only resize (`tw-resize-y`) to allow users to adjust modal height to their preference
  - Affects: [TextEditorModal.tsx L54](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/TextEditorModal.tsx#L54)
- **Why**: The 90vh container is large, but some users may prefer the ability to make the textarea smaller or larger based on their content. Vertical-only resize allows fine-tuning without breaking horizontal layout.
- **Priority**: P2 (UX; nice-to-have based on user feedback)

### Workflow Execution - Single-Node Error Event Handling

- **Goal**: Clarify and validate protocol expectations for single-node error/abort handling
- **What**: Single-node execution (ExecuteSingleNode.ts) currently emits both `node_execution_status` and `execution_completed` events when a node errors or is aborted. Confirm whether the webview expects both events (for consistency with full-workflow semantics) or if a dedicated single-event protocol would simplify state management
  - Evidence: [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L62-L85) emits events sequentially on error/abort
  - Related: [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L160-L195) handles both event types
- **Why**: Dual events add protocol complexity. Validating whether both are necessary prevents future confusion when debugging multi-event scenarios and clarifies the minimal event set for single-node execution semantics.
- **Priority**: P2 (protocol clarity; improves documentation)

### Workflow Execution - Interrupted vs Stopped Node Precedence

- **Goal**: Define clear precedence when both `interruptedNodeId` and `stoppedAtNodeId` are set
- **What**: If upstream execution handlers guarantee only one of `interruptedNodeId` or `stoppedAtNodeId` is ever set in a single execution completion, this enhancement is not needed. If both can be set simultaneously, document or enforce precedence in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L63-L69) to prevent sidebar highlighting two nodes for the same execution context
  - Current: Sidebar renders both nodes if both are set; visual confusion if both borders appear
- **Why**: Clarifies UI semantics when both indicators are present, preventing ambiguous visual feedback to users
- **Priority**: P2 (UX clarity; depends on upstream guarantees)

### Workflow Execution - Rename lastExecutedNodeId to lastCompletedNodeId

- **Goal**: Improve naming clarity to distinguish between "last executed" and "last completed" node states
- **What**: Rename `lastExecutedNodeId` tracking (and related variables) to `lastCompletedNodeId` across [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L69-L73) and status handler at [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L114-L124), and the webview ref in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L83-L89)
- **Why**: Naming clarity prevents future developers from misinterpreting the tracking semantics. "Completed" more accurately reflects that the node finished execution (including errors/interrupts), not merely started execution.
- **Priority**: P1 (code quality; improves naming consistency)

### Parallel Execution Analysis - Loop Node Grouping

- **Goal**: Improve visibility and handling of loop nodes in parallel execution analysis
- **What**: Loop nodes are currently excluded from parallel step analysis and assigned step -1 ("unsupported"). Consider adding a dedicated UI grouping/label in RightSidebar or canvas to indicate "unsupported parallel execution" status, making it visually explicit which nodes cannot participate in parallel execution paths
  - Affects [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L131-L136) and [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx) grouping logic
- **Why**: Users may not understand why loop nodes are missing from parallel step groupings. A dedicated "Unsupported Loop Nodes" section or visual indicator on the canvas would clarify their status and limitations.
- **Priority**: P2 (UX clarity; improves workflow comprehension for complex graphs with loops)

### Parallel Execution Analysis - Step Label Strictness

- **Goal**: Improve accuracy of branch hint labels in RightSidebar parallel step groups
- **What**: Current implementation marks a step "True" only if every IF node's true-set contains all step nodes. For multiple IF nodes this rarely passes. Consider computing per-step/per-IF hints using exclusivity to specific IF nodes rather than requiring global exclusivity across all IFs
  - Affects [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L79-L99) branch suffix logic
- **Why**: More nuanced branch hints (e.g., "Step 3 (2 nodes) – true if IF#1 is true") would accurately describe conditional execution without overconstraining to global exclusivity. Current all-or-nothing approach means most steps show no branch hint despite being conditional.
- **Priority**: P2 (UX refinement; improves accuracy of parallel path hints)

### Parallel Execution Analysis - Cycle Fallback Documentation

- **Goal**: Clarify cycle-breaking fallback behavior in topological sort
- **What**: In [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L72-L90), when the Kahn queue empties during cycle detection, the fallback picks the min in-degree node. Add a code comment explaining the intent and clarifying whether this marks a separate "recovery step" or continues the current step assignment
  - Affects logic at [L80-L90](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L80-L90)
- **Why**: The fallback is a rare case (graphs should be acyclic), but future maintainers need clarity on step boundary semantics when cycles force recovery. A brief comment prevents confusion about whether recovered nodes are grouped with the current step or assigned separately.
- **Priority**: P2 (code clarity; improves maintainability for edge cases)

### Parallel Execution Analysis - Sink Node Priority Documentation

- **Goal**: Document behavior of nodes without outgoing edges
- **What**: In [parallel-analysis.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/parallel-analysis.ts#L211-L225), nodes without outgoing edges return priority `+∞`. Document the expected ordering and grouping behavior for sink nodes and explain why infinite priority is appropriate for this context
  - Affects `getNodePriorityForParallelAnalysis()` function
- **Why**: Without documentation, maintainers may misinterpret infinity as a bug or unintended behavior. A clear comment explains the design choice and prevents accidental refactoring.
- **Priority**: P2 (code clarity; improves documentation completeness)

### Parallel Step Headers - Accessibility Enhancement

- **Goal**: Improve screen reader support for parallel step grouping headers
- **What**: Add `aria-level` or semantic heading level attribute to "Parallel Step N" headers in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L473-L481) to provide correct navigation context for assistive technology
- **Why**: Screen reader users benefit from proper heading hierarchy. Currently the step headers may be treated as plain text, reducing navigability.
- **Priority**: P2 (accessibility; improves screen reader experience for complex workflows)

### RightSidebar Node Selection - Type Narrowing and Multi-Select Semantics

- **Goal**: Improve type safety and document multi-select behavior for node selection
- **What**: Narrow `selectedNodeType` to `NodeType | null` instead of current implicit type; document and decide semantics for multi-select "primary" node when multiple nodes are selected in sidebar
  - Affects [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L43-L53) and [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx#L14-L24)
- **Why**: Current implementation extracts a single `selectedNodeId` from the `selectedNodes` array but doesn't define which node is "primary" when multiple are selected. Explicit type narrowing and documented semantics prevent ambiguity and reduce risk of unexpected behavior when multi-select is extended
- **Priority**: P1 (clarity; improves type safety and behavioral documentation)

### RightSidebar Node Selection - Naming and Extensibility for Multi-Select

- **Goal**: Improve naming clarity and future extensibility of selection summary for multi-node workflows
- **What**: Consider renaming `selectionSummary` to `selectionContext` or similar, and document future extensibility for multi-select aggregates (e.g., "3 nodes selected" badges, bulk operations)
  - Current: Helper extracts single node ID; future: could expand to aggregate metadata for multi-selection UI
- **Why**: Current naming assumes single-node context; explicit naming and extensibility planning reduce refactoring burden when multi-select features are added
- **Priority**: P2 (code quality; improves maintainability for future features)

### RightSidebar Title Accessibility Enhancement

- **Goal**: Improve accessibility and semantics of RightSidebar title header
- **What**: Add `aria-label` attribute to the "Playbox" heading in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L416) to provide descriptive label for screen readers
- **Why**: Screen reader users benefit from explicit aria labels that describe the purpose of the sidebar section. The label should clarify what content is displayed in this panel (e.g., "Playbox: Assistant and workflow execution results").
- **Priority**: P2 (accessibility; improves experience for screen reader users)

### RightSidebar Title Consistency with Other Headers

- **Goal**: Maintain consistent heading styling across sidebar components
- **What**: Review and align the "Playbox" header styling with other sidebar section headers (e.g., left sidebar headers) to ensure uniform visual treatment and semantic HTML usage
- **Why**: Consistent header styling improves visual cohesion and reduces maintenance burden when updating shared header patterns across the UI
- **Priority**: P2 (UX consistency; improves visual polish)

### RunFromHereButton Disabled State During Execution

- **Goal**: Prevent accidental mixed trigger of "Run from here" and "Run only this" while execution is active
- **What**: Disable the "Run From Here" button alongside "Run Only This" in all node types when `data.executing` is true
  - Affects [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx#L57), [IfElse_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/IfElse_Node.tsx#L56), [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx#L70), [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx#L114), [Variable_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Variable_Node.tsx#L56)
- **Why**: Currently only "Run Only This" disables during execution. "Run From Here" remains enabled, which could allow users to trigger a workflow-level execution while a single-node execution is in-flight, leading to potentially confusing concurrent operations
- **Priority**: P2 (UX; prevents mixed trigger semantics during execution)

### RunOnlyThis Button UX Enhancement - Visual Feedback

- **Goal**: Provide clear visual indication of disabled execution state
- **What**: Add optional spinner/dim effect to disabled RunOnlyThis buttons for better affordance of the disabled state
  - Context: Node toolbars in [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx#L58-L70) contain button groups with possible visual treatments
- **Why**: Currently the button disables but may lack obvious visual affordance (appearance change beyond opacity). Spinner or dimming effect makes the disabled state more discoverable to users
- **Priority**: P2 (UX polish; improves visual clarity)

### Node Toolbar Deduplication

- **Goal**: Eliminate copy-paste drift in node action buttons across node types
- **What**: Extract recurring button groups ("Run Only This", "Run From Here") from individual node components into a shared toolbar component
  - Affects [CLI_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/CLI_Node.tsx), [IfElse_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/IfElse_Node.tsx), [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx), [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx), [Variable_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Variable_Node.tsx)
- **Why**: Maintains toolbar consistency and reduces maintenance burden. Changes to action buttons only need to be made in one place, reducing risk of drift when adding new actions or modifying button behavior
- **Priority**: P2 (code quality; improves maintainability and prevents drift)

### LLM Node Workspace Root Prioritization - Multi-Panel Concurrency

- **Goal**: Eliminate global state race condition for concurrent multi-panel workflows
- **What**: The `activeWorkflowUri` in [workspace.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/workspace.ts#L3) is a single module-level variable. With two workflow panels open executing concurrently, the last panel to set the value overwrites the previous one, causing the wrong workspace root to be used during execution initiated from the first panel.
- **Why**: Global state doesn't support true concurrent multi-panel execution. When panel A starts execution but panel B becomes active in the meantime, panel A's execution will use panel B's workspace roots instead of its own.
- **Recommendation**: Associate workspace roots with the requesting panel via a `Map<Webview, Uri>` keyed by webview instance, or pass explicit roots alongside execution messages in the request contract so each panel carries its own context.
- **Priority**: P1 (concurrency; blocks reliable multi-panel execution)

### LLM Node Workspace Root Path Normalization

- **Goal**: Prevent duplicate roots and mis-ordering on case-insensitive file systems
- **What**: Path comparison in [workspace.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/workspace.ts#L18-L20) uses string inequality (`r !== preferred`) to filter and reorder workspace roots. On case-insensitive file systems (macOS default, Windows), paths like `/Users/Dev/project` and `/users/dev/project` would be treated as different roots even though they refer to the same folder.
- **Why**: Case-insensitive file systems can silently create duplicate root entries with different casing, breaking root ordering assumptions and potentially confusing SDK context resolution.
- **Recommendation**: Normalize paths before comparison using `vscode.Uri.toString()` lowercased or a path canonicalization resolver to ensure consistent matching across file system types.
- **Priority**: P1 (robustness; prevents cross-platform root ordering bugs)

### If/Else Single-Node Token Parsing Robustness

- **Goal**: Improve robustness of condition string parsing in single-node If/Else execution
- **What**: In [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L260-L271), add trimming of individual tokens after splitting condition string on operator. Currently inputs like `a ===  b` (extra spaces) or leading/trailing spaces can cause unexpected inequality.
- **Why**: Whitespace sensitivity can produce silent comparison failures. Trimming tokens ensures robust parsing for user inputs with variable formatting
- **Priority**: P1 (robustness; prevents silent condition mismatches)

### If/Else Single-Node Async Marker Cleanup

- **Goal**: Reduce overhead and clarify async semantics in single-node If/Else execution
- **What**: Remove `async` keyword from `executeSingleIfElseNode` in [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L255-L271) since the function performs no awaits and executes synchronously
- **Why**: Unnecessary `async` adds promise wrapper overhead. Removing it reflects actual sync behavior and improves performance
- **Priority**: P2 (optimization; minor performance improvement)

### RunOnlyThisButton Disabled State During Execution

- **Goal**: Prevent accidental double-trigger of single-node execution and improve UX clarity
- **What**: Update [RunOnlyThisButton.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RunOnlyThisButton.tsx) to disable the button while an execution is active (track execution state from parent or global hook) and add `aria-disabled` attribute for accessibility
- **Why**: Allows users to understand execution state visually and prevents multiple rapid clicks that could queue executions unexpectedly
- **Priority**: P2 (UX; improves interaction feedback and prevents user errors)

### If/Else Single-Node Operator Support Documentation

- **Goal**: Clarify limitations of condition evaluation in single-node mode
- **What**: Add UI helptext or documentation in [IfElse_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/IfElse_Node.tsx) explaining that quoted values and operators beyond `===`/`!==` are not supported and resolve to `false`
- **Why**: Current implementation mirrors full-workflow behavior but may surprise users. Explicit documentation prevents confusion about which expressions are supported
- **Priority**: P2 (UX/documentation; improves user understanding)


### Single-Node Execution - Error Handling for Unsupported Node Types

- **Goal**: Provide clear feedback when unsupported node types are executed in single-node mode
- **What**: Ensure [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts) explicitly rejects IF_ELSE, LOOP_START/END, and ACCUMULATOR node types with descriptive error messages
- **Why**: Some node types (control flow, aggregation) cannot execute in isolation. Clear errors guide users to understand which nodes support RunOnlyThis feature
- **Priority**: P2 (UX; improves error messaging for unsupported operations)

### CLI Node - Timeout Validation

- **Goal**: Prevent invalid timeout configurations in single-node execution
- **What**: In [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L166-L175), clamp or disable negative `timeoutSec` values to prevent unintended timeout behavior
- **Why**: Negative timeouts can produce unexpected results in timing logic. Explicit validation (clamp to zero or disable override) prevents silent misconfigurations
- **Priority**: P1 (robustness; prevents configuration errors)

### Edge Order Fallback - Deterministic Edge Ordering for Inputs

- **Goal**: Improve predictability of edge ordering when edge order metadata is missing
- **What**: In [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L337-L345), replace the `?? 0` fallback for missing `orderNumber` with a stable fallback (e.g., `Number.MAX_SAFE_INTEGER`) to prevent unintended reordering of edges during single-node input collection
- **Why**: Using 0 as fallback can reorder edges unexpectedly if the first edge naturally has `orderNumber: 0`. A large number ensures unordered edges sort to the end, preserving insertion order for intentionally-ordered edges and preventing silent reordering bugs
- **Priority**: P2 (robustness; prevents subtle ordering bugs)

### CLI Node - Default Model Key Constant

- **Goal**: Eliminate hard-coded default model reference in single-node execution
- **What**: Extract the hard-coded default model key from [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L98) into a shared constant alongside `DEFAULT_LLM_MODEL_ID` and `DEFAULT_LLM_MODEL_TITLE`
- **Why**: Hard-coded strings reduce maintainability and increase risk of inconsistency across execution paths. A centralized constant ensures model selection remains synchronized
- **Priority**: P2 (code quality; improves consistency and maintainability)

### ExecuteSingleNode - Unused Local Cleanup

- **Goal**: Clean up dead code in single-node handler
- **What**: Remove unused `dangerouslyAllowAll` local variable in single-node LLM path and consider removing `...args` from `routeNodeExecution` in [NodeDispatch.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/NodeDispatch.ts#L17-L22)
- **Why**: Unused locals reduce code clarity and may indicate incomplete refactoring. Removing them improves code maintainability and reduces cognitive load
- **Priority**: P2 (code quality; minor cleanup for clarity)

### Single-Node Execution - RunOnlyThis Button UX Enhancement

- **Goal**: Prevent accidental double-trigger of single-node execution
- **What**: In [RunOnlyThisButton.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RunOnlyThisButton.tsx), disable the button while an execution is active and add `aria-disabled` attribute for accessibility
- **Why**: Allows users to understand execution state visually and prevents multiple rapid clicks that could queue executions unexpectedly
- **Priority**: P2 (UX; improves interaction feedback and prevents user errors)

### Single-Node Execution - Input Type Filtering Documentation

- **Goal**: Clarify behavior when parent nodes produce non-string outputs
- **What**: In [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L341-L345), document or explicitly convert non-string parent outputs when building inputs for single-node execution
- **Why**: Currently non-string outputs are silently ignored. Making this behavior explicit prevents confusion about which inputs are used and clarifies the data type contract
- **Priority**: P2 (code quality; improves clarity of data handling)

### Custom Node Sanitizer - Additional Type Support

- **Goal**: Extend sanitizer to handle runtime-only types beyond functions and symbols
- **What**: Consider extending [nodeDto.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/utils/nodeDto.ts) `sanitizeValue` function to handle `Date`, `Map`, `Set`, and other non-primitive types that may appear in node data
- **Why**: Current sanitizer only removes functions and symbols. If node data contains Date objects, Map/Set collections, or other non-cloneable types, they would still trigger DataCloneError on postMessage
- **Priority**: P2 (robustness; prevents edge cases with complex data structures)

### Custom Node Sanitizer - Mutable Behavior Refactoring

- **Goal**: Improve purity and maintainability of the node-to-DTO conversion
- **What**: Refactor [nodeDto.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/utils/nodeDto.ts#L29-L47) `toWorkflowNodeDTO` to be non-mutating; currently sets `onUpdate = undefined` directly on the input node object instead of only on the returned DTO copy
- **Why**: Mutation of input parameters reduces predictability and can cause unexpected side effects for callers. A purely functional approach (shallow copy node, then sanitize) improves testability and safety.
- **Priority**: P1 (code quality; improves functional purity)

### Custom Node DTO - Layout Field Persistence

- **Goal**: Evaluate completeness of persisted node layout metadata
- **What**: Confirm whether additional layout fields (e.g., `width`, `height`, `style`) should be included in the [WorkflowNodeDTO](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/Contracts/Protocol.ts#L25-L32) contract to ensure custom node load behavior is visually consistent
- **Why**: Currently `position` and basic node properties are preserved, but custom node styling or sizing might be lost. Verify workflow expectations for custom node layout restoration after load.
- **Priority**: P2 (nice-to-have; improves visual consistency for custom nodes)

### postMessage Error Handling - Stronger Type Safety

- **Goal**: Improve type safety of error handling in message dispatch
- **What**: Update catch clause in [vscode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/utils/vscode.ts#L20-L33) to use `unknown` instead of implicit `any` for the caught error
- **Why**: TypeScript best practice for error handling; `unknown` requires explicit type narrowing, preventing accidental misuse of error object without checking its type first
- **Priority**: P2 (code quality; improves error handling type safety)

### Text Node - Untyped Custom Event Payload

- **Goal**: Improve type safety of edit event communication between nodes and Flow component
- **What**: Create a typed `NebulaEditNodeEvent` interface and apply it to the `nebula-edit-node` custom event dispatch in [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx#L22-L32) and listener in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L285-L314)
  - Define event shape: `{ id: string; action: 'start' | 'commit' | 'cancel'; content?: string; title?: string }`
  - Apply generic type parameter to `CustomEvent<T>` where `T` is the typed payload
  - Update event listener to cast `e.detail` to the typed interface
- **Why**: Currently using `any` type for custom event payload reduces IDE support and makes refactoring riskier. Typed events provide compile-time safety and clearer contract documentation
- **Priority**: P1 (code quality; improves type safety)

### Text Node - Unused Reference in Edit Mode

- **Goal**: Clean up unused code and clarify edit state management
- **What**: Remove or justify the unused `shouldRefocusRef` in [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx#L20-L21)
- **Why**: The ref was intended for focus management but is never updated or read in the current implementation. Removing it reduces confusion about edit lifecycle.
- **Priority**: P2 (code quality; minor cleanup)

### Shared Title Validation - Centralized Default

- **Goal**: Eliminate duplication of the default title fallback string across modules
- **What**: The magic 'Text' fallback appears in both [titleValidation.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/validation/titleValidation.ts#L3-L6) and [Text_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Text_Node.tsx#L131). Consider exporting `DEFAULT_NODE_TITLE` constant from titleValidation.ts and importing it in Text_Node.tsx
- **Why**: Centralized constant prevents accidental divergence and makes future default changes easier to manage
- **Priority**: P2 (code quality; improves maintainability)

### Flow Component - Null Guard for reactFlowInstance

- **Goal**: Improve robustness of drop-zone coordinate conversion
- **What**: Add a null/undefined check for `reactFlowInstance` in the drop handler [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L216-L228) before calling `screenToFlowPosition()`
- **Why**: If ReactFlow provider context is unavailable or hook fails silently, calling methods on undefined instance could cause runtime errors. Explicit guard prevents potential crashes.
- **Priority**: P1 (defensive programming; prevents potential null-ref errors)

### Edge Styling - Selector Enum and Simplification
- **Goal**: Improve type safety and reduce conditional logic in path strategy selection
- **What**: 
  - Consider using an enum for `EdgeStyleKey` to reduce risk of typos at call sites (currently using string union in [edgePaths.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/edges/edgePaths.ts#L41-L46))
  - Simplify `selectEdgePathStrategy` selector logic with union exhaustiveness checking to eliminate the need for a separate default case: `export function selectEdgePathStrategy(style: EdgeStyleKey = 'bezier'): EdgePathStrategy { return STRATEGY_MAP[style] }`
- **Why**: Enum prevents typos at call sites; exhaustive union checking makes the selector more maintainable as new styles are added and reduces verbose fallback logic
- **Priority**: P2 (code quality; improves maintainability and type safety)

### Edge Styling - Strategy Unit Tests
- **Goal**: Validate correctness and parity of custom edge path strategies
- **What**: Add lightweight unit tests comparing both `bezierPathStrategy` and `smoothStepPathStrategy` functions against the original @xyflow/react helpers (`getBezierPath` and `getSmoothStepPath`) for a fixed coordinate set
- **Why**: Ensures custom strategy implementations produce identical output to upstream helpers, preventing visual regression and providing confidence for future style additions
- **Priority**: P2 (quality assurance; improves test coverage for edge path rendering)

### Edge Styling - JSDoc Documentation
- **Goal**: Clarify edge style selection semantics for workflow authors
- **What**: Add JSDoc documentation to `selectEdgePathStrategy` and strategy functions explaining when to prefer bezier vs smoothstep styles
- **Why**: Helps future developers and workflow authors understand the visual and performance tradeoffs between edge styles
- **Priority**: P2 (documentation; improves developer experience)

### Workflow Execution - Extract PendingApproval Type
- **Goal**: Improve code clarity and maintainability of approval state management
- **What**: Extract `PendingApproval` type definition in [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L46-L55) to a dedicated type or interface, and remove the unused `_nodeId` field
- **Why**: Explicit typing improves readability and makes the pending approval contract clearer for future developers. The unused `_nodeId` field adds cognitive load and should be removed as part of type cleanup.
- **Priority**: P1 (nice-to-have; improves code clarity)

### Workflow Execution - Concurrent Approval Request Queuing
- **Goal**: Prevent approval overwrites during rapid sequential approval requests within a single panel
- **What**: Implement an approval queue instead of single `pendingApproval` per panel to handle cases where a second approval request arrives before the first is resolved
- **Why**: Current implementation stores a single pending approval promise per panel. While rare given sequential node execution, concurrent approval requests could overwrite earlier pending approvals, leading to one request never resolving. A queue ensures all approvals are processed in order.
- **Priority**: P2 (optional enhancement; rare edge case but improves robustness)

### CLI Node - Executor Options Type Safety
- **Goal**: Improve extensibility and maintainability of the shell executor interface
- **What**: Type the executor options parameter as `Pick<ExecOptions, 'cwd'>` instead of a loose object type
- **Why**: Provides explicit, typed contract for what executor options are supported, making future extensions (e.g., timeout, env vars) safer and clearer for contributors
- **Priority**: P1 (nice-to-have; improves type safety and future extensibility)

### CLI Node - Multi-root Workspace Handling
- **Goal**: Make CLI node behavior configurable for workspaces with multiple root folders
- **What**: Extend cwd selection beyond hardcoded index 0; consider UI picker or active resource detection
- **Why**: Currently always uses the first workspace folder. In multi-root setups, users may want to target a specific folder or the folder containing their active file
- **Priority**: P2 (optional enhancement; improves UX for multi-root workspace users)

### CLI Node - Missing Workspace UX
- **Goal**: Clarify user intent when no workspace is open
- **What**: Consider prompting users to open a folder when CLI node is executed without an active workspace, rather than silently falling back to extension directory
- **Why**: Running commands in the extension process directory can be confusing and lead to failed commands. Explicit prompt surfaces the issue and guides correct setup
- **Priority**: P2 (UX improvement; helps users avoid setup confusion)

### Window Title - Conditional URI in Protocol Message
- **Goal**: Reduce redundant data transmission when workflow filename is already known to the webview
- **What**: Only include workflow URI in the `workflow_loaded` protocol message when the file path information is necessary for the webview consumer
- **Why**: Currently, the URI is always sent even though the webview primarily uses it to trigger title updates via the existing panel title mechanism. Conditional passing reduces message payload and clarifies data flow semantics.
- **Priority**: P1 (nice-to-have; improves protocol clarity without affecting current functionality)

### Window Title - Extract Title Prefix Constant
- **Goal**: Improve maintainability and consistency of the NebulaFlow title prefix
- **What**: Extract the "NebulaFlow" prefix string into a shared constant (e.g., `NEBULA_FLOW_TITLE_PREFIX`) in the register.ts or a dedicated constants module
- **Why**: Centralizes the title prefix definition, reducing the risk of inconsistent text across save/load/create operations and making future branding changes easier.
- **Priority**: P2 (code quality; improves maintainability for future changes)

### Window Title - External File Rename Handling
- **Goal**: Maintain accurate window titles when workflows are renamed or moved outside the editor
- **What**: Detect when a loaded workflow file has been renamed or moved externally, and either update the title accordingly or prompt the user to re-save
- **Why**: If a user renames a workflow file outside the editor, the title would become stale, potentially causing confusion when managing multiple files.
- **Priority**: P2 (optional enhancement; edge case handling for better user experience)

### Right Sidebar State Reset - Optional `executionRunId` Prop
- **Goal**: Improve ergonomics for `Flow` and `RightSidebar` components when used outside the `useWorkflowExecution` hook (e.g., tests, stories)
- **What**: Make `executionRunId` prop optional in `Flow` and `RightSidebar` components with sensible defaults
- **Why**: External consumers (test suites, Storybook stories) may not have access to `useWorkflowExecution` hook state, causing prop drilling complexity. Optional prop with default value simplifies integration.
- **Priority**: P2 (nice-to-have, improves developer experience for edge cases)

### Right Sidebar State Reset - Documentation of `executionRunId` Semantics
- **Goal**: Clarify the initialization and batching behavior of the `executionRunId` reset mechanism
- **What**: Add code comment or inline documentation explaining:
- Why `executionRunId` is initialized to 0 on first mount
- How React batching affects the order of reset effects vs. message posting
- Why the reset effect checks `executionRunId > 0` before triggering
- **Why**: Future maintainers and contributors need clear understanding of the state management pattern to safely modify or extend the reset logic.
- **Priority**: P1 (improves maintainability; consider implementing alongside any follow-up fixes)

### LLM Node Reasoning Effort - Type Safety Improvements
- **Goal**: Remove type assertions and improve type safety in reasoning effort implementation
- **What**: 
   - Extract `ReasoningEffort` type to a shared constant module (e.g., `Core/Constants` or `Shared/Types`)
   - Remove `as any` casts in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/PropertyEditor.tsx#L318) and [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L397)
   - Update PropertyEditor and ExecuteWorkflow to import and use the shared type
- **Why**: Eliminates unnecessary type assertions, reduces literal duplication across files, and improves maintainability by having a single source of truth for valid reasoning effort values.
- **Priority**: P1 (nice-to-have; improves code clarity and type safety)

### LLM Node Reasoning Effort - Server Expectation Confirmation
- **Goal**: Validate server-side behavior for reasoning effort defaults
- **What**: Confirm with Amp SDK that it correctly handles the `reasoning.effort` = "medium" default now being sent unconditionally from ExecuteWorkflow.ts on every LLM node execution
- **Why**: Backend now always sets `reasoning.effort` to "medium" as fallback when value is missing or invalid. Server behavior should be validated to ensure no regressions or unexpected interaction with SDK's internal defaults
- **Priority**: P1 (verification step; ensures backend contract alignment)

### LLM Node Reasoning Effort - Performance Optimization
- **Goal**: Avoid unnecessary object allocations during workflow execution
- **What**: Hoist `validReasoningEfforts` validation set to module scope in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L392-L396) to prevent re-allocation on each LLM node execution
- **Why**: Currently creates a new Set on every LLM node execution, allocating memory repeatedly for an immutable set of valid values
- **Priority**: P3 (optimization; good-to-have for performance polish)

### LLM Node Reasoning Effort - Accessibility and Performance Polish
- **Goal**: Enhance accessibility and performance of reasoning effort button group
- **What**:
- Add `aria-pressed` attribute to reasoning effort buttons in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/PropertyEditor.tsx#L312-L329) for screen reader users
- Replace `console.log` with `console.debug` in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L368-L369) to reduce log noise
- **Why**: Improves semantic HTML and screen reader support; reduces log verbosity during workflow execution.
- **Priority**: P2 (optimization and polish; good-to-have for production quality)

### Preview Node - Edge Ordering Integration in Message Handling

- **Goal**: Ensure preview merge order respects ordered edges throughout the message pipeline
- **What**: Verify that `orderedEdges` parameter is properly threaded through all message handler calls in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts) that invoke `computePreviewContent()`, and confirm edge order maps consistently use ordered edge indices
- **Why**: After fixing the preview merge order to use `orderedEdges`, ensure the pattern is applied consistently across all code paths where preview content is computed to prevent future regressions
- **Priority**: P2 (code consistency; validates fix robustness)

### Preview Node - Remove Unused Parameter
- **Goal**: Clean up dead code in preview content computation
- **What**: Remove unused `previewNode` parameter from `computePreviewContent()` function in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L34-L39)
- **Why**: Parameter was intended for potential future use but is not accessed in the current implementation; removing it reduces cognitive load and clarifies intent
- **Priority**: P2 (code quality; trivial cleanup)

### Preview Node - Multi-hop Content Propagation
- **Goal**: Extend preview updates to transitive chains of preview nodes
- **What**: Enhance `getDownstreamPreviewNodes()` and the `node_execution_status` handler to recursively update preview nodes connected to other preview nodes (A → Preview1 → Preview2 chain)
- **Why**: Currently only direct previews connected to completed nodes are updated. Multi-hop chains would be blank until the intervening preview executes, limiting preview utility in complex workflows
- **Priority**: P2 (optional enhancement; improves preview coverage for advanced workflows)

### LLM Node Dangerously Allow All - Documentation and Tests
- **Goal**: Improve maintainability and reliability of the dangerously allow all commands feature
- **What**: 
  - Update documentation/labels explaining that "dangerously allow all" auto-approves all blocked commands regardless of SDK `toAllow` enumeration
  - Add unit and integration tests covering auto-approval scenarios with and without `toAllow` arrays
  - Document failure modes and observability hooks (audit logging) in feature documentation
- **Why**: The feature behavior now unconditionally auto-approves when enabled; documenting this intent and testing both paths ensures future maintainers understand the design and can safely refactor without regressions
- **Priority**: P2 (quality assurance; improves test coverage and clarity for future changes)

### LLM Node Default Model - Unit Test Coverage
- **Goal**: Add test coverage for default model assignment during node creation and workflow loading
- **What**: Create unit tests asserting that new LLM nodes receive Sonnet 4.5 as default model and that legacy workflows without models are normalized correctly on load
- **Why**: Ensures default model behavior is validated and protected against future regressions; complements the existing migration logic
- **Priority**: P2 (quality assurance; improves confidence in default model behavior)

### Input Node - Output Normalization Configurability
- **Goal**: Provide workflow-level control over line ending normalization on live INPUT output
- **What**: Add an optional configuration flag to control CRLF normalization behavior when rendering active INPUT nodes in live-preview mode
- **Why**: CRLF normalization can alter workflow semantics for users working with files that require specific line endings (e.g., Windows batch files, shell scripts with CRLF requirements). Making this optional prevents silent data mutation for workflows with strict line-ending requirements.
- **Priority**: P2 (optional enhancement; improves workflow portability across platforms)

### Input Node - Naming Clarity for `getInactiveNodes` Helper
- **Goal**: Reduce semantic confusion in ExecuteWorkflow helper functions
- **What**: Rename `getInactiveNodes` to `getReachableNodes` or document its true purpose (returns nodes reachable from a given node), and update all call sites accordingly
- **Why**: The current name is misleading; the function actually computes forward-reachable nodes, not inactive ones. Renaming prevents future maintainers from making incorrect assumptions about its behavior.
- **Priority**: P2 (code quality; improves maintainability and reduces misuse risk)

### Input Node - Performance Optimization for `allowedNodes` Construction
- **Goal**: Reduce computational overhead during workflow execution resumption
- **What**: Replace edge array iteration with direct `edgeIndex.bySource` lookup when constructing `allowedNodes` for resume filtering
- **Why**: Current approach scans the entire edge array; using a pre-indexed map structure (if available) would reduce time complexity from O(E) to O(1) per lookup, improving performance on large workflows.
- **Priority**: P3 (optimization; good-to-have for scalability)

### Input Node - Type Safety for Input Node Data Content
- **Goal**: Eliminate `any` type assertions in INPUT node output rendering
- **What**: Add typed `content?: string` field to INPUT node data contract instead of casting to `(parentNode as any).data?.content`
- **Why**: Explicit typing provides compile-time safety and clarifies the data shape for future developers working with INPUT nodes.
- **Priority**: P2 (code quality; improves type safety)

### Workflow Execution - Resume Filter Redundancy
- **Goal**: Simplify guard logic in workflow resumption filtering
- **What**: Remove redundant `resume?.fromNodeId` check in the resume filter, keeping only the `allowedNodes` validation
- **Why**: The `allowedNodes` set already encodes which nodes are executable; the additional `fromNodeId` check is redundant and adds unnecessary cognitive load.
- **Priority**: P3 (code quality; minor simplification)

### Workflow Execution - Debug Logging for Skipped Nodes
- **Goal**: Improve observability during workflow resumption
- **What**: Add debug logging or UI status indicator when nodes are skipped during resume due to resume filters
- **Why**: Silent skipping makes it difficult for users to understand why certain nodes didn't execute during a resume operation. Debug logs or UI feedback surfaces the reason.
- **Priority**: P2 (UX/observability; improves debugging experience)

### Parallel Scheduler - Graceful Degradation for Unsupported Node Types
- **Goal**: Improve robustness of parallel execution when unsupported control-flow nodes are present
- **What**: Instead of aborting the entire workflow when LOOP nodes are encountered, signal unsupported node types and allow the caller to fall back to sequential execution for that workflow
- **Why**: Currently throws an error if LOOP nodes are present, even if those nodes are unreachable. Graceful fallback to sequential mode would allow mixed workflows to execute instead of failing completely.
- **Priority**: P2 (optional enhancement; improves UX by avoiding hard failures for edge cases)

### Parallel Scheduler - Single-Pass Conditional Edge Indexing
- **Goal**: Optimize performance of If/Else branch detection in large workflows
- **What**: Replace the O(N×E) nested loop in `buildConditionalEdges()` with a single-pass edge iteration that identifies If/Else nodes and their branches
- **Why**: Currently loops over nodes and filters edges per node, leading to quadratic complexity. A single pass over edges would reduce to O(E), improving performance on workflows with many nodes and edges.
- **Priority**: P2 (performance optimization; beneficial for large graphs)

### Parallel Scheduler - Conditional Edge Skip Documentation
- **Goal**: Clarify the purpose of conditional edge skipping during child in-degree decrement
- **What**: Add a code comment explaining why conditional edges are explicitly skipped when decrementing child in-degrees in `decrementChildInDegrees()`
- **Why**: With placeholder in-degrees now properly applied, the explicit skip is technically redundant but kept for clarity. A brief comment would help future maintainers understand the design decision.
- **Priority**: P2 (code clarity; improves maintainability for future changes)

### Workflow State Persistence - Hydration Helper Duplication
- **Goal**: Eliminate duplication and improve maintainability of state hydration logic
- **What**: Consolidate state hydration into a single, reusable helper function instead of duplicating logic across `messageHandling.ts` and `workflowExecution.ts`
- **Why**: Hydration logic currently exists in two places, risking drift and maintenance burden. A shared helper ensures consistent behavior and reduces cognitive load for future developers.
- **Priority**: P1 (code quality; improves maintainability)

### Workflow State Persistence - Versioning Decoupling
- **Goal**: Decouple version bumping from specific feature presence
- **What**: Evaluate whether version management should be tied to the presence of optional state fields or managed independently as part of broader versioning strategy
- **Why**: Binding version selection to a single feature makes versioning logic fragile and harder to reason about during future feature additions. Independent versioning provides clearer semantic meaning.
- **Priority**: P1 (architectural; improves versioning robustness)

### Workflow State Persistence - Node Status Capture
- **Goal**: Improve fidelity of persisted node state
- **What**: Capture and persist actual node execution status during save instead of always setting status to 'completed'
- **Why**: Currently all nodes are saved with status 'completed' regardless of their actual runtime state. Storing real status enables more accurate resume behavior and better observability when loading workflows.
- **Priority**: P2 (optional enhancement; improves state fidelity for debugging)

### Workflow State Persistence - Undefined Field Omission
- **Goal**: Reduce protocol payload size and improve clarity of data contracts
- **What**: Omit undefined `state` field from protocol payload construction in `converters.ts` instead of passing it through unconditionally
- **Why**: Undefined fields add payload bulk and reduce clarity about optional vs. required contract fields. Omitting them produces cleaner protocol messages and improves maintainability.
- **Priority**: P3 (optimization; improves protocol clarity without affecting functionality)

### Auto-Fit View - Eliminate Redundant Fit Requests
- **Goal**: Optimize fit-to-view logic for workflow loading by removing duplicate operations
- **What**: Consolidate fit requests between initial `fitView` prop in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L362) and the fit orchestrator effect triggered by state hydration in [messageHandling.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/messageHandling.ts#L125)
- **Why**: Both mechanisms currently attempt to fit the view when a workflow loads. Evaluating whether the initial `fitView` prop is necessary (or if it ever fires) would allow removal of duplicate fit operations, simplifying the flow and reducing unnecessary DOM queries/animations.
- **Priority**: P2 (optional optimization; reduces complexity without affecting user experience)

### Inactive Node Filtering - Prefer Length Check Over Presence Method

- **Goal**: Simplify graph composition mode condition logic and improve performance
- **What**: Replace `edges.some(...)` presence checks with `edges.length > 0` in [node-sorting.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/engine/node-sorting.ts#L275-L283) during edge filtering initialization
- **Why**: When checking whether a filtered edge set exists for node composition, `length > 0` is more direct and avoids the overhead of the `some()` method which stops iteration early but still adds function call overhead. This is a minor optimization but improves code clarity by using the most straightforward boolean test.
- **Priority**: P2 (code quality; minor performance improvement and readability)

### Single-Node and Workflow Timeline Helper Deduplication

- **Goal**: Reduce code duplication and maintenance burden for assistant timeline helpers
- **What**: Extract shared timeline-building and stringify helpers used in both [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L170-L176) and [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L398-L405) into a centralized module (e.g., `timeline.ts` or `assistantHelpers.ts`)
- **Why**: Timeline and stringify logic is duplicated across execution paths, increasing maintenance burden when timeline format changes and risking divergence between single-node and workflow execution. A shared helper ensures consistent timeline semantics across both paths.
- **Priority**: P2 (code quality; improves maintainability and reduces drift risk)

### Variable Map Construction and Interpolation Type Tightening

- **Goal**: Improve type safety and reduce runtime uncertainty in variable handling
- **What**: Replace multiple `as any` casts around variable map construction and interpolation in [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts) and [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts#L398-L405) with a lightweight helper function that properly types variable objects
- **Why**: Numerous `as any` assertions reduce type safety and make refactoring risky. A small helper that constructs and validates the variable map would eliminate assertions and clarify the expected data shape for interpolation operations.
- **Priority**: P2 (code quality; improves type safety and maintainability)

### Single-Node LLM Execution - Thread ID Defensive Check

- **Goal**: Prevent potential null-ref errors in single-node LLM approval flow
- **What**: Add a defensive null/undefined check for `thread.id` before passing to `amp.sendToolInput` in [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts#L177-L249)
- **Why**: If thread object is missing or malformed, calling `amp.sendToolInput` with undefined thread ID could cause silent failures or runtime errors. An explicit guard provides clearer error messaging and prevents downstream issues.
- **Priority**: P2 (defensive programming; prevents edge case errors)

### Execution Tracing - Gated Debug Logging

- **Goal**: Reduce console noise while maintaining debuggability for development
- **What**: Gate new `console.debug` traces in [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteSingleNode.ts) and [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/handlers/ExecuteWorkflow.ts) behind an environment flag (e.g., `DEBUG_WORKFLOW_EXECUTION=true` or check against `process.env.NODE_ENV`)
- **Why**: Debug logging during normal operation adds noise to the extension console. Gating behind an environment flag allows developers to opt in to detailed tracing without affecting end-user experience or test output.
- **Priority**: P2 (code quality; improves observability without affecting default behavior)

### Confirm Delete Workflow Modal - Dialog Open State Forwarding

- **Goal**: Prevent state desynchronization between modal component and underlying dialog primitive
- **What**: Forward the `open` boolean parameter in the `onOpenChange` callback to the Dialog component in [ConfirmDeleteWorkflowModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/ConfirmDeleteWorkflowModal.tsx#L21), matching the dialog API contract
  - Current: `onOpenChange={() => setOpen(!open)}` (toggle semantics)
  - Recommended: `onOpenChange={(isOpen) => setOpen(isOpen)}` (forward the boolean state)
- **Why**: The dialog component provides the boolean state parameter for a reason; ignoring it means the modal state could drift from the dialog's internal state if future behavior depends on programmatic state updates or external control
- **Priority**: P1 (robustness; prevents future state desync issues)

### Confirm Delete Workflow Modal - Clear Button State During Execution

- **Goal**: Prevent unsafe clearing during active workflow execution
- **What**: Disable the "Clear" (Trash) button when a workflow is executing (check `executing` prop from parent)
  - Evidence: [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx#L80-L89) renders Clear button without execution state guard
  - Related: [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L375-L382) tracks execution state and passes `executing` to SidebarActionsBar
- **Why**: If clearing while nodes are executing is unsafe (partial state cleanup, race conditions), the button should be visually disabled to prevent accidental invocation during active runs
- **Priority**: P2 (UX; prevents mixed trigger semantics if clearing mid-execution has unintended side effects)

### Confirm Delete Workflow Modal - Callback Completion Guard

- **Goal**: Prevent modal close before async operations complete
- **What**: If `onClear()` can be async or throw errors, guard the modal close and await completion before calling `setOpen(false)`
  - Current code: [SidebarActionsBar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/SidebarActionsBar.tsx#L111-L117) calls `onClear()` but doesn't await or guard for errors
- **Why**: If `onClear()` initiates async work (file operations, state cleanup) and the modal closes immediately, the user might think the action failed. Guarding ensures the modal stays open until the callback completes.
- **Priority**: P2 (UX/robustness; improves feedback for async operations)

### Confirm Delete Workflow Modal - Accessibility Enhancement

- **Goal**: Improve screen reader support for confirmation dialog
- **What**: Add `aria-describedby` attribute linking the dialog description text to the heading in [ConfirmDeleteWorkflowModal.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/ConfirmDeleteWorkflowModal.tsx#L26-L35)
- **Why**: Screen reader users benefit from explicit semantic links that clarify the purpose and content of the dialog. The current structure has description text but lacks the accessibility contract.
- **Priority**: P2 (accessibility; improves screen reader experience)

### Dynamic Input (Fan-In) Connections - Drag-Time Validation Tolerance

- **Goal**: Improve UX feedback when connecting to fan-in node bodies during drag operations
- **What**: Relax drag-time validation for body hover on fan-in nodes; if `targetHandle` is undefined during hover (mid-drag), return true so the UI can snap to the fan-in body; strict enforcement still happens in onConnect with the patched handle assigned
  - Affects [edgeValidation.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/utils/edgeValidation.ts#L15-L19) `isValidEdgeConnection` call in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L204-L207)
- **Why**: Currently connections are invalid during drag if `targetHandle` is absent, blocking snap/highlight when aiming at the fan-in body. Tolerating undefined handles during drag provides visual feedback; strict validation defers to onConnect where the handle is assigned. This improves UX without compromising correctness.
- **Priority**: P2 (UX improvement; enhances drag feedback for fan-in connections)

### Dynamic Input (Fan-In) Connections - Extract parseFanInIndex Helper

- **Goal**: Eliminate duplication of fan-in handle parsing logic across modules
- **What**: Unify fan-in index extraction from handle names into a single `parseFanInIndex(handleId: string): number` helper; use it consistently in [edgeOperations.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/edgeOperations.ts#L78-L93), [edgeValidation.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/utils/edgeValidation.ts#L19-L33), and [nodeStateTransforming.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/nodeStateTransforming.ts#L11-L20)
- **Why**: The same parsing pattern (extract numeric index from `in-N` handle names) appears in three places. A shared helper reduces duplication, improves maintainability, and prevents inconsistencies if parsing logic evolves.
- **Priority**: P1 (code quality; eliminates duplication and improves maintainability)

### Dynamic Input (Fan-In) Connections - Race Condition Mitigation

- **Goal**: Prevent edge count mismatches when multiple edges are added to the same fan-in node in one tick
- **What**: Re-check the "used" set inside the functional state update in [edgeOperations.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/hooks/edgeOperations.ts) to detect concurrent edge additions and assign the next truly-free slot instead of relying on a stale snapshot
- **Why**: Rare race condition: if two edges are added to the same fan-in node in one React tick, both might compute the same "next free" index based on the same snapshot, resulting in duplicate handle assignments. Re-checking inside the functional update prevents this.
- **Priority**: P1 (robustness; prevents edge case with concurrent connections)

### Dynamic Input (Fan-In) Connections - Fan-In Target Handle Hit-Testing

- **Goal**: Improve hit-testing and click responsiveness on dynamically generated fan-in handles
- **What**: Consider setting `pointerEvents: 'all'` on generated fan-in handles in [FanInTargetHandles.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/FanInTargetHandles.tsx#L11-L22) if hit-testing edge cases are observed during drag operations
- **Why**: In some React Flow configurations, dynamically generated handles may not receive pointer events correctly if parent container has `pointerEvents: none` or other CSS constraints. An explicit `pointerEvents: 'all'` ensures reliable hit detection.
- **Priority**: P2 (optional enhancement; investigate if drag snapping issues persist)

### Dynamic Input (Fan-In) Connections - Default Fan-In UX Confirmation

- **Goal**: Clarify UX expectations for fan-in adoption on Text nodes
- **What**: Confirm user intent for enabling fan-in by default on Text (INPUT) nodes at [Nodes.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Nodes.tsx#L95-L121)
- **Why**: Text nodes now support fan-in connections, but the feature is opt-in per node. Confirm whether fan-in should be enabled by default on all new Text nodes or only when explicitly configured. This decision affects default workflow composition.
- **Priority**: P3 (UX clarity; low impact, informational)

### Preview Node - Custom Event Payload Type Safety

- **Goal**: Improve type safety of edit event communication for Preview nodes
- **What**: Create a typed `NebulaEditNodeEvent` interface and apply it to the `nebula-edit-node` custom event dispatch in [Preview_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/Preview_Node.tsx#L30-L43) and listener in [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L285-L314)
  - Define event shape: `{ id: string; action: 'commit'; content: string }`
  - Apply generic type parameter to `CustomEvent<T>` where `T` is the typed payload
  - Update event dispatch to cast payload to the typed interface
- **Why**: Currently using `any` type for custom event payload reduces IDE support and makes refactoring riskier. Typed events provide compile-time safety and clearer contract documentation. This follows the same pattern as the Text node edit events.
- **Priority**: P1 (code quality; improves type safety, mirrors Text node enhancement)

### Token Percentage Indicator - Negative Value Guard

- **Goal**: Prevent bogus percentage displays from malformed tool output
- **What**: Add clamping or non-negative guard on percent value after parsing in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L19-L24)
  - Current: `const percent = parseFloat(item.content?.tokens?.percent)`
  - Recommended: `const percent = Math.max(0, parseFloat(item.content?.tokens?.percent))`
- **Why**: Defensive parsing prevents negative or invalid percentages from appearing in the UI when tool output is truncated or malformed
- **Priority**: P2 (code quality; improves robustness)

### Token Percentage Indicator - Header IIFE Refactor

- **Goal**: Eliminate per-render function allocation in Agent Node header
- **What**: Replace IIFE pattern in header section rendering [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L561-L585) with a plain block or extract to a sub-component
  - Current: `{(() => { ... })()} ` inside JSX
  - Recommended: Move rendering logic to a separate helper function or component defined outside render
- **Why**: Per-render IIFEs create new function objects on each render, adding allocation overhead. Plain blocks or extracted components provide cleaner semantics and better performance
- **Priority**: P2 (optimization; minor performance improvement)

### Token Percentage Indicator - Accessibility Enhancement

- **Goal**: Improve screen reader support for token percentage indicator
- **What**: Add `aria-label` and optional `title` attribute to the percentage display span in [RightSidebar.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/RightSidebar.tsx#L569-L573)
  - Suggested label: "Token budget used: x %"
- **Why**: Screen reader users benefit from explicit semantic labels that describe the purpose of the indicator. The label clarifies what the percentage represents without reading raw numbers.
- **Priority**: P2 (accessibility; improves experience for screen reader users)
