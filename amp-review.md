## High-level summary
* Removes the dependency on `@sourcegraph/amp-sdk` for tool-name helpers and replaces it with an in-repo service (`workflow/Web/services/toolNames.ts`).  
* Introduces two helper functions (`getAllToolNames`, `resolveToolName`) and two constant maps (`BUILTIN_TOOL_NAMES`, `TOOL_NAME_ALIASES`).
* Updates UI for enabling/disabling tools in `PropertyEditor.tsx`:  
  – Checkboxes laid out in a grid are replaced with pill-style toggle buttons laid out in a flex wrap.  
  – Internal state logic is adapted accordingly (`enabled` vs `disabled`).
* Minor import change in `RightSidebar.tsx` to use the new helpers.

No database, network, or back-end mutations were introduced. All changes sit in the front-end and a pure utility module.

---

## Tour of changes
Start with the **new utility module** (`services/toolNames.ts`). Understanding the available tool names and alias-resolution logic clarifies the follow-on UI changes and the new imports in both React components.  
Once familiar with the helper, review `PropertyEditor.tsx`; this file contains the substantive UI/behavioral change.  
Finish with the small import tweak in `RightSidebar.tsx`.

---

## File level review

### `workflow/Web/services/toolNames.ts`
Changes  
• New file exporting a canonical list of tool names (`BUILTIN_TOOL_NAMES`) and a map of aliases (`TOOL_NAME_ALIASES`).  
• `getAllToolNames()` returns all canonical names (array).  
• `resolveToolName()` takes an alias or name and returns a canonical name or `undefined`.

Review  
1. Correctness / Types  
   * `BUILTIN_TOOL_NAMES` is declared `as const`, so `Object.values` returns `readonly string[]`, good.  
   * `includes(nameOrAlias as any)` uses an `any` cast to silence TS. Better:  
     ```ts
     if ((Object.values(BUILTIN_TOOL_NAMES) as string[]).includes(nameOrAlias))
     ```  
     That avoids an escape hatch and maintains type safety.

2. Case-sensitivity  
   * The alias lookup is strictly case-sensitive. `resolveToolName('grep')` works via the alias map, but `'GREP'` or `'Grep '` (trailing space) will not. Consider normalising (`trim().toLowerCase()`) for resiliency.

3. Duplicates  
   * No duplicate keys, but there are keys whose *values* equal other keys (e.g. `'Grep'` in both maps). That is fine but a quick test would be helpful.

4. Ordering  
   * `getAllToolNames()` returns `Object.values`, which is insertion-order. If a stable sort is important for UI consistency (esp. snapshot tests), sort alphabetically.

5. Extensibility  
   * If new tools are added, devs must update two places (constants + alias map). Could derive the default alias map automatically (e.g. each canonical name is its own alias) to reduce drift.

6. Security  
   * Pure data, no security surface.

### `workflow/Web/components/PropertyEditor.tsx`
Changes  
• Import switched to local helper.  
• UI re-worked:
  – grid → flex-wrap  
  – checkbox → toggle `Button` chips  
  – visual states: `variant="secondary"` when enabled, `variant="outline"` when disabled; disabled state is also shown by strike-through.  
• Logic reshuffled (`enabled` vs `isDisabled`).

Review  
1. State inversion logic  
   ```ts
   const isDisabled = disabled.includes(tool)
   const enabled = !isDisabled
   ...
   onClick={() => onToggle(tool, !enabled)}
   ```
   `onToggle` expects `(tool, enabledAfterClick)`. The call supplies the *negation* of current `enabled`, which is correct.

2. Mutation handling  
   * `onToggle` builds `next` via `new Set(disabled)`. Good: avoids mutating props.  
   * Edge-case: if parent passes an *immutable frozen* array, still safe.

3. Rendering performance  
   * `getAllToolNames()` is executed on every render. If this turns into a large list (> few hundred) or render heavy, memoise with `useMemo`. Currently negligible.

4. Accessibility  
   * `aria-pressed` is set; good.  
   * Each toggle is a `<button>` now, so no more `<label>` that referenced a checkbox. Fine.  
   * No `role="switch"` is necessary because `aria-pressed` already conveys toggle state.

5. Keyboard navigation  
   * Buttons are focusable by default; check styling for focus ring.

6. Visual consistency  
   * Tailwind classes rely on design tokens; confirm that `Button` component doesn’t strip them.  
   * `tw-h-6 tw-py-0` can create vertical centering issues if the component itself applies its own padding.

7. Removed grid  
   * Flex wrap may re-flow unpredictably with very long tool names; small overflow/ellipsis mitigation is applied (`tw-max-w-full tw-overflow-hidden`). Good.

8. Minor nit  
   * Variable shadowing: `disabled` (array) vs `isDisabled` (boolean) is clear; previously `checked` vs `isDisabled` was more explicit. Current naming is still acceptable.

### `workflow/Web/components/RightSidebar.tsx`
Changes  
• Only import path updated.

Review  
• No functional change. Compiles? Yes, because `resolveToolName` is re-exported.  
• Confirm there are no tree-shaking issues; local module is part of bundle.

---

## Recommendations
1. Type safety: replace `as any` cast in `services/toolNames.ts` with a typed alternative.  
2. Normalise input in `resolveToolName()` (`trim().toLowerCase()`) to make alias matching forgiving.  
3. Consider alphabetical sort in `getAllToolNames()` for stable UI order.  
4. Optional perf: wrap `const toolNames = useMemo(getAllToolNames, [])` inside `PropertyEditor` if list becomes large.  
5. Add unit tests for `resolveToolName` to guard against alias drift and case issues.