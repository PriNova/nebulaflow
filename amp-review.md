## High-level summary
This patch tightens the safety guarantees around the “Dangerously allow all commands” flag in the workflow LLM node:

1.	Backend (ExecuteWorkflow.ts)  
	•	Introduces a helper that detects whether the **Bash** tool is disabled.  
	•	Ignores/strips the `dangerouslyAllowAll` flag when Bash is not available, adds a debug log, and only auto-approves commands when both conditions (flag + Bash enabled) are met.

2.	Frontend (PropertyEditor.tsx)  
	•	UI disables, strikes through, and tool-tips the “Dangerously allow all commands” checkbox when Bash is disabled.  
	•	Automatically resets `dangerouslyAllowAll` to `false` if the user disables Bash.

3.	Tool helper (toolNames.ts)  
	•	New `isToolEnabled()` utility.

Overall, the change closes a security foot-gun (enabling unrestricted command execution without an execution tool present) and brings UI/UX in line with backend enforcement.

## Tour of changes
Start with `workflow/Application/handlers/ExecuteWorkflow.ts`.  
It contains the authoritative logic that now conditions the “allow all” flow on Bash availability; understanding this explains every other modification (UI updates, helper utilities, etc.).

## File level review

### `workflow/Application/handlers/ExecuteWorkflow.ts`
Changes
•	Line 14-17: Added `isBashDisabled()` helper.  
•	Lines 386-397:  
	–	Derives `bashDisabled` and `shouldApplyAllowAll`.  
	–	Logs a debug message if user tries `dangerouslyAllowAll` while Bash is disabled.  
•	Lines 401-411: Passes `shouldApplyAllowAll` (not the raw flag) into AMP settings.  
•	Lines 454-458: Re-uses `shouldApplyAllowAll` in the command-auto-approval block.

Review
1.	Correctness & safety  
	✓ Logic guarantees we never set the “allow all” setting when Bash is disabled—good.  
	✓ Debug message helps observability.

2.	Edge cases  
	• `isBashDisabled()` naïvely checks `.includes('Bash')`. If the user disables Bash via an alias (e.g. `"bash"`, `"Shell"`), the helper will miss it even though the backend will still block the tool. Prefer:
	```ts
	import { resolveToolName } from '.../toolNames'
	function isBashDisabled(disabledTools: string[] | undefined): boolean {
	    const resolved = resolveToolName('Bash')
	    return (disabledTools ?? []).some(d => resolveToolName(d) === resolved)
	}
	```
	• Consider `disabledTools` containing mixed-case values—current check is case-sensitive.

3.	Performance: negligible.

4.	Security: Improves posture; no new risks introduced.

### `workflow/Web/components/PropertyEditor.tsx`
Changes
•	Imports `isToolEnabled`.  
•	Wraps the “Dangerously allow all commands” checkbox in an IIFE that:  
	–	Disables the checkbox when Bash is not available.  
	–	Strikes through label & adds tooltip.  
•	In tool list toggle handler, if the user disables Bash it automatically clears `dangerouslyAllowAll`.

Review
1.	UX  
	✓ State of checkbox now matches backend capability; reduces user confusion.  
	✓ Tooltip is a nice accessibility touch.

2.	Correctness  
	• When Bash is re-enabled, `dangerouslyAllowAll` remains `false`; user must manually re-enable it—sensible default.

3.	Performance  
	• Inline IIFE re-creates logic each render; not problematic but could be a small `useMemo`.

4.	Type safety  
	✓ Uses `Partial<(typeof node)['data']>`; good.  
	• `disabledTools` default should be `[]` to avoid `undefined` handling in multiple places; small nit.

5.	Edge cases  
	• Checkbox `disabled` prop prevents user interaction, but `onCheckedChange` guard (`if (isBashAvailable)`) is still advisable—already present.

### `workflow/Web/services/toolNames.ts`
Changes
•	Adds `isToolEnabled()` which resolves aliases then checks absence in `disabledTools`.

Review
✓ Simple, correct, and already consumed by UI.

Minor suggestion
• Export `resolveToolName` & `isToolEnabled` from same module—already done.

## Recommendations
1.	Alias handling: Replace the raw `.includes('Bash')` comparison in backend with alias-aware logic; otherwise UI (which is alias-aware) and backend can diverge.  
2.	Case-insensitive checks for tool names across the codebase.  
3.	Optional: memoise `isBashAvailable` calculation in `PropertyEditor` (`useMemo`).  
4.	Add unit tests for:
	• `isBashDisabled` with aliases.  
	• Interaction: Disabling Bash auto-clears `dangerouslyAllowAll`.

Overall, the patch is well-structured, fixes a real security hole, and keeps UI in sync with backend rules.