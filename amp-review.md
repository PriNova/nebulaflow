## High-level summary  
The patch only touches `workflow/Web/components/RightSidebar.tsx`.  
It introduces:

1. Two utility helpers  
   • `getLatestTokensPercent()` – scans a node’s `assistantItems` backwards to find the most recent `tokens.percent` value embedded in a `tool_result` item.  
   • `formatPercentLabel()` – pretty-prints the percentage.

2. UI changes inside `<RightSidebar>`  
   • For LLM nodes the newest `tokens.percent` value is shown (e.g. `53.2 %`) beside the **Run-from-here** button.  
   • Minor DOM restructuring to keep the new label and button in a flex container.  

No other files are modified.

## Tour of changes  
Start with the new helper functions at the top of the diff (lines 10-34). Understanding how the percentage is extracted clarifies the subsequent JSX changes (lines 558-588) that display the value. Once those helpers are understood, the JSX refactor is straightforward.

## File level review

### `workflow/Web/components/RightSidebar.tsx`

1. New helpers
   ```ts
   function getLatestTokensPercent(items: AssistantContentItem[]): number | null { … }
   ```
   • Walks the array from the end – correct and efficient because newest items are typically appended.  
   • Defensive JSON parsing is appreciated; errors are swallowed silently which is OK in UI code.  
   • Suggest clamping the return value to `[0, 100]` (or at least non-negative) to prevent bogus displays.  
   • Consider early bail-out if `items.length === 0`.

   ```ts
   function formatPercentLabel(p: number): string { … }
   ```
   • Rounds to two decimals, then strips trailing zeros. Works, but using `Intl.NumberFormat` would respect locales.  
   • The inserted space before `%` (`" %"` vs `"%"`) may not be wanted; confirm with design.  
   • No safety check for `NaN` input. Although the caller already checks `latestPercent != null`, adding `Number.isFinite(p)` guard would make the helper more robust.

2. JSX changes
   ```tsx
   {(() => { … })()}
   ```
   • The IIFE wrappers create a new function on every render; the same can be done with a plain block:
     ```tsx
     {
       /* open block */
       {
         …
       }
     }
     ```
     or by extracting to a small sub-component to make the tree cleaner and avoid the allocation.

   • Layout: `.tw-ml-auto tw-flex tw-items-center tw-gap-2` reforms the earlier right-aligned single element. Looks correct.

   • Conditional render checks:
     ```tsx
     node.type === NodeType.LLM && latestPercent != null
     ```
     Good – avoids showing an empty span.

   • Key attributes are not required because no array render is happening.

3. Performance considerations  
   • `getLatestTokensPercent` is executed on every render for every LLM node. If `assistantItems` can grow large, this could become expensive. Memoising by caching the last evaluated length/time or storing `latestPercent` alongside `assistantItems` when they are updated would save work.  
   • Alternatively preprocess `assistantItems` when they arrive.

4. Type safety  
   • `AssistantContentItem` is referenced but not imported in the snippet. If it comes from a global type declaration the build succeeds; otherwise add an explicit import.

5. Security / XSS  
   • Displayed value comes from parsed JSON numbers/strings → rendered as text in a `<span>`, not HTML → safe.

6. Accessibility  
   • Consider adding `title` or `aria-label` to the percentage span (e.g. “Token budget used”) for screen-reader clarity.

7. Tests  
   • No test changes. Adding unit tests for `getLatestTokensPercent` with edge cases (missing property, string value, invalid JSON) would help.

8. Miscellaneous  
   • Optional chaining `obj?.tokens?.percent` is good.  
   • You may wish to rename `p` to `percent` in `formatPercentLabel` for readability.

## Recommendations  
1. Import (or declare) `AssistantContentItem` explicitly.  
2. Add finite-number guard in `formatPercentLabel`, maybe return `"–"` on invalid input.  
3. Clamp percent to `[0, 100]` or at least `>= 0`.  
4. Replace the IIFE with a sub-component or plain conditional block.  
5. Memoise or cache `getLatestTokensPercent` for large histories.  
6. Add unit tests for both helper functions.  

Overall the change is small, clear, and unlikely to break existing behaviour; only minor cleanup and performance tweaks are suggested.