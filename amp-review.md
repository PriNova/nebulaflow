## High-level summary  
This patch adds **workspace-wide Amp SDK configuration** that lives in `.nebulaflow/settings.json`.  
Two runtime areas now consume that file:  

1. Model picker in the editor (`register.ts`) – injects the workspace default model into the combobox.  
2. Workflow execution (`run-llm.ts`) – merges workspace settings with node-level overrides, re-implements model–selection precedence and fixes auto-approve handling.

Supporting code (`amp-settings.ts`) was introduced to locate / read / validate the JSON.  
Documentation (README) and the vendored SDK tarball were updated accordingly.

No public API contracts changed; impact is internal to LLM invocation and UI model listing.

---

## Tour of changes  
Begin with  
`workflow/WorkflowExecution/Application/node-runners/run-llm.ts`  

This file shows the new precedence order and the way workspace settings are combined with node-level settings – once that is clear, the supporting helper (`amp-settings.ts`) and UI change (`register.ts`) are straightforward.

---

## File level review  

### `README.md`  
+ Adds thorough explanation of `.nebulaflow/settings.json`, precedence rules, and an example.  
✓ Clear and actionable.  
✓ Mentions environment variable fallback.  
No issues.

---

### `amp-review.md`  
Internal meta-document – no runtime impact.

---

### `vendor/amp-sdk/amp-sdk.tgz`  
Binary bump only. Verify checksum and licence outside of code review.

---

### `workflow/Shared/Infrastructure/amp-settings.ts`  
New helper that:  
• Builds workspace path `<root>/.nebulaflow/settings.json`.  
• Reads/JSON-parses it, extracts `amp.settings` object.  
• Emits warnings when `warnOnError` is true.  

Correctness & robustness  
✓ Guards against missing folders, malformed JSON, absent keys.  
✓ Warn helper adds context tag.  
✓ Exported functions for *single root*, *workspace roots*, and *Host*.

Suggestions  
1. Cache result per `settingsPath` + mtime to avoid re-reading on every LLM run / palette open.  
2. `Record<string, unknown>` return type forces callers to use `[key: string]` – consider `Partial<AmpSdkSettings>` for type-safety.  
3. Only first workspace root is examined; document this clearly or iterate over roots until a file is found.  
4. Minor: trim path only once at API surface, not inside both public helpers.

Security  
✓ Reads inside workspace root only, no user-supplied path join.  
✓ No write operations.

---

### `workflow/LLMIntegration/Application/register.ts`  
Changes revolve around model-picker population.

Core logic  
1. Calls `readAmpSettingsFromHost` (good reuse).  
2. Extracts `internal.primaryModel` if present.  
3. If the model is not in SDK `listModels()` result, injects synthetic option  
   `title: "Workspace default: …"`.  
4. Sends combined list to webview.

Correctness  
✓ Keeps original SDK list unchanged.  
✓ Title prefix makes source of model explicit.  
✓ Functionally idempotent (no duplicates on second open).

Performance  
• Reads settings file every time handler runs; insignificant for small files but can be cached.

Developer UX  
• `warnOnError` is wired to `env.isDev` – good.  
• Consider shortening label (`★ Default: …`) to avoid overflow.

---

### `workflow/WorkflowExecution/Application/node-runners/run-llm.ts`  
Key behavioural change.

Model resolution  
• `selectedKey` initialised to *node-level* `modelId`.  
• Tries `ampSdk.resolveModel`; on failure keeps original id (does NOT silently fall back to default – good).  

Workspace merge  
```
const ampWorkspaceSettings = readAmpSettingsFromWorkspaceRoots(...)
const mergedSettings = { ...ampWorkspaceSettings, ...llmSettings }
const configuredPrimary = ampWorkspaceSettings['internal.primaryModel']
const primaryModelKey = selectedKey ?? configuredPrimary ?? defaultModelKey
```
✓ Precedence order: node > workspace > built-in.  
✓ Node-level values overwrite workspace duplicates.  
✓ `internal.primaryModel` is re-written after the spread so it always matches `primaryModelKey`.

Auto-approve  
✓ Calculated from **merged** settings – fixes earlier omission.

Error handling  
✓ All read / resolve errors are swallowed; controlled via env flag for workspace read.  
• Consider logging model-resolution failures in dev mode.

Performance  
• Same caching observation as above.

Edge cases  
• Workspace file exists but empty: merge harmlessly yields `{}` – fine.  
• If user sets `internal.primaryModel: ''`, `trim()` turns it into `undefined`, falling back correctly.  
• Still only first workspace folder examined.

Security  
✓ No path traversal.  
✓ `dangerouslyAllowAll` is honoured only when `allowBash` is true – preserves existing sandbox guarantee.

---

## Overall recommendations  
1. **Caching** – memoise parsed settings keyed by `settingsPath` + mtime to avoid redundant IO.  
2. **Multiple workspace folders** – optionally iterate until the first file is found instead of hard-coding `[0]`.  
3. **Developer feedback** – replace silent catches with `console.warn` in dev builds to aid debugging.  
4. **Type safety** – introduce `type AmpSettings = Partial<...>` instead of `Record<string, unknown>`.  
5. **UI polish** – shorten synthetic model label and maybe group it at top with a separator.

Implementation is solid, backward-compatible, and isolates new capability behind a non-breaking optional file.