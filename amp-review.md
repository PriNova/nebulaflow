## High-level summary
This PR introduces the first runnable “Amp Workflow Editor” vertical slice:

• Adds VS Code extension scaffolding (`package.json`, `tsconfig.json`, activation entry `src/extension.ts`).  
• Implements the execution engine (`src/engine/*`): graph sorting, loop handling, shell execution, file-system persistence, etc.  
• Defines the shared message/graph protocol (`src/protocol/WorkflowProtocol.ts`) plus a React/XYFlow based web-view UI under `webview/`.  
• Adds documentation (`AGENTS.md`, `amp-review.md`) and build scripts (`webview/vite.config.mts`).  
All changes are net-new—there are no deletions or modifications of existing files.

The feature footprint is large (~11 k LoC) but most files are presentational (React nodes, CSS). Core correctness and security risks are concentrated in the engine, shell execution, and extension/-webview message plumbing.

## Tour of changes
Start with `src/engine/executor.ts`.  
It orchestrates workflow execution, calls the shell, performs variable substitution, looping, if/else, accumulators, abort handling, and posts status back to the web-view. Understanding its behaviour makes the surrounding files (graph sorting, shell helper, extension host, webview handlers) immediately clear.

Suggested review path:

1. `src/engine/executor.ts` – execution semantics & security.  
2. `src/engine/node-sorting.ts` – topo-sort & loop expansion.  
3. `src/engine/shell.ts` & `executor.sanitizeForShell` – command safety.  
4. `src/extension.ts` – activation, message routing, abort propagation.  
5. `src/protocol/WorkflowProtocol.ts` – type contracts.  
6. `webview/workflow/...` – front-end hooks only for high-level sanity.  
7. Build/meta files (`package.json`, `tsconfig.json`, docs).

## File level review

### `AGENTS.md`
Documentation only. Reads well.

### `amp-review.md`
Meta-review doc – no issues.

### `package.json`
+ Good separation of build scripts.  
+ Dependency pinning uses caret (`^`) – reproducibility may suffer; consider `~` or `pnpm lockfile`.  
+ No `eslint`, `prettier`, `vitest` yet (documented).  
+ Extension id `"amp-editor"` should match publisher guidelines (`publisher.name`).  
+ `vscode` engine set to `>=1.90.0` (= May 2024 insiders). OK but be aware of marketplace adoption.  
+ `main` points to `dist/extension.js` but `tsc -p .` emits CJS; make sure `outDir` mirrors that path.

### `tsconfig.json`
Strict flags enabled – good.  
Consider `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` for protocol safety.

---

### `src/engine/executor.ts`
Correctness  
✔️  Indexed context maps avoid O(n²) look-ups.  
✔️  Handles skip-paths for if/else by recording edge traversal.  
⚠️  `replaceIndexedInputs` performs `new RegExp('\${...}')` string interpolation without escaping variable names; a user could craft a var with regexp metacharacters causing ReDoS. Escape the var when building the regex.  
⚠️  Accumulator / variable assignment uses `(node as any)` casts; type-safe discriminated unions would eliminate this.  
⚠️  `executeIfElseNode` splits condition by `/\s+(===|!==)\s+/`, so spaces are mandatory and only these two operators supported – document this.  
⚠️  `commandsNotAllowed` prefix check uses `startsWith`; `"rm -rf"` is blocked but `"  rm"` or `"./rm"` is not. Trim & split command.  
⚠️  `sanitizeForShell` escapes quotes **after** `${` which was already escaped earlier – order doesn’t matter but the implementation is naïve (no round-trip guarantee).  
⚠️  No timeout; long-running CLI blocks thread.

Performance  
`combineParentOutputsByConnectionOrder` converts every array result to string for each iteration; could memoize. Spurious `.trim()` and `\r\n` replace produce extra allocations but OK.

Concurrency  
Node execution is sequential even if DAG allows parallelism – document this (it’s simpler but slower).

