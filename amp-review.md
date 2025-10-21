## High-level summary
This patch introduces user-approval handling for “blocked-on-user” tool invocations emitted by an LLM node.

Key points
• `ExecuteWorkflow.ts`:  
  – `executeLLMNode` now receives an `approvalHandler` callback.  
  – While streaming LLM output it detects `tool_result` blocks with status `blocked-on-user`, notifies the web-view, waits for an approval / rejection decision, and responds back to the LLM with a `toolInput` message.  
• `RightSidebar.tsx`:  
  – UI generalized: the Approve / Reject buttons are shown for *any* node awaiting approval (not just CLI nodes).  
  – The command-editing textarea remains read-only unless the node is both a CLI node **and** is currently awaiting approval.  
  – When approving a non-CLI node, no modified command payload is sent.

No other files are touched.

## Tour of changes
Start with `workflow/Application/handlers/ExecuteWorkflow.ts`. That is where the new approval logic is implemented and where the public function signature changes. Understanding this change makes the corresponding UI tweaks in `RightSidebar.tsx` self-explanatory.

## File level review

### `workflow/Application/handlers/ExecuteWorkflow.ts`

1. Public surface
   • `executeWorkflow` forwards `approvalHandler` to `executeLLMNode`.  
   • Any other caller of `executeLLMNode` must now provide the extra parameter—make sure all call-sites have been updated (only this file is shown in the diff).

2. Function signature
```ts
async function executeLLMNode(
   ...
   webview: vscode.Webview,
   approvalHandler: (nodeId: string) => Promise<ApprovalResult>
): Promise<string>
```
   • Consider making `approvalHandler` optional (e.g. `?.()`) so existing extensions can compile even if they do not need approvals.  
   • Type `ApprovalResult` is referenced but not imported; compilation depends on it being in scope elsewhere.

3. Streaming loop
```ts
const handledBlocked = new Set<string>()
for await (const event of amp.runJSONL({ prompt })) {
```
   • `handledBlocked` prevents duplicate approval prompts—good.  
   • However, if an approval for the same `toolUseID` is rejected and the LLM re-emits *another* blocked-on-user with the same ID, the prompt will be skipped. Expected? If not, include status (accept/reject) in the dedupe key.

4. Detection logic
   • Scans the whole thread every token. This is O(N²) over time. You can optimise by:
     – Keeping an index of already-seen message IDs.  
     – Only processing the last assistant / user messages delivered in the current event.

5. Use of optional chaining
   • `thread?.messages?.findLast` – Node 18+ and Chromium have `Array.prototype.findLast` but many runtimes don’t. If the workflow framework targets earlier environments, replace with a manual loop.

6. Error handling
```ts
} catch (e) {
   if (e instanceof AbortedError) throw e
}
```
   • Good that an abort propagates.  
   • All other exceptions are swallowed; add logging so silent failures are diagnosable (`console.error` or telemetry).

7. Awaiting approval
```ts
const decision = await approvalHandler(node.id)
```
   • No timeout. If the UI disappears the LLM node can hang forever. Consider:
     – Passing the original `AbortSignal` to `approvalHandler`.  
     – Applying an explicit timeout and rejecting with AbortedError.

8. Sending the decision
```ts
await amp.sendToolInput({ value: { accepted } })
```
   • If the CLI command was modified, the new command is *not* forwarded. Make sure the LLM expects only the boolean.

9. Concurrency / re-entrancy
   • The for-await stream continues while awaiting approval (no `break` or pause). This can lead to interleaving new events. You might want to block reading until the decision is processed by pausing the iterator (create deferred promise and await).

### `workflow/Web/components/RightSidebar.tsx`

1. Read-only state
```tsx
readOnly={!(node.type === NodeType.CLI && node.id === pendingApprovalNodeId)}
```
   • Works, but can be simplified to `readOnly={node.id !== pendingApprovalNodeId || node.type !== NodeType.CLI}`.

2. Approval buttons
   • Buttons now always rendered when `node.id === pendingApprovalNodeId`. Nice generalisation.

3. `onApprove` call
```tsx
onApprove(
   node.id,
   true,
   node.type === NodeType.CLI ? modifiedCommands.get(node.id) : undefined
)
```
   • Safe. Consider passing an explicit `null` instead of `undefined` to avoid 3-argument overloading confusion.

4. Accessibility
   • Buttons should include `aria-label` (“Approve”, “Reject”).

5. Styling
   • Inline style strings rely on VS Code theme variables—fine.

6. Minor
   • Remove unused import of `NodeType` if not already present.

### Files not shown

• Ensure `approvalHandler` hook is implemented in the VS Code extension host and wired to the web-view message coming from `RightSidebar`.  
• Ensure types `ApprovalResult`, `ExtensionToWorkflow` and `AbortedError` are exported in public APIs.

## Security / correctness checklist

☑️ No obvious injection vectors (inputs are displayed, not executed, in the webview).  
⚠️ Potential denial-of-service: infinite wait for approval (see timeout suggestion).  
⚠️ Race: stream continues while waiting; ensure LLM can handle out-of-order `toolInput` messages.  
☑️ Prevents duplicate prompts via `handledBlocked` (verify logic with rejection loop).  
☑️ UI prevents command editing for non-CLI nodes.

## Recommendations

1. Make `approvalHandler` optional or audit every call-site.  
2. Add timeout / abort handling when waiting for user approval.  
3. Optimise scan of `thread.messages` to avoid per-token O(N²) cost.  
4. Consider logging non-abort exceptions in the approval flow.  
5. Verify target runtimes support `findLast`, or polyfill.

Overall the change is well-structured and introduces the feature with minimal surface area. Addressing the points above will improve robustness and performance.