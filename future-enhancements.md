# Future Enhancements

Recommended improvements and optimizations for future implementation.

## Pending Enhancements

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

### LLM Node Reasoning Effort - Accessibility and Performance Polish
- **Goal**: Enhance accessibility and performance of reasoning effort button group
- **What**:
   - Add `aria-pressed` attribute to reasoning effort buttons in [PropertyEditor.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/PropertyEditor.tsx#L312-L329) for screen reader users
   - Hoist `validReasoningEfforts` validation set to module scope in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L370-L375) to avoid re-allocation on each LLM node execution
   - Replace `console.log` with `console.debug` in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L368-L369) to reduce log noise
- **Why**: Improves semantic HTML and screen reader support; reduces unnecessary allocations and log verbosity during workflow execution.
- **Priority**: P2 (optimization and polish; good-to-have for production quality)
