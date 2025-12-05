## High-level summary
The change introduces an optional `mode` hint (`'workflow' | 'single-node'`) to assistant-content events flowing between the extension process and the workflow webview.  
All type contracts, run-time guards, event emitters and consumers were updated accordingly.  
On the web side an additional normalisation step now removes the initial “user” message from assistant timelines before they are stored in component state.  
A pre-built vendor tarball (`amp-sdk.tgz`) was also replaced.

No API surface other than the optional `mode` field is affected, therefore existing producers/consumers continue to work.

## Tour of changes
Start with `workflow/Core/Contracts/Protocol.ts` – it explains the new `mode` property and sets the foundation for everything else.  
From there, the logical order is:

1. `workflow/Core/Contracts/guards.ts` – run-time gatekeeping for the new field.  
2. `workflow/WorkflowExecution/Application/node-runners/run-llm.ts` and `workflow/WorkflowExecution/Application/subflow/run-subflow.ts` – event emitters now populate `mode`.  
3. `workflow/Web/components/hooks/messageHandling.ts` – the consumer of the new events; also contains the “filter initial user message” logic.  

The vendor tarball is opaque and can be safely skipped during code review.

## File level review

### `workflow/Core/Contracts/Protocol.ts`
Changes  
• Added optional `mode?: 'workflow' | 'single-node'` to:
  - `NodeAssistantContentEvent.data`
  - `SubflowNodeAssistantContentEvent.data`

Review  
✓  The field is optional → backward compatible.  
✓  JSDoc clearly explains meaning.  
⚠  Consider promoting the literal union to a named type (`ExecutionMode`) to avoid repetition and future drift.

### `workflow/Core/Contracts/guards.ts`
Changes  
• Extended both `case 'node_assistant_content'` and `case 'subflow_node_assistant_content'` paths with an OR-chain validating the new `mode` values.

Review  
✓  Validation logic is correct and still short-circuits for `undefined`.  
✗  Repeated string literals – see suggestion above to reuse a shared `const executionModes = new Set(['workflow','single-node'])` or a type guard `isExecutionMode()` to centralise logic.  
✓  No performance or security concerns.

### `workflow/Web/components/hooks/messageHandling.ts`
Changes  
1. Imported `AssistantContentItem`.  
2. Added helper `filterInitialUserMessage()` to drop the first `user_message` item.  
3. Applied helper when processing both `node_assistant_content` and `subflow_node_assistant_content` events.

Review  
Logic  
• The helper searches for the *first* item whose `type === 'user_message'` and removes it (only that one).  
• Behaviour is gated by simple array length checks – fine.

Edge cases / bugs  
1. If the first user message is **not** at index 0 (e.g. assistant system message precedes it) the code still removes the *first* user message, not necessarily the “initial” one. Confirm the intended semantics.  
2. The helper is run every time new content arrives; if the sender already removed the user message, the consumer now removes the *next* user message, leading to message loss. Both sides must share the same contract – clarify in docstring or protocol comments.  
3. No memoisation is required – complexity is O(n) for small n.

Type safety  
✓  Correct use of `AssistantContentItem[]` for the helper return type.

Performance  
✓  Negligible.

### `workflow/WorkflowExecution/Application/node-runners/run-llm.ts`
Changes  
• When emitting `node_assistant_content`, now includes `mode`.

Review  
✓  Propagates the value already available in local scope.  
✓  No functional side-effects.  
›  Consider using an enum or constant for mode strings.

### `workflow/WorkflowExecution/Application/subflow/run-subflow.ts`
Changes  
• Forwards `mode` from inner node event to outer `subflow_node_assistant_content`.

Review  
✓  Ensures the hint is preserved through the subflow layer.  
✓  Correctly uses spread pattern; types align.

### `vendor/amp-sdk/amp-sdk.tgz`
Binary replacement – cannot be reviewed here. Ensure checksum verification and licence compliance outside of code review.

## Overall assessment
The change set is small, coherent and backward compatible.  
The only risk is double-filtering of the initial user message; confirm the producer side does **not** perform a similar removal.  
Minor maintainability improvements (dedicated `ExecutionMode` type/guard) would reduce repetition.