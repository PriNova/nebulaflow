# Amp Editor: Workflow Editor Migration Plan

Owner: Tino
Status: Phase 1 scaffolded (pending deps/build)
Scope: Migrate Cody Workflow Editor to standalone VS Code extension at /home/prinova/CodeProjects/amp-editor. Use Amp SDK later (not in this phase).

## Current Feature Overview (Quick)
- Webview UI: React + React Flow (@xyflow/react). Entry: [index.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/index.tsx#L1-L18), [WorkflowApp.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/WorkflowApp.tsx#L1-L16), root canvas in [Flow.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/components/Flow.tsx#L1-L230).
- Node types: defined in [Nodes.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/components/nodes/Nodes.tsx#L1-L303) with components for CLI, LLM, Preview, SearchContext, Variable, Accumulator, If/Else, Loop, CodyOutput.
- Protocol: bidirectional messages defined in [WorkflowProtocol.ts](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/services/WorkflowProtocol.ts#L1-L162).
- Extension side:
  - Webview provider + command: [workflow.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow.ts#L1-L213)
  - Execution engine: [workflow-executor.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow-executor.ts#L1-L999)
  - IO (save/load/custom nodes): [workflow-io.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow-io.ts#L1-L274)
- Build: vite builds webviews to dist/webviews/[workflow.html] via [vite.config.mts](file:///home/prinova/CodeProjects/cody/vscode/webviews/vite.config.mts#L1-L37)

## Coupling To Remove/Replace (Phase 1)
- Cody Shared SDK
  - Models + GenericVSCodeWrapper types: in UI ([WorkflowApp.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/WorkflowApp.tsx#L1-L16), [Flow.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/components/Flow.tsx#L1-L230), [LLM_Node.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/components/nodes/LLM_Node.tsx#L1-L76)).
  - ChatClient/TokenCounter/modelsService/tracer: extension ([workflow.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow.ts#L1-L213), [workflow-executor.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow-executor.ts#L1-L999)).
- Cody Chat UX
  - Cody Output node executes VS Code chat + session watch: [workflow-executor.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow-executor.ts#L713-L767).
- Sourcegraph Context
  - SearchContext node pulls repo context via ContextRetriever: [workflow-executor.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow-executor.ts#L667-L709).
- Cody FS utils
  - writeToCodyJSON and Cody-specific folders: [workflow-io.ts](file:///home/prinova/CodeProjects/cody/vscode/src/workflow/workflow-io.ts#L1-L274).
- Branding
  - Cody logos/labels: [LLM_Node.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/components/nodes/LLM_Node.tsx#L60-L68), default node titles in [Nodes.tsx](file:///home/prinova/CodeProjects/cody/vscode/webviews/workflow/components/nodes/Nodes.tsx#L188-L218).

## Target Architecture (Vertical Slice)
Directory in amp-editor (slice: Workflow):

- workflow/
  - Web/ (Webview)
    - index.html, workflow.html, index.tsx, WorkflowApp.tsx, components/**
    - services/Protocol.ts (no cody types)
  - Application/
    - register.ts (register `ampEditor.openWorkflow`)
    - handlers/ExecuteWorkflow.ts (webview <-> engine)
  - Core/
    - engine/ (pure execution: node-sorting, replaceIndexedInputs, combineParentOutputs)
    - models.ts (node types, DTOs)
  - DataAccess/
    - fs.ts (save/load workflow + custom nodes, configurable base dir e.g. .sourcegraph/workflows)
    - shell.ts (PersistentShell minimal impl)
  - ExternalServices/
    - llm/LLMAdapter.ts (interface; no impl in Phase 1)
    - context/ContextAdapter.ts (interface; no impl in Phase 1)

Notes:
- Keep Core pure; put VS Code, FS, shell under adapters.
- Replace Cody types with internal equivalents.

## Migration Plan (Phased)
Phase 1 — Standalone without Cody/Amp SDK
- Copy UI: webviews/workflow/** (drop Cody branding/icon; stub model picker).
- Copy Core engine utilities: node-sorting.ts, utils.ts, minimal executor excluding Cody Output + SearchContext.
- Define Protocol.ts locally without cody-shared types.
- Implement extension command: `ampEditor.openWorkflow` mounting workflow.html.
- Implement FS: save/load/custom nodes (JSON). Replace writeToCodyJSON with VS Code FS JSON write. Keep dirs `.sourcegraph/workflows` and `.sourcegraph/nodes` for continuity.
- Implement CLI node via shell.ts using child_process with allowlist and approval flow.
- Temporarily disable or hide nodes:
  - LLM node: keep UI but execution returns "LLM unavailable" unless adapter provided.
  - SearchContext node: disabled or returns empty context.
  - CodyOutput node: remove from palette; keep type mapping for loading older files but make it no-op.
- Token counting: simple byte/char count fallback; wire `calculate_tokens` to fallback.
- Models: static list from settings (empty by default). UI tolerates empty list.

Phase 2 — Amp SDK integration (later)
- Provide LLMAdapter backed by Amp SDK.
- Provide ContextAdapter backed by Amp SDK.
- Replace token counting with Amp tokenizer.
- Restore Output behavior with an Amp-compatible output node (rename from CodyOutput).

## Current Migration Status
- Standalone extension scaffolded at `/home/prinova/CodeProjects/amp-editor` (extension host, engine, webview, local protocol/types).
- Cody/Amp SDK removed from Phase 1; local wrappers used.
- Execution behavior:
  - CLI with approval + denylist + abort.
  - LLM posts error "LLM unavailable"; SearchContext returns empty; CodyOutput no-op.
  - Token counting via char length.
- Webview UI ports Flow + sidebars; Cody branding replaced with generic LLM labels.

## Minimal Implementation Checklist (Phase 1)
- Extension host
  - [x] Command `ampEditor.openWorkflow`
  - [x] Webview panel + CSP + resource roots
  - [x] Message wiring per Protocol.ts (save/load/execute/abort/token_count/custom_nodes)
  - [x] Engine: execute CLI/Preview/Input/Accumulator/IfElse/Variable/Loop
  - [x] Token counter fallback
- Webview
  - [x] Render Flow + sidebars
  - [x] Hide Cody-specific branding/nodes, handle empty model list
  - [x] Custom Nodes CRUD via protocol
- Data access
  - [x] Save/Load workflow JSON
  - [x] Custom nodes JSON dir management
  - [x] Shell execution with allowlist and approval

## Outstanding Tasks (Pre-Build)
- Add/replace small UI deps or stubs used by workflow components:
  - `uuid` (IDs), `clsx` (class joins), `@vscode/codicons` (optional font in CSS)
  - Minimal shadcn UI stubs (popover, slider, textarea, dialog, tooltip) or replace with plain elements
- CSS cleanup:
  - Remove/replace `cody-icons.woff` reference in webview CSS if present
- Dependency install and builds (see below)

## Build & Validation Steps
- In `/home/prinova/CodeProjects/amp-editor`:
  - Install deps: `react`, `react-dom`, `@xyflow/react`, `lucide-react`, `uuid`, `clsx`, `@vscode/codicons`
  - Dev deps: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `vite`, `@vitejs/plugin-react`, `vscode`
  - Build webview: `npm run build:webview`
  - Build extension: `npm run build`
  - Launch VS Code and run command: Amp: Open Workflow Editor
  - Manual test: CLI("echo hi") → Preview; approve prompt; abort mid-run; verify token count updates

## Risk/Decisions
- Keep on-disk format compatible (version in JSON) — bump to `1.2.0` when removing Cody-only nodes.
- Security: keep CLI allowlist and require approval; mirror current restrictions.
- UX: when LLM/Context unavailable, surface clear disabled states.

## File Survey (lines read)
- vscode/src/workflow/workflow.ts (1–213)
- vscode/src/workflow/workflow-executor.ts (1–999)
- vscode/src/workflow/workflow-io.ts (1–274)
- vscode/webviews/workflow/services/WorkflowProtocol.ts (1–162)
- vscode/webviews/workflow/index.tsx (1–18)
- vscode/webviews/workflow/WorkflowApp.tsx (1–16)
- vscode/webviews/workflow/components/Flow.tsx (1–230)
- vscode/webviews/workflow/components/hooks/workflowExecution.ts (1–119)
- vscode/webviews/workflow/components/hooks/messageHandling.ts (1–153)
- vscode/webviews/workflow/components/nodes/Nodes.tsx (1–303)
- vscode/webviews/workflow/components/nodes/LLM_Node.tsx (1–76)
- vscode/webviews/workflow/components/nodes/CodyOutput_Node.tsx (1–38)
- vscode/webviews/workflow/components/nodes/SearchContext_Node.tsx (1–58)
- vscode/webviews/workflow/components/nodes/CLI_Node.tsx (1–58)
- vscode/webviews/vite.config.mts (1–37)

## Next Actions
- Install dependencies and build amp-editor
- Replace/add minimal UI stubs (popover/slider/textarea/dialog/tooltip) or remove usages
- Validate workflow execution end-to-end
- Prepare Amp SDK adapter interfaces (no impl yet)
