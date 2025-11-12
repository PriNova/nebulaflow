## High-level summary
The change introduces an in-place, modal text editor for CLI / Script nodes.

1. **PropertyEditor**
   • Adds a “CLI editor” modal identical in behaviour to the prompt / variable / input / condition editors.  
   • Opens the modal on double-click in the textarea and updates the node’s `content` on confirm.

2. **CLI_Node**
   • Enables double-click editing directly on the node in the canvas.  
   • Maintains a local `draft` state, shows `TextEditorModal` when `data.isEditing === true`, and communicates editing actions (`start`, `commit`, `cancel`) through a `nebula-edit-node` CustomEvent.

No back-end, types, or test changes were included.

---

## Tour of changes
Begin with `workflow/Web/components/nodes/CLI_Node.tsx`.  
It is the source of the new editing workflow (dispatching custom events, showing the modal). Understanding this file clarifies how the UI enters the *editing* state that the PropertyEditor now respects.

After that, review `PropertyEditor.tsx`, which merely consumes the same modal component but is more boiler-plate and mirrors existing patterns.

---

## File level review

### `workflow/Web/components/nodes/CLI_Node.tsx`

Changes
• Imports `useCallback`, `useState`, and `TextEditorModal`.  
• Declares `draft` state synchronised with `data.content` when editing starts.  
• Adds `dispatchEditEvent` helper sending `{id, action, content?}` as `nebula-edit-node` CustomEvents.  
• The root `<div>` now has `onDoubleClick={handleBodyDoubleClick}` to request `start` editing.  
• Renders `TextEditorModal` when `data.isEditing === true`, and on confirm/cancel dispatches `commit` / `cancel`.

Review
1. Correctness  
   a. `useEffect` sets `draft` only when `data.isEditing` toggles to true – good.  
   b. `dispatchEditEvent` leaks neither closure nor stale props; dependencies are fine (`[id]`).  
   c. On commit, only the event is dispatched; the modal is closed by external state change (parent should set `isEditing=false`). Make sure such listener exists, otherwise the modal will remain open.

2. Possible bugs / edge-cases  
   • If the parent does not update `data.content` before flipping `isEditing` to `false`, the node will briefly show stale text. Consider optimistic update (`setDraft('')`) after commit.  
   • The component relies on the presence of the boolean flag on `data`. If a consumer accidentally sets `isEditing` to `''` or `null`, the modal will not open/close – validate prop types if possible.  
   • `onDoubleClick` is attached to the entire body, but not to the handles/top-bar; good choice but verify it does not conflict with drag behaviour in xyflow.

3. Performance  
   • `dispatchEditEvent` constructs a new object for every commit/start/cancel; negligible.  
   • No unnecessary re-renders; `useCallback` memoizes the dispatcher.

4. Security  
   • No user-provided content is executed; only displayed in a modal. Standard XSS rules of React apply.

5. Typing  
   • `payload?: any` is loose. If you are already in TypeScript, consider an explicit interface:
     ```ts
     type EditPayload = { content: string };
     ```
   • `data.isEditing` is typed as `any`; define in `BaseNodeData` to avoid casts.

Suggestions
• Clear `draft` after `commit`/`cancel` to prevent showing old text when reopened.
• Add keyboard shortcut (e.g., Ctrl+Enter) to commit from the modal for better UX.

---

### `workflow/Web/components/PropertyEditor.tsx`

Changes
• Adds `isCliEditorOpen` and `cliDraft` state.  
• Resets both in `useEffect` when a new node is selected.  
• On double-click inside the textarea (for both script and command modes) opens the modal.  
• Renders a `TextEditorModal` identical to the one used elsewhere.

Review
1. Correctness  
   • State reset effect correctly includes `node.id` dependency.  
   • `onDoubleClick` handler derives draft from `node.data.content || ''` – safe.  
   • `onConfirm` updates `content` via `onUpdate` and closes the modal – same pattern as others.

2. Possible bugs  
   • The `placeholder` mentions positional inputs but not environment variables – minor UX.  
   • Duplicate code for the two textareas (`script` vs `command`). Could be factored into a small component.

3. Performance / UX  
   • Double-click may conflict with text selection. A visible “edit” icon may be clearer, but behaviour is consistent with existing editors.  
   • Consider opening the modal automatically for multi-line content to avoid editing inside a cramped `<textarea>`.

4. Typing  
   • `onChange={(e) => onUpdate(...)}` uses `any`. Can be typed as `React.ChangeEvent<HTMLTextAreaElement>`.

---

## Overall notes & recommendations
• The feature is consistent with the existing editor experience and uses the shared `TextEditorModal` component, keeping UI uniform.  
• Ensure there is a global listener that consumes `nebula-edit-node` events, mutates the node data, and toggles `isEditing`, otherwise the CLI_Node modal may not close.  
• Add unit / integration tests:  
  – Double-click ▶️ dispatches `start` and opens modal.  
  – Confirm ▶️ dispatches `commit` with correct payload and closes modal.  
  – Cancel ▶️ dispatches `cancel`.  
• Refactor the duplicated textarea blocks in `PropertyEditor` to reduce maintenance cost.