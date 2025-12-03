## High-level summary
The patch introduces a new `user_message` content-block kind into the streaming/timeline model (`AssistantContentItem`).  
All layers are updated accordingly:

1. **Contract / types** – add the new union member.
2. **Runtime guard** – validate the new variant.
3. **Execution layer** (`extractAssistantTimeline`) – emit `user_message` items when replaying a Thread.
4. **UI** (`RightSidebar`) – display the new block with its own icon and timeline style.

No code has been removed; all changes are additive.

## Tour of changes
Begin with `workflow/Core/Contracts/Protocol.ts`.  
The type change there is the lynchpin: every other diff chunk only makes sense once the new union member is understood. Afterwards follow the stack downward to the guard, then execution, then UI.

1. `Protocol.ts` ‑ defines the new variant.  
2. `guards.ts` ‑ keeps runtime validation in sync.  
3. `run-llm.ts` ‑ produces the new objects at execution time.  
4. `RightSidebar.tsx` ‑ consumes and renders them.

## File level review

### `workflow/Core/Contracts/Protocol.ts`
Changes  
• Added union member `{ type: 'user_message'; text: string }` in `AssistantContentItem`.  
• Clarified comment header.

Review  
✔ Correctly typed; optional fields not necessary.  
⚠️ You may now need to revisit every `switch (item.type)` in the code base to avoid uncovered “exhaustive-switch” TypeScript errors suppressed by `default:`. Some files were updated; others might still miss the case.

### `workflow/Core/Contracts/guards.ts`
Changes  
• `isAssistantContentItem` switch now validates `'user_message'` by checking `.text`.

Review  
✔ Logic mirrors `'text'` branch; looks correct.  
✔ No performance impact.  
⚠️ Consider extracting the shared `return isString((value as any).text)` to reduce duplication.

### `workflow/Web/components/sidebar/RightSidebar.tsx`
Changes  
• Timeline title logic: new case renders “👤 You”.  
• Content renderers:  
  – Simple paragraph inside accordions.  
  – Full-width block style in the inside timeline builder (`segments` array).  

Review  
✔ UI consistency with other message types.  
✔ Uses existing colour variables; no new CSS leakage.  
❗ Security: unlike `thinking`, no sanitisation is done (`thinking` runs an explicit `sanitizeThinking`). `user_message` is rendered with `whitespace-pre-wrap` directly. If user-supplied text may contain `<script>` or other markup, React will still escape it by default, so this is safe **unless** you switch to `dangerouslySetInnerHTML` elsewhere. Document this assumption.  
💡 Potential duplication: both `'text'` and `'user_message'` share identical rendering code. Could unify to reduce maintenance.

### `workflow/WorkflowExecution/Application/node-runners/run-llm.ts`
Changes  
• When iterating through `thread.messages`, now maps user role’s `content` blocks:
  – If `block.type === 'text'` ⇒ emit `{type: 'user_message', text: …}`.  
  – Existing handling for `tool_result` unchanged.

Review  
✔ Business logic matches the new spec.  
⚠️ Edge cases:  
 1. OpenAI / other provider may send `user` messages that contain **non-text blocks** (images, files). They will now be silently dropped. Document this or add fallback logging.  
 2. Uses `block.text || ''`; may produce empty strings (fine, but maybe warn).  
 3. Existing assistant flow remains untouched.

Performance/security OK.

## Overall remarks
• Change set is coherent and additive; minimal risk.  
• Audit other switch statements & reducers for completeness.  
• Consider consolidating render logic for text-like items and sanitising consistently.