## High-level summary
This patch introduces the concept of a “bypass” state for workflow nodes.  
Main work:

* Adds `bypass?: boolean` to `BaseNodeProps.data`.
* Extends `getNodeStyle` (Nodes.tsx) to:
  * Accept the new `bypass` flag.
  * Accept an optional `defaultBorderStyle` so special nodes (Loop Start/End) can keep their double border without post-merge overrides.
  * Render bypass nodes with a dashed border and 0.7 opacity.
* Updates every node component to forward `data.bypass` into `getNodeStyle`.
* Refactors Loop Start / Loop End nodes to rely on the new `defaultBorderStyle` argument instead of manual `borderStyle: 'double'`.

No behaviour outside of styling is changed.

## Tour of changes
Begin with `workflow/Web/components/nodes/Nodes.tsx`.  
This is the only functional change; all other file edits simply propagate the new parameters or adjust to the refined API. Understanding `getNodeStyle` first makes the review of the individual node components trivial.

## File level review

### `workflow/Web/components/nodes/Nodes.tsx`
* API Changes  
  * `BaseNodeProps.data` gains `bypass?: boolean`. ✔︎ Type-safe.
  * `getNodeStyle` signature adds `bypass` and `defaultBorderStyle`.
    * Back-compat preserved by default values.
* Style logic
  * `styleForThisNode` decision:
    ```
    active === false ? defaultBorderStyle :
    bypass          ? 'dashed' :
                      defaultBorderStyle
    ```
    ‑ Correctly keeps double borders for Loop nodes even when inactive.
  * Opacity logic mirrors this (`0.4` inactive, `0.7` bypass, else `1`).
* Implementation details
  * Switched to a single `border` shorthand (`2px ${style} ${color}`) so width / style / color are always in sync – good.
  * Function now returns `as const` – helps TS inference for React style props.
* Potential issues
  1. `active` may be `undefined`; code treats it as “active”. Existing behaviour already relied on this—acceptable.
  2. `bypass` overrides opacity but keeps node clickable; if click-through dim was intended, consider pointer-events style addition.
  3. Lots of inline colours still rely on VS Code theme variables—safe.
  4. `defaultBorderStyle` literal union type is fine, but you could widen to `BorderStyle` from CSS to future-proof.

### `workflow/Web/components/nodes/Accumulator_Node.tsx`
… (and every other node except Loop Start/End)
* Only change is the extra argument in the `getNodeStyle` call:
  ```ts
  data.interrupted,
  data.bypass
  ```
  Correct ordering, compiles.

### `workflow/Web/components/nodes/LoopEnd_Node.tsx`
* Replaces object-spread + manual `borderStyle: 'double'` with:
  ```ts
  style={getNodeStyle(
      NodeType.LOOP_END,
      …,
      data.bypass,
      'double'
  )}
  ```
* Eliminates the earlier double spread bug-risk, cleaner.  
* Behaviour: inactive LoopEnd nodes with `active === false` keep double border (matches previous). Bypass LoopEnd nodes will turn dashed even though `defaultBorderStyle` is double (`styleForThisNode` branches on bypass only when active is not false) – this is correct per new semantics.

### `workflow/Web/components/nodes/LoopStart_Node.tsx`
* Identical refactor as LoopEnd.

### `workflow/Web/components/nodes/*_Node.tsx`
(Accumulator, CLI, IfElse, LLM, Preview, Text, Variable)
* Solely forwards `data.bypass` in the correct parameter position.  
* No other logic touched.

### Typings & compile safety
* All changed files compile if the codebase previously compiled; the new prop is optional.
* Ensure any other code that destructures `data` picks up `bypass` or declares rest props, otherwise TypeScript will not complain but runtime may read `undefined`.

### Security / performance
* No effect on runtime behaviour except extra prop propagation. Rendering cost is negligible.
* No injection risk; values end up in inline styles not CSS class names.

## Recommendations
1. Edge-case test matrix (active/inactive × bypass true/false × loop vs regular) to confirm intended visuals.
2. Consider a visual regression test if your pipeline supports it; styling bugs are subtle.
3. If bypass nodes should be non-interactive, also add `pointerEvents: 'none'` and/or cursor change.
4. Minor: export a small enum for border styles to avoid string literals scattered.

Overall the change is well-executed, minimally invasive, and easier to maintain than the previous manual overrides.