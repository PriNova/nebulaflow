## High-level summary
This change introduces a “storage scope” feature that allows NebulaFlow users to decide where workflows and custom nodes are stored:

* New VS Code settings  
  • `nebulaFlow.storageScope` – `"workspace"` or `"user"` (default)  
  • `nebulaFlow.globalStoragePath` – overriding the user-level base folder  
* Extension side  
  • Command handling for `get_storage_scope` and `toggle_storage_scope`  
  • Pushes the current scope to the webview and refreshes it on settings change  
* Persistence layer  
  • All file IO is routed through a new `getRootForScope()` helper that resolves the folder according to the chosen scope, with migration from legacy folders when `workspace` scope is used.  
* Webview  
  • UI shows a tiny “User / Workspace” badge next to *Library* and lets the user toggle the scope.  
* Protocol / guards updated accordingly.  
* `.gitignore` and `tasks/` housekeeping.

Overall, the patch is cohesive and implements the feature end-to-end, but a few correctness and UX issues need attention.

## Tour of changes
Start with `workflow/DataAccess/fs.ts`; it contains the core path-resolution logic (`getConfig`, `getRootForScope`) that all other pieces rely on.  
Once comfortable with that, move to `workflow/Application/register.ts` for command wiring, then `Protocol.ts`/`guards.ts`, and finally the React-side files (`Flow.tsx`, `WorkflowSidebar.tsx`, `hooks/messageHandling.ts`) to understand UI flow.

## File level review

### `.gitignore`
+ Adds `tasks/`.  
  • OK.

### `package.json`
+ Adds `contributes.configuration` section with the two new settings.

Suggestions / issues  
1. The `globalStoragePath` setting has `"scope": "application"` which is good, but you should also add `"pattern"` or `"markdownDeprecationMessage"` to warn if it is non-absolute because the code silently ignores non-absolute values.  
2. The enum for `storageScope` is strings; consider `"default": "user"` directly inside the schema (VS Code will pick it up).

### `workflow/Application/register.ts`
+ Helper `readStorageScope()` – returns `{ scope, basePath }`. Good extraction.
+ Handles two new message types:
  • `get_storage_scope` – replies with `storage_scope` event  
  • `toggle_storage_scope` – flips setting in the correct configuration target.
+ Sends initial scope info after first render and also when configuration changes (`cfgWatcher`).
+ Disposes `cfgWatcher` together with the panel – good.

Issues / recommendations  
1. Possible race: if `toggle_storage_scope` is fired quickly twice, the second update runs before the first `onDidChangeConfiguration` refresh completes. You might debounce or lock.  
2. `readStorageScope` returns `basePath` even when scope === "workspace". That’s harmless but unused data.  
3. `readStorageScope` is implemented twice (here and in `fs.ts` as `getConfig`). Consider sharing.

### `workflow/Core/Contracts/Protocol.ts`
+ Adds the three new message/command interfaces and updates union types.

No issues.

### `workflow/Core/Contracts/guards.ts`
+ Guards for new message types added.

Issue  
1. In `storage_scope` guard, you don’t check that `basePath` is present **only** when `scope === "user"`. If UI relies on that invariant, add the check.

### `workflow/DataAccess/fs.ts`
This is the heart of the change.

Key points  
* `getConfig()` – reads settings and resolves absolute user base folder via `os.homedir()` when needed.  
* `getRootForScope()` – returns `{ scope, root }`. For workspace scope it returns the first workspace folder; for user scope it returns `Uri.file(baseGlobal)`.  
* All fs helpers (`saveWorkflow`, `loadWorkflow`, `getCustomNodes`, `saveCustomNode`, `deleteCustomNode`, `renameCustomNode`) now call `getRootForScope()` instead of directly reading `workspaceFolders`.

Correctness / corner cases  
1. When `storageScope === "user"` and the user supplies an **empty** `globalStoragePath`, the code picks `os.homedir()`. That is fine, but:
   • You no longer add `.nebulaflow/…` under VS Code’s *globalStorageUri*. That means every NebulaFlow user will suddenly pollute their home directory. Consider piggybacking on `context.globalStorageUri` or default to `~/.nebulaflow` explicitly for clarity.

2. You never create the “root” directory in `saveWorkflow` before presenting the save dialog. On first run the dialog’s default path may not exist. You could pre-create with `fs.createDirectory`.

3. `dirUri` is unused – remove or apply.

4. `saveWorkflow()` still computes `defaultFilePath` but the **scope** variable is unused; remove to silence the eslint rule.

5. Migration routines are executed only for `workspace` scope (good), but you probably also want to migrate user-level data once (from the previous location inside `home/.nebulaflow`) if you later change defaults again.

Security  
* The node/file names still go through `sanitizeFilename`, so no additional path traversal risk introduced.

### `workflow/Web/components/Flow.tsx`
+ Local state `storageScope` added; requests info on mount (`get_storage_scope`).
+ Passes scope and toggle handler down to sidebar.

Minor  
* There are now two requests for scope: once in `Flow`’s `useEffect` and again in `useMessageHandler` after listener is installed (inside the hook). The first one can race with the listener not being ready. You already added the safe one in the hook; remove the extra call in `Flow` (the earlier one) to avoid double messages.

### `workflow/Web/components/WorkflowSidebar.tsx`
+ Renders badge with `User` / `Workspace` and click handler.

UX suggestions  
1. Badge looks like a button but has no hover aria; you added title – good. Consider `aria-label`.  
2. Style uses VS Code variables, fine.

### `workflow/Web/components/hooks/messageHandling.ts`
+ Extends the hook’s API with `setStorageScope`.
+ Adds new case ‘storage_scope’.

Observation  
* You post another `get_storage_scope` in the cleanup return; that’s good but combined with the earlier note, deduplicate.

### `.vscode/tasks` addition is ignored in diff – only gitignore updated.

## Overall recommendation
The feature is well threaded through extension, persistence, and UI. Main concerns:

1. Default “user” path now writes to `$HOME/.nebulaflow`. Decide if that’s acceptable and document it, or place it under `context.globalStorageUri` instead.
2. Remove duplicate scope request to avoid message races.
3. Tighten type guards and unused code (`dirUri`, unused variables).
4. Handle potential directory-does-not-exist when showing save dialog in user scope.
5. Optionally debounce consecutive `toggle_storage_scope` invocations.

Once those small issues are addressed, the change looks solid.