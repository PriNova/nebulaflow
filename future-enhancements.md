# Future Enhancements

Recommended improvements and optimizations for future implementation.

## Pending Enhancements

### CLI Node - Executor Options Type Safety
- **Goal**: Improve extensibility and maintainability of the shell executor interface
- **What**: Type the executor options parameter as `Pick<ExecOptions, 'cwd'>` instead of a loose object type
- **Why**: Provides explicit, typed contract for what executor options are supported, making future extensions (e.g., timeout, env vars) safer and clearer for contributors
- **Priority**: P1 (nice-to-have; improves type safety and future extensibility)

### CLI Node - Multi-root Workspace Handling
- **Goal**: Make CLI node behavior configurable for workspaces with multiple root folders
- **What**: Extend cwd selection beyond hardcoded index 0; consider UI picker or active resource detection
- **Why**: Currently always uses the first workspace folder. In multi-root setups, users may want to target a specific folder or the folder containing their active file
- **Priority**: P2 (optional enhancement; improves UX for multi-root workspace users)

### CLI Node - Missing Workspace UX
- **Goal**: Clarify user intent when no workspace is open
- **What**: Consider prompting users to open a folder when CLI node is executed without an active workspace, rather than silently falling back to extension directory
- **Why**: Running commands in the extension process directory can be confusing and lead to failed commands. Explicit prompt surfaces the issue and guides correct setup
- **Priority**: P2 (UX improvement; helps users avoid setup confusion)

### Window Title - Conditional URI in Protocol Message
- **Goal**: Reduce redundant data transmission when workflow filename is already known to the webview
- **What**: Only include workflow URI in the `workflow_loaded` protocol message when the file path information is necessary for the webview consumer
- **Why**: Currently, the URI is always sent even though the webview primarily uses it to trigger title updates via the existing panel title mechanism. Conditional passing reduces message payload and clarifies data flow semantics.
- **Priority**: P1 (nice-to-have; improves protocol clarity without affecting current functionality)

### Window Title - Extract Title Prefix Constant
- **Goal**: Improve maintainability and consistency of the NebulaFlow title prefix
- **What**: Extract the "NebulaFlow" prefix string into a shared constant (e.g., `NEBULA_FLOW_TITLE_PREFIX`) in the register.ts or a dedicated constants module
- **Why**: Centralizes the title prefix definition, reducing the risk of inconsistent text across save/load/create operations and making future branding changes easier.
- **Priority**: P2 (code quality; improves maintainability for future changes)

### Window Title - External File Rename Handling
- **Goal**: Maintain accurate window titles when workflows are renamed or moved outside the editor
- **What**: Detect when a loaded workflow file has been renamed or moved externally, and either update the title accordingly or prompt the user to re-save
- **Why**: If a user renames a workflow file outside the editor, the title would become stale, potentially causing confusion when managing multiple files.
- **Priority**: P2 (optional enhancement; edge case handling for better user experience)

### Right Sidebar State Reset - Optional `executionRunId` Prop
- **Goal**: Improve ergonomics for `Flow` and `RightSidebar` components when used outside the `useWorkflowExecution` hook (e.g., tests, stories)
- **What**: Make `executionRunId` prop optional in `Flow` and `RightSidebar` components with sensible defaults
- **Why**: External consumers (test suites, Storybook stories) may not have access to `useWorkflowExecution` hook state, causing prop drilling complexity. Optional prop with default value simplifies integration.
- **Priority**: P2 (nice-to-have, improves developer experience for edge cases)

### Right Sidebar State Reset - Documentation of `executionRunId` Semantics
- **Goal**: Clarify the initialization and batching behavior of the `executionRunId` reset mechanism
- **What**: Add code comment or inline documentation explaining:
- Why `executionRunId` is initialized to 0 on first mount
- How React batching affects the order of reset effects vs. message posting
- Why the reset effect checks `executionRunId > 0` before triggering
- **Why**: Future maintainers and contributors need clear understanding of the state management pattern to safely modify or extend the reset logic.
- **Priority**: P1 (improves maintainability; consider implementing alongside any follow-up fixes)

