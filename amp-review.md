## High-level summary  
A single component (`workflow/Web/components/sidebar/RightSidebar.tsx`) was modified to surface an LLM-node’s textual prompt in the right sidebar.  
• A helper flag `hasPrompt` is computed per node.  
• The content-rendering branch now mounts when the node has (a) results, (b) assistant chat history, **or (c) a prompt**.  
• Inside the assistant-timeline renderer, the prompt (if any) is rendered as a fixed “Prompt” card that appears above the existing accordion/timeline.  
• Double-clicking the card dispatches a `nebula-edit-node` custom event to start inline editing.

No other files were touched.

---

## Tour of changes  
Start at the main render block that begins around original line 885 (now ~900). This is where:  
1. The new mount-condition is introduced.  
2. The scrollable container is reused to hold both the timeline and the new prompt card.  
3. The “Prompt” card is injected into `segments` before any non-text items are flushed—understanding this explains every subsequent diff hunk.

---

## File level review  

### `workflow/Web/components/sidebar/RightSidebar.tsx`

1. New flag   
   ```ts
   const hasPrompt =
       node.type === NodeType.LLM &&
       typeof node.data?.content === 'string' &&
       node.data.content.trim().length > 0
   ```
   ✓ Defensive type/whitespace checks.  
   ✻ Minor duplication: the same logic is re-run later to obtain the `prompt` string; consider re-using the earlier result.

2. Mount condition  
   ```tsx
   (nodeResults.has(node.id) ||
    (node.type === NodeType.LLM &&
        (nodeAssistantContent.has(node.id) || hasPrompt))) && …
   ```
   ✓ Ensures the sidebar opens if the node has just a prompt but no history yet.  
   ⚠️ Side-effect: if a prompt exists but neither history nor results, the scrollable container mounts with an **empty** list except for the prompt. That is intended, but be aware that `assistantScrollRefs.current.set()` etc. now run in that case.

3. Scrollable container  
   – Max-height rules (`tw-max-h-64` or `60vh`) still apply, so a very long prompt will scroll, preventing sidebar growth.  
   ✓ Overflow handled.  
   ✻ If prompts can be extremely large, consider `tw-break-words` to avoid a single unbroken token stretching the container.

4. Prompt card insertion  
   ```tsx
   if (prompt.length > 0) {
       segments.push(
           <div key={`${node.id}:prompt`} … onDoubleClick={…}>
               <div className="…uppercase…">Prompt</div>
               <p className="tw-text-xs …pre-wrap">{prompt}</p>
           </div>
       )
   }
   ```
   • Uses a stable React key.  
   • Renders as literal text (`<p>`), so no XSS exposure.  
   • Card background color intentionally matches side-bar (contrasts with assistant answer cards).  
   • Double-click handler stops propagation then dispatches a global custom event.  
     – Coupling to `window` is acceptable but a React context callback would be cleaner and testable.  
     – No keyboard alternative: add `role="button"`, `tabIndex={0}`, and `onKeyDown` for accessibility.

5. Auto-scroll logic  
   The prompt is added **before** any accordion flush; therefore the initial scroll position still ends at the bottom of the assistant timeline, not the prompt. That seems fine because the prompt is static; just confirm UX expectations.

6. Performance  
   – Two `trim()` calls per render are negligible.  
   – `segments` allocation is unchanged except for one extra node.  
   – Event dispatch is synchronous but rare (double-click only).

7. Internationalisation  
   String “Prompt” is hard-coded; if the rest of the UI is localised, extract to the i18n utility.

8. Tests / stories  
   None were updated. Recommend:  
   • Snapshot-test that the prompt card appears when expected.  
   • Event test that double-click fires the correct custom event.

9. Miscellaneous  
   • `hasPrompt` computed but never used outside the first JSX condition; acceptable but could be inlined there to avoid an extra variable.  
   • No changes to type definitions, so TypeScript still compiles.

---

### No other files changed.