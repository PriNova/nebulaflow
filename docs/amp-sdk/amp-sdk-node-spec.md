# Amp SDK Node – Spec and Implementation Plan (Iteration 1)

Goal

- Add execution for the existing LLM node to call Amp SDK with a single upstream text input and return the last assistant message as the node output.
- Keep it simple and extensible. No extra UI or settings in this iteration.

Scope (Iteration 1)

- Node type: reuse existing LLM node (no new node type).
- Inputs: first inbound text from parent nodes (typically a Text node). If missing, error.
- Output: plain text combined from the last assistant message.
- Errors: surface concise error messages for missing SDK, missing API key, or empty prompt.

Key Integration Points

- Webview node UI and registry: LLM node is already present and styled as “Amp Agent” in [LLM_Node.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/nodes/LLM_Node.tsx#L24-L75) and registered in [Nodes.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/nodes/Nodes.tsx#L207-L219). Node type values in webview are defined in [Nodes.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/nodes/Nodes.tsx#L16-L28) and mirrored for the extension in [models.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Core/models.ts#L11-L23).
- Workflow execution: add LLM execution in [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L88-L95) (currently emits “LLM unavailable”).
- Protocol: use existing execution status messages in [Protocol.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Core/Contracts/Protocol.ts#L115-L128) and overall execution lifecycle events.

Amp SDK References

- Usage: create an instance and run a prompt (returns last assistant message) per [sdk/README.md](file:///home/prinova/CodeProjects/upstreamAmp/sdk/README.md#L7-L19).
- API: `createAmp(options)`, `amp.run({ prompt })` returns `{ threadID, message }` per [create-amp.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/create-amp.ts#L108-L121) and [API-REFERENCE.md](file:///home/prinova/CodeProjects/upstreamAmp/sdk/API-REFERENCE.md#L231-L261).
- Message type: `ThreadAssistantMessage` contains `content` blocks that may be mixed; extract and join the `text` blocks.

Behavior Specification

- Compose prompt: use the first parent output string; trim it. If empty → error.
- Invoke SDK (bundled):
  - Use `createAmp` from the bundled `@sourcegraph/amp-sdk` (esbuild inlines the SDK; no runtime npm dependency). If the import fails at runtime, surface “Amp SDK unavailable (bundle)”.
  - Create with `{ apiKey: process.env.AMP_API_KEY, workspaceRoots: <opened workspace paths> }`. If `AMP_API_KEY` is missing → error.
  - Call `amp.run({ prompt })`; extract the last assistant message text.
  - Always `await amp.dispose()`.
- Result extraction: from `result.message.content`, gather `type === 'text'` blocks and join with `\n`, then `trim()`; use as node result.
- Events to webview: emit `node_execution_status` with `running`, then `completed` and `result` (or `error`).

Acceptance Criteria

- Given a Text node with content connected into an LLM node, when executing the workflow, the LLM node returns the last assistant message text produced by Amp and marks as completed.
- If SDK cannot be loaded or `AMP_API_KEY` isn’t set, LLM node reports an error and the workflow completes gracefully.
- No changes to webview UI or additional inputs this iteration.

Design Notes (Extensibility)

- Future inputs can map to SDK options (e.g., tool allow-list, `systemPrompt`, model, threads directory). These can be added to LLM node `data` and translated into `createAmp({ settings… })` without changing the basic execution flow.
- If multiple parent inputs are present, we can later support template replacement via existing `replaceIndexedInputs()`; for iteration 1 we only use the first input as the prompt.

Implementation Plan (Step-by-step)

1) Local dev + bundling strategy (use the linked local SDK, bundle it into the extension)
- Keep your existing `npm link` (or `pnpm link`) from `/home/prinova/CodeProjects/upstreamAmp/sdk` to `@sourcegraph/amp-sdk` for fast iteration. Ensure the SDK is built so `dist/index.cjs` exists.
- Add a minimal esbuild bundling step for the extension to inline the linked SDK into the shipped artifact (no runtime dependency on the link):
  - Add devDep: `esbuild`.
  - Add a small build script (e.g. `scripts/bundle-ext.mjs`) that bundles `src/extension.ts` → `dist/src/extension.js` with:
    - `platform: 'node'`, `format: 'cjs'`, `target: 'node20'`, `bundle: true`, `external: ['vscode']`.
    - This allows resolving the symlinked `@sourcegraph/amp-sdk` and bundling it (and its deps) directly into the extension output.
  - Update `package.json`:
    - Keep `typecheck` as-is (tsc, no emit).
    - Replace `build:ext` with the esbuild bundle script.
    - Keep webview build unchanged.
  - Result: dev uses the linked SDK; the packaged extension contains the SDK code (no separate install needed).

2) Implement LLM node execution in the extension
- Edit [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L88-L95): replace the current LLM branch with a call to a new `executeLLMNode` helper.
- Helper outline:

```ts
async function executeLLMNode(
  node: WorkflowNodes,
  webview: vscode.Webview,
  context: IndexedExecutionContext
): Promise<string> {
  const inputs = combineParentOutputsByConnectionOrder(node.id, context)
  const prompt = (inputs[0] || '').trim()
  if (!prompt) throw new Error('LLM Node requires a non-empty prompt from its upstream input')

  let createAmp: any
  try {
    ({ createAmp } = require('@sourcegraph/amp-sdk'))
  } catch {
    throw new Error('Amp SDK not available')
  }

  const apiKey = process.env.AMP_API_KEY
  if (!apiKey) throw new Error('AMP_API_KEY is not set')

  const workspaceRoots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath)
  const amp = await createAmp({ apiKey, workspaceRoots })
  try {
    const { message } = await amp.run({ prompt })
    const text = (message.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim()
    return text
  } finally {
    await amp.dispose()
  }
}
```

- Wire it into the switch:

```ts
case NodeType.LLM: {
  result = await executeLLMNode(node, webview, context)
  break
}
```

3) Build and run
- `npm run build` (typecheck + webview build + esbuild bundle for extension). Load the extension in VS Code, run `Amp: Open Workflow Editor`.
- Create a simple workflow: Text → LLM → Preview. Enter a prompt in the Text node. Execute; LLM node should complete and Preview should show assistant text.

4) Minimal error handling
- Verify behaviors for missing `AMP_API_KEY`, missing SDK dependency (during dev), and empty prompt input. Errors should be posted via `node_execution_status` and surface in VS Code.

