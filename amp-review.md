## High-level summary  
A single file (`RightSidebar.tsx`) was updated.  
The change introduces a new helper `getAssistantDisplayItems()` that decides whether the *last* assistant “text” item should be hidden from the timeline when it is identical to the node’s final “Result”. The main render path for assistant messages now calls this helper instead of always showing all items.

## Tour of changes  
Start with the **new helper function** (`getAssistantDisplayItems`) because it contains the actual filtering logic; everything else is wiring this function into the existing render flow. Once that logic is understood, the small change in the render branch is trivial to follow.

## File level review

### `workflow/Web/components/sidebar/RightSidebar.tsx`

#### 1. New helper `getAssistantDisplayItems`

```ts
function getAssistantDisplayItems(
    items: AssistantContentItem[],
    options: { isExecuting: boolean; resultText: string | undefined }
): AssistantContentItem[] { … }
```

Correctness & edge-cases  
• Early exits (`isExecuting`, missing `resultText`) look fine.  
• `normalize` uses only `.trim()`. That will ignore leading/trailing whitespace but still require
  – identical casing  
  – identical internal whitespace (multiple spaces, newlines within the answer, etc.)  
  Depending on how `Result` is produced, this might be too strict (e.g., a trailing newline inside a
  fenced code block will break the match). Consider a more robust equality test (e.g., collapse all whitespace or a checksum that matches the input path).  
• The algorithm finds the *last* **text** item, not necessarily the last item overall.  
  If the last timeline item is a non-text block (e.g., code, image), but the penultimate is text that matches the result, we will still hide it. Is that intentional? If you want to hide *only if it is the very last item of any type*, filter should check `i === items.length - 1` as well.  
• Time complexity is O(n) but lists are tiny; fine.  
• The function is pure and does not mutate its inputs – good.  

Type safety  
• Uses `Extract<AssistantContentItem, { type: 'text' }>` to narrow the item type. 👍  
• The return type is correctly stated as `AssistantContentItem[]`.  

Performance  
• Will run on every render. Cost is negligible, but if items grow large, memoization could help.  

Naming / readability  
• Name clearly describes purpose; doc-comment is thorough.  

#### 2. Integration into render path

Old:

```ts
const displayItems = items
```

New:

```ts
const displayItems = getAssistantDisplayItems(items, {
    isExecuting: executingNodeIds.has(node.id),
    resultText: nodeResults.get(node.id),
})
```

Correctness  
• `executingNodeIds` and `nodeResults` pre-exist; arguments are passed correctly.  
• Behaviour while streaming (`isExecuting = true`) remains unchanged (always show).  

Potential UX issues  
• Users might find the answer “jumping” from the timeline to the Result panel abruptly when execution finishes. Consider an animation or placeholder to reduce jank.  

Other observations  
• `pairedMap` is still populated with the original `items` (not `displayItems`). If later logic
  relies on `pairedMap` and the removed text, this can lead to inconsistencies. Double-check where
  `pairedMap` is used; maybe it should iterate over `displayItems` as well.  

Security  
• No user-supplied HTML is inserted; filtering logic cannot introduce XSS. No new surface area.  

#### 3. Comments / documentation  
Good descriptive comments were added next to both the helper and its call-site, explaining the rationale.  

---

### Recommendations / possible improvements  
1. Robustness of equality check  
   ```ts
   const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
   ```  
   would ignore extra internal whitespace and casing differences.

2. Ensure we only hide if the matching text is truly the *last* item overall:  
   ```ts
   if (lastTextIndex !== items.length - 1) return items
   ```

3. Consider feeding `displayItems` (not `items`) into any subsequent processing to avoid hidden items re-appearing elsewhere (see `pairedMap`).

4. Minor optimisation: if `items.length === 0` return early.

Overall, the change is small, safe and improves UX, but verify the edge-cases above before merging.