Security  
• Deny-list is brittle. Prefer allow-list or spawn in a sandbox.  
• `shellExecute` passes `command` verbatim to `/bin/sh`. Injection possible if node author includes `;`. Sanitiser currently escapes `;` by `\;` but only after a global replace – still injectable via newline, backticks, `$( )`. Consider `spawn` with args array.

Error handling  
Returns after first error; fine. Be sure to propagate non-string rejections.

Telemetry  
None yet – fine.

---

### `src/engine/node-sorting.ts`
Correctness  
+ Implements Kahn plus custom ordering.  
+ Tarjan strongly-connected components for cycle handling.  
+ Loop expansion duplicates control nodes for `iterations`. Nice.

Bugs / edge-cases  
⚠️  `getLoopIterations`: `Number.parseInt(sourceNode?.data.content || '', 10)` may return `NaN`; later `!Number.isNaN(overrideValue)` guard is fine.  
⚠️  Potential infinite recursion in `findPreLoopNodes` if self-loop present. Protective depth limit recommended.  
⚠️  Many `any` casts; would crash in prod if shape differs.

Performance  
Large graphs could recurse deeply; consider iterative stack.

---

### `src/engine/shell.ts`
Uses `exec()` (buffer-based). Large stdout may exhaust memory; prefer `spawn`.  
No max buffer limit given (default 200 KiB).  
`AbortSignal` is wired – good.  
`expandHome` regexp `(\s~/)` misses paths at string start.  
Windows path separator handled via `path.sep`.

---

### `src/engine/fs.ts`
Reads/writes workflow & custom node JSON to workspace.  
✔️  Creates directories if missing.  
⚠️  No schema validation; malformed JSON may crash later.  
⚠️  File overwrite without confirm (save).  
Security: Reading arbitrary `.json` is safe; ensure no symlink traversal attacks (VS Code fs API should mitigate).

---

### `src/extension.ts`
Activation event `"onCommand:ampEditor.openWorkflow"` – OK.  
Creates single web-view panel; retains context.  
Handles all protocol messages.

Issues  
• No error handling around `webview.postMessage` failures.  
• On panel disposal aborts controller – good.  
• `webview.html` string replace of `"./"` naïvely rewrites relative paths; fails if `./` appears elsewhere.  
• Missing CSP nonce for inline scripts; currently allows only `{cspSource}` script – good.  
• Needs `dispose` for listener clean-up (currently uses `context.subscriptions`, good).

---

### `src/protocol/WorkflowProtocol.ts`
Comprehensive; but duplication with webview copy – risk of drift. Move to shared package or code-gen.

---

### `webview` (general)
Mostly UI nodes & utility hooks. Spot-checked:

Hooks  
• `messageHandling` mutates React state from message listener – OK but remember to remove listener on unmount (done via returned off-fn).  
• `edgeOperations` recomputes order map on every render; could memoise by `edges`.

Components  
• Many inline styles; consider CSS for theming.  
• `PropertyEditor` accepts any JSON, writes to node with casts – type safety low.

Security  
Web-view scripts trust messages from extension only; `open_external_link` opens arbitrary url – extension already sanitises (uses `vscode.Uri.parse`) but still user-provided.

Performance  
Token counting uses `length` not tokenizer – acknowledged in doc.

---

### `webview/vite.config.mts`
Emits to `../dist/webviews` – matches extension.html loader.

---

## Recommendations

1. Harden shell execution  
   • switch to `child_process.spawn` with array args.  
   • implement allow-list instead of deny-list.  
   • sanitize newlines/backticks/`$()`; or better, show confirm dialog with rendered command and force explicit approval.

2. Escape regex in `replaceIndexedInputs` when building `new RegExp`.  
3. Consolidate protocol types into a shared `.d.ts` to avoid divergence.  
4. Add schema validation (zod/io-ts) when reading workflow JSON.  
5. Enforce max buffer / timeout on CLI output.  
6. Unit-test `node-sorting` against cyclic graphs, nested loops, if/else skip-paths.  
7. Provide Telemetry/Logging hooks for troubleshooting.  
8. Pending small nits: absolute links in docs, consistent extension id, eslint config, caret versions, help modal accessibility.

With these tightened, the initial slice is in good shape to merge and iterate.