Risks and Mitigations

- Local SDK iteration: use your `npm link` to iterate; run the esbuild bundle step to pick up changes before launching the extension.
- Packaging safety: bundling removes runtime dependency on the linked SDK and avoids absolute-path requires present in the SDK dist.
- Host Node version: SDK targets Node >= 20 (VS Code extension host meets this); if customized hosts are used, confirm version.

File References

- Web: [LLM_Node.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/nodes/LLM_Node.tsx#L24-L75), [Nodes.tsx](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/nodes/Nodes.tsx#L16-L28), [Nodes.tsx registry](file:///home/prinova/CodeProjects/amp-editor/workflow/Web/components/nodes/Nodes.tsx#L207-L219)
- Extension models/types: [models.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Core/models.ts#L11-L23), [Protocol.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Core/Contracts/Protocol.ts#L115-L128)
- Execution pipeline: [ExecuteWorkflow.ts](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L76-L95), [ExecuteWorkflow.ts helper area](file:///home/prinova/CodeProjects/amp-editor/workflow/Application/handlers/ExecuteWorkflow.ts#L275-L321)
- Amp SDK: [README.md](file:///home/prinova/CodeProjects/upstreamAmp/sdk/README.md#L7-L19), [create-amp.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/create-amp.ts#L108-L121), [API-REFERENCE.md](file:///home/prinova/CodeProjects/upstreamAmp/sdk/API-REFERENCE.md#L231-L261)
