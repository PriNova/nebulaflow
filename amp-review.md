## High-level summary
The patch tightens the handling of “disabled tools”, focusing on the special-case for the `Bash` tool:

1. Comparisons against the tool name are now case-insensitive (and in one place whitespace-tolerant).
2. `normalizeDisabledTools()` will now fall back to a locally shipped resolver (`Core/toolUtils.ts`) if the Amp SDK’s `resolveToolName` is missing, producing more reliable canonical names.
3. `ExecuteWorkflow.ts` respects the new comparison logic so that the `dangerouslyAllowAll` escape hatch is blocked whenever any variant of “bash” is disabled.

No public API surface changes; all adjustments are internal safety/robustness improvements.

## Tour of changes
Begin with `workflow/Application/handlers/llm-settings.ts`.  
This file introduces the new resolver fall-back and the revised
`isBashDisabled()` logic. Understanding these two functions clarifies why
`ExecuteWorkflow.ts` needed a mirror update and how the tool lists are
normalized before being inspected.

After that, look at `ExecuteWorkflow.ts`, which now mirrors the same
case-insensitive detection when deciding whether to honour the
`dangerouslyAllowAll` flag.

## File level review

### `workflow/Application/handlers/llm-settings.ts`

Changes
• Added local import: `resolveToolNameLocal` from `../../Core/toolUtils.js`.  
• `normalizeDisabledTools()`  
  – Uses optional chaining to attempt the SDK resolver first, otherwise falls back to the local resolver.  
  – Keeps original trim/empty-string guard.  
• `isBashDisabled()`  
  – Comparison now `.toLowerCase() === 'bash'` and is whitespace-tolerant via `trim()`.

Review
1. Correctness  
   – Fallback guarantees deterministic behaviour when the SDK resolver is absent.  
   – Case-insensitive check removes previous brittle dependency on exact capitalisation.

2. Potential issues  
   – `resolved` is cast to `string` (`as string`) before the truthiness check. This cast is unnecessary and can hide type errors; consider keeping it typed as `string | undefined`.  
   – If `resolveToolName` returns `''` (empty string) the truthiness guard will skip the add, but such a value would be odd—worth documenting.  
   – `normalizeDisabledTools()` now depends on `safeRequireSDK()`’s caching behaviour. If the SDK is hot-swapped at runtime (unlikely), the resolver could change mid-process; caching the resolver in a module-level variable would be more explicit.

3. Security  
   – Lower-casing plus trimming prevents trivial bypasses (`"BASH "` etc.). Good hardening.

4. Performance  
   – Each call to `safeRequireSDK()` will still perform a `require` attempt and `catch` on failure. If this function is called frequently, cache the boolean “SDK present” flag to avoid redundant `try/catch`.

### `workflow/Application/handlers/ExecuteWorkflow.ts`

Changes
• Guard that suppresses `dangerouslyAllowAll` if Bash is disabled now reads:

```ts
if (
    llmDebug.dangerouslyAllowAll &&
    llmDebug.disabledTools.some(t => typeof t === 'string' && t.toLowerCase() === 'bash')
)
```

Review
1. Correctness  
   – Matches the new `isBashDisabled()` semantics except for whitespace—no `.trim()` here. An entry like `' bash'` will bypass the guard. Recommend mirroring `trim().toLowerCase()` for parity.

2. Safety  
   – Strengthens the previous protection; “BASH” or “bash” can no longer slip through.

3. Style  
   – Minor: consider extracting a shared utility (`isBashToolName()`) to avoid duplicate comparison logic between files.

4. Types  
   – `typeof t === 'string'` guard avoids runtime errors if `disabledTools` is poorly typed. Good.

## Recommendations

1. Unify Bash comparison logic across codebase  
   Create `function isBash(name: string): boolean` performing `name.trim().toLowerCase() === 'bash'` and consume it everywhere (normalisation, checks, tests).  
2. Cache SDK resolver presence/result once at module load to drop repeated `try/catch` overhead.  
3. Remove unnecessary `as string` cast in `normalizeDisabledTools()`.  
4. Add unit tests with variants: `'bash'`, `'BASH'`, `' bash '`, `'BaSh'` to ensure coverage.