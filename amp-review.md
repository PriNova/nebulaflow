## High-level summary
This patch adds first-class support for overriding the “system prompt” on a per-LLM node basis.

Major touch points  
• Data model: new optional `systemPromptTemplate` property added to the `LLMNode` interface (backend and frontend).  
• UI: a new editor modal in `LLMProperties.tsx` allows users to enter or clear a custom system prompt.  
• Execution: both single-step execution (`ExecuteSingleNode.ts`) and full workflow execution (`run-llm.ts`) now extract the property and pass it to `createAmp`.  
• Dependencies: `vendor/amp-sdk/amp-sdk.tgz` is updated, presumably to accept the new `systemPromptTemplate` argument.  
• A new—currently empty—`.amp/system-prompt/system-prompt.md` file is staged (likely to document the default prompt in the future).

## Tour of changes
The clearest way to understand the feature is to:
1. Start with `workflow/Core/models.ts` to see the schema change.  
2. Then open `workflow/Web/components/sidebar/properties/LLMProperties.tsx` to see how the property is surfaced and edited.  
3. Finally review the execution paths (`ExecuteSingleNode.ts` and `run-llm.ts`) to verify the new field is honoured at runtime.

## File level review

### `.amp/system-prompt/system-prompt.md`
New empty file. If this is meant for documentation, commit a stub with at least a heading or remove it until populated to avoid noise.

### `vendor/amp-sdk/amp-sdk.tgz`
Binary upgraded. Verify in a separate diff that:
• It introduces the `systemPromptTemplate` option to `createAmp`.  
• No breaking changes were introduced.

### `workflow/Core/models.ts`
```ts
+ systemPromptTemplate?: string
```
Looks correct. Optional, so no migrations needed. No further comments.

### `workflow/Web/components/nodes/LLM_Node.tsx`
Same single-line addition as above—keeps frontend node definition in sync with backend. ✔️

### `workflow/Web/components/sidebar/properties/LLMProperties.tsx`
New UI for editing the override.

Correctness & UX  
• Modal state and draft handling mirror the existing prompt editor—good.  
• Empty or whitespace-only input clears the override, preserving default behaviour.  
• Uses `node.id` in the dependency array to reset modal states—👍.

Minor suggestions  
1. Duplicate trimming logic exists here and in execution. Consider a shared util (`normalizeSystemPrompt(template: string): string | undefined`) to avoid divergence.  
2. The explanatory `<p>` element hard-codes two messages. If localisation is in use elsewhere, extract to i18n.  
3. While casting with `as any` works, you could extend the `LLMNode['data']` type so `systemPromptTemplate` is accepted without a cast.

Accessibility  
• The “Edit system prompt…” button lacks an `aria-label`. Optional but easy win.

### `workflow/WorkflowExecution/Application/handlers/ExecuteSingleNode.ts`
Key additions:
```ts
const rawSystemPrompt = ((node as any).data?.systemPromptTemplate ?? '').toString()
const trimmedSystemPrompt = rawSystemPrompt.trim()
const systemPromptTemplate = trimmedSystemPrompt.length > 0 ? rawSystemPrompt : undefined
...
createAmp({ apiKey, workspaceRoots, systemPromptTemplate, settings: { ... } })
```

Good practice  
• Trimming to decide emptiness is correct, yet the **untrimmed** version is forwarded to `createAmp`. That preserves user formatting (newlines/indent). 👍  
• Defensive `toString()` protects against non-string values.

Possible improvement  
`(node as any).data` bypasses the strong typing you just updated. Prefer `const { systemPromptTemplate } = node.data as LLMNode['data']`.

### `workflow/WorkflowExecution/Application/node-runners/run-llm.ts`
Mirrors the logic above—consistency ✔️.

### Common runtime concerns
1. Security: Nothing here changes permissioning or shell access; no new vulnerabilities observed.  
2. Performance: String trimming is negligible.  
3. Backward compatibility: Optional fields default to undefined so old workflows run unchanged.  
4. Validation: A very long system prompt could blow token limits. Consider length validation or a warning in UI.

## Overall assessment
A well-scoped feature with clean schema, UI, and runtime integration. Minor polish items involve type-safety, shared utility functions, and documentation.