### LLM Node Reasoning Effort - Type Safety Improvements
- **Goal**: Remove type assertions and improve type safety in reasoning effort implementation
- **What**: 
   - Extract `ReasoningEffort` type to a shared constant module (e.g., `Core/Constants` or `Shared/Types`)
   - Remove `as any` casts in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/PropertyEditor.tsx#L318) and [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L397)
   - Update PropertyEditor and ExecuteWorkflow to import and use the shared type
- **Why**: Eliminates unnecessary type assertions, reduces literal duplication across files, and improves maintainability by having a single source of truth for valid reasoning effort values.
- **Priority**: P1 (nice-to-have; improves code clarity and type safety)

### LLM Node Reasoning Effort - Server Expectation Confirmation
- **Goal**: Validate server-side behavior for reasoning effort defaults
- **What**: Confirm with Amp SDK that it correctly handles the `reasoning.effort` = "medium" default now being sent unconditionally from ExecuteWorkflow.ts on every LLM node execution
- **Why**: Backend now always sets `reasoning.effort` to "medium" as fallback when value is missing or invalid. Server behavior should be validated to ensure no regressions or unexpected interaction with SDK's internal defaults
- **Priority**: P1 (verification step; ensures backend contract alignment)

### LLM Node Reasoning Effort - Performance Optimization
- **Goal**: Avoid unnecessary object allocations during workflow execution
- **What**: Hoist `validReasoningEfforts` validation set to module scope in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L392-L396) to prevent re-allocation on each LLM node execution
- **Why**: Currently creates a new Set on every LLM node execution, allocating memory repeatedly for an immutable set of valid values
- **Priority**: P3 (optimization; good-to-have for performance polish)

### LLM Node Reasoning Effort - Accessibility and Performance Polish
- **Goal**: Enhance accessibility and performance of reasoning effort button group
- **What**:
- Add `aria-pressed` attribute to reasoning effort buttons in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/PropertyEditor.tsx#L312-L329) for screen reader users
- Replace `console.log` with `console.debug` in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L368-L369) to reduce log noise
- **Why**: Improves semantic HTML and screen reader support; reduces log verbosity during workflow execution.
- **Priority**: P2 (optimization and polish; good-to-have for production quality)

### Preview Node - Remove Unused Parameter
- **Goal**: Clean up dead code in preview content computation
- **What**: Remove unused `previewNode` parameter from `computePreviewContent()` function in [messageHandling.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/hooks/messageHandling.ts#L34-L39)
- **Why**: Parameter was intended for potential future use but is not accessed in the current implementation; removing it reduces cognitive load and clarifies intent
- **Priority**: P2 (code quality; trivial cleanup)

### Preview Node - Multi-hop Content Propagation
- **Goal**: Extend preview updates to transitive chains of preview nodes
- **What**: Enhance `getDownstreamPreviewNodes()` and the `node_execution_status` handler to recursively update preview nodes connected to other preview nodes (A → Preview1 → Preview2 chain)
- **Why**: Currently only direct previews connected to completed nodes are updated. Multi-hop chains would be blank until the intervening preview executes, limiting preview utility in complex workflows
- **Priority**: P2 (optional enhancement; improves preview coverage for advanced workflows)

### LLM Node Dangerously Allow All - Documentation and Tests
- **Goal**: Improve maintainability and reliability of the dangerously allow all commands feature
- **What**: 
  - Update documentation/labels explaining that "dangerously allow all" auto-approves all blocked commands regardless of SDK `toAllow` enumeration
  - Add unit and integration tests covering auto-approval scenarios with and without `toAllow` arrays
  - Document failure modes and observability hooks (audit logging) in feature documentation
- **Why**: The feature behavior now unconditionally auto-approves when enabled; documenting this intent and testing both paths ensures future maintainers understand the design and can safely refactor without regressions
- **Priority**: P2 (quality assurance; improves test coverage and clarity for future changes)

### LLM Node Default Model - Unit Test Coverage
- **Goal**: Add test coverage for default model assignment during node creation and workflow loading
- **What**: Create unit tests asserting that new LLM nodes receive Sonnet 4.5 as default model and that legacy workflows without models are normalized correctly on load
- **Why**: Ensures default model behavior is validated and protected against future regressions; complements the existing migration logic
- **Priority**: P2 (quality assurance; improves confidence in default model behavior)
