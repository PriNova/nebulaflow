## High-level summary
This diff is a small, targeted refactor.  
The project used to keep its own canonical tool-name tables (`BUILTIN_TOOL_NAMES`, `TOOL_NAME_ALIASES`) and a handful of helper functions inside `workflow/Web/services/toolNames.ts`.  
That file is now converted into a thin wrapper around the same constructs that ship with `@prinova/amp-sdk`.  
Only NebulaFlow-specific “quality-of-life” aliases are kept locally.  
To consume the new helpers the vendored SDK tarball (`vendor/amp-sdk/amp-sdk.tgz`) was refreshed.  
No other production files were touched.

## Tour of changes (recommended starting point)
Begin with `workflow/Web/services/toolNames.ts`; this is where the logic moved, and understanding its new delegation pattern explains why the SDK blob was updated.  
Once satisfied that the wrapper behaves identically, just verify that the binary SDK version in `vendor/…` matches `package.json` and that nothing else in the repo refers to the deleted constants.

## File level review

### `amp-review.md`
Documentation only—rewritten to describe the tool-name refactor.  
Nothing to review functionally.

---

### `workflow/Web/services/toolNames.ts`
What changed  
1. Imports the canonical tables and helpers (`BUILTIN_TOOL_NAMES`, `TOOL_NAME_ALIASES`, `getAllToolNames`, `resolveToolName`) from `@prinova/amp-sdk`.  
2. Re-exports `BUILTIN_TOOL_NAMES` unchanged so callers need not migrate.  
3. Introduces `LOCAL_ALIASES` (six shorthand aliases plus `GitDiff`).  
4. Creates a merged `TOOL_NAME_ALIASES = { …SDK, …LOCAL }`.  
5. Re-implements
   • `getAllToolNames()` → `sdkGetAllToolNames()`  
   • `resolveToolName()` → first `sdkResolveToolName()`, then local aliases.  
   `isToolEnabled()` is untouched.

Correctness / edge cases  
• Alias precedence:  
  – Because `resolveToolName()` calls the SDK first, any alias that exists in both the SDK and `LOCAL_ALIASES` resolves to the SDK mapping, regardless of the spread order in the merged object.  
  – The local override therefore only takes effect for aliases that the SDK does **not** define—safe.  
• Duplicate `"GitDiff"` appears in both maps; it resolves to the SDK mapping. Clarify intent or drop the duplicate local entry.  
• Trimming behaviour (`nameOrAlias.trim()`) is preserved.  
• No breaking API changes for downstream code—the exported names/ helpers have the same surface.

Performance / maintenance  
Negligible runtime impact; removes local duplication and avoids drift with the SDK as it evolves.

Type-safety  
Still returns `string | undefined` exactly as before; callers stay type-compatible.

Security  
No new risk introduced. Delegating to a vetted SDK centralises validation in one place.

---

### `vendor/amp-sdk/amp-sdk.tgz`
Binary blob updated. Cannot inspect diff, but:
• Ensure the version referenced in `package.json` matches this tarball.  
• Confirm integrity hash if you pin one.  
• Scan upstream changelog for breaking behaviour in other exported areas of the SDK (notably anything that touches security-sensitive code such as shell execution helpers).

## Overall assessment
A minimal, well-scoped refactor that unifies tool-name logic with the SDK, reducing maintenance overhead.  
Only item worth double-checking is whether the duplicate `"GitDiff"` alias is intentional; if not, delete it or move the local alias map ahead of the SDK spread so it truly overrides.