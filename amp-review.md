## High-level summary  
The patch is a type-system & data-plumbing update that gives the CLI workflow node first-class support all the way from the shared `Core` model to the web-view serializer:

1. `workflow/Core/models.ts`  
   • Adds a rich `CLINodeConfig` description object.  
   • Introduces `CLINode` interface that narrows `WorkflowNode` to `type: NodeType.CLI`.

2. `workflow/Web/components/hooks/workflowActions.ts`  
   • Refactors the “save workflow” action to build a strictly typed `WorkflowPayloadDTO`, converting every node via the new `toWorkflowNodeDTO` helper.

3. `workflow/Web/components/nodes/CLI_Node.tsx`  
   • Local helper type no longer contains the ad-hoc `shouldAbort` flag, aligning it with the new model.

4. A new SDK tarball is committed (`vendor/amp-sdk/amp-sdk.tgz`), and the Markdown review file is updated.  
   No runtime behaviour changes are introduced; all edits are compile-time or serialization-time only.

## Tour of changes  
Begin with `workflow/Core/models.ts`.  
Understanding the new `CLINodeConfig` and `CLINode` contracts clarifies every downstream edit: the web serializer (`workflowActions.ts`) merely adapts code to those contracts, and the React component’s type tweak (`CLI_Node.tsx`) removes a now-invalid field.

## File level review  

### `workflow/Core/models.ts`  
Changes  
• Adds `CLINodeConfig` (fully optional, ~30 fields).  
• Adds `CLINode` that extends `WorkflowNode` and uses the config.  

Review  
1. Optional-everything – A completely empty CLI node now type-checks. If the backend requires at least a `mode` or `shell`, make those fields mandatory or supply defaults during execution.  
2. Better discrimination – `stdin.parentIndex` is only valid when `source === 'parent-index'`. A discriminated union would prevent illegal combinations:  
   ```ts
   stdin:
     | { source: 'none' }
     | { source: 'parent-index'; parentIndex: number }
     | { source: 'literal'; literal: string; stripCodeFences?: boolean }
     | …
   ```  
3. Enum alignment – Verify that `NodeType.CLI` already exists in the shared enum; otherwise the new interface will not compile.  
4. Platform-specific flags – `executionPolicyBypass` is PowerShell-only, while `pipefail` is bash/zsh-only. Consider comments or sub-objects to keep the intent clear.  
5. Solidity of `CLINode` – If `WorkflowNode` is a discriminated union elsewhere, remember to add `CLINode` to that union so switch statements stay exhaustive.

### `workflow/Web/components/hooks/workflowActions.ts`  
Changes  
• Imports the DTO types and `toWorkflowNodeDTO`.  
• Builds `workflowData` with explicit typing and maps nodes/edges to serialisable DTOs.  

Review  
1. Correctness – Mapping of edges is faithful. The `?? undefined` conversions are redundant because `JSON.stringify` ignores `undefined`, but they do no harm.  
2. Performance – Added O(n) mapping per save; negligible for typical graph sizes.  
3. Type safety – The new explicit `WorkflowPayloadDTO` cast will flag mistakes in `toWorkflowNodeDTO` at compile time. Good upgrade.  
4. Dependency list – Hook memo still depends on `nodes, edges, nodeResults, ifElseDecisions, vscodeAPI` exactly as before. ✅  
5. Availability – Ensure `toWorkflowNodeDTO` is exported from `../../utils/nodeDto`; otherwise compilation will break.

### `workflow/Web/components/nodes/CLI_Node.tsx`  
Changes  
• Local helper type `CLINode` loses `data.shouldAbort`.  

Review  
1. Repository-wide search – If any code still reads or writes `node.data.shouldAbort`, it will now be `undefined` at runtime and a compile error (good early warning). Remove dead usages.  
2. Alignment – The new local type matches `Core`’s definition, reducing drift.  
3. No functional UI changes – Rendering logic is untouched, so runtime is stable.

### `vendor/amp-sdk/amp-sdk.tgz`  
Binary updated; without the tarball diff we cannot inspect. Make sure the package-lock / yarn.lock stays in sync and that the bump is intentional.

### `amp-review.md`  
Only documentation-level edits; no runtime impact.

## Recommendations  

1. Tighten `CLINodeConfig`  
   • Make at least `mode` and `shell` required, or supply defaults when executing.  
   • Use discriminated unions for mutually-exclusive fields (`stdin`, maybe `flags`).  

2. Confirm enum & union integration  
   • `NodeType.CLI` must be in the enum.  
   • Add `CLINode` to any `WorkflowNodes` / `WorkflowNodeUnion` definitions.  

3. Clean up serializer  
   • Drop the `?? undefined` noise in edge mapping (cosmetic).  

4. Purge `shouldAbort` references  
   • Run a project-wide search to delete or refactor callers.

5. (Optional) Document platform-specific options in `flags` to avoid confusion.

With these small refinements, the type-level addition should be robust and future-proof.