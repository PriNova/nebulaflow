# AGENTS – NebulaFlow Editor Quick Guide

## Amp (`/home/prinova/CodeProjects/upstreamAmp`)

- Amp is an agentic coding app: the LLM inference core makes decisions; builtin tools execute repo‑aware actions (editing, refactoring, generation, planning).
- The same core runs across CLI/VS Code/Desktop/Web; clients provide platform glue.

Core capabilities
- LLM inference core: multi‑provider backends and prompt wiring in the thread worker
  - See [thread-worker.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/threads/thread-worker.ts#L29-L60)
- Orchestration and state: one worker per thread; exclusive read/write with sequenced patches
  - See [thread-worker.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/threads/thread-worker.ts#L174-L187), [thread-service.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/threads/thread-service.ts#L70-L101)
- Tool plugin system: filesystem ops, grep/glob, diagnostics, formatter, bash, git‑diff summarizer, mermaid, todo, web crawler, librarian/oracle, JS runner, task/sub‑agents
  - See [tools.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/tools/tools.ts#L52-L86)
- External contribution points:
  - MCP servers: discover and register external tools into the active ToolService (and into sub‑agents)
    - See [service.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/mcp/service.ts#L70-L76), [agent.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/tools/builtin/task/agent.ts#L139-L147)
  - Toolboxes: scan a directory of scripts, parse definitions, and expose them as tools (currently marked for removal but present)
    - See [toolboxes.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/toolboxes/toolboxes.ts#L154-L162), [toolboxes.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/toolboxes/toolboxes.ts#L189-L200)
  - Bash tool: run small scripts/CLIs under strict, safe constraints (cwd, quoting, truncation, non‑interactive)
    - See [common.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/tools/builtin/bash/common.ts#L73-L104)
- Sub‑agents (scoped planning/execution): isolated subthreads with curated tools and optional MCP tools, custom system prompt
  - See [agent.ts](file:///home/prinova/CodeProjects/upstreamAmp/core/src/tools/builtin/task/agent.ts#L132-L166)
- Cross‑client composition: clients assemble ToolService + ThreadService and drive the worker
  - See [main.ts](file:///home/prinova/CodeProjects/upstreamAmp/cli/src/main.ts#L24-L27)

## Amp SDK (`/home/prinova/CodeProjects/upstreamAmp/sdk`)

- Amp SDK spins up the Amp core in-process for Node, with threads, builtin tools, MCP integration, and optional custom tools.
- You get simple run APIs (including streaming), tool approvals, system‑prompt overrides, and settings to shape model/tools behavior.

Core capabilities
- Instantiate in-process agent: registers builtin tools and connects MCP servers into the ToolService.
  - See [create-amp.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/create-amp.ts#L71-L74)
- Programmatic run APIs: `run`, `runAll`, `runJSONL` (stream messages), plus `sendToolInput` to approve/deny tool prompts.
  - See [types.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/types.ts#L68-L84)
- Custom tools (user code as tools): define name, description, JSON schema, and a function; registered into the same ToolService as builtins/MCP.
  - See [custom-tools.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/custom-tools.ts#L28-L40), [custom-tools.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/custom-tools.ts#L58-L71)
- Model catalog and resolution: list available models and resolve by display name or key; use SDK settings to pick defaults.
  - See [models.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/models.ts#L25-L33), [models.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/models.ts#L80-L86)
- Tool naming and restriction helpers: official names and aliases to configure allow/deny lists via settings.
  - See [tool-aliases.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/tool-aliases.ts#L12-L47)
- System prompt + workspace context: SDK SystemPromptService supplies working dir, directory listing, and agent file content across roots.
  - See [system-prompt-service.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/system-prompt-service.ts#L22-L45)
- Storage and portability: threads stored under `threadsDir` with a Node FS adapter mirroring VS Code’s `workspace.fs`.
  - See [types.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/types.ts#L15-L19), [node-file-system-adapter.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/node-file-system-adapter.ts#L8-L17)

External contribution points
- MCP servers: tools from MCP are registered into the runtime ToolService (and available to sub‑agents).
  - See [create-amp.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/create-amp.ts#L71-L74)
- Custom tools: register arbitrary functions as tools at runtime; combine with builtins and MCP.
  - See [custom-tools.ts](file:///home/prinova/CodeProjects/upstreamAmp/sdk/src/custom-tools.ts#L28-L40)
- Small scripts via Bash: available through the builtin tools set (registered by the SDK instantiation).

## NebulaFlow

- NebulaFlow is a VS Code extension that lets you design and run LLM+CLI workflows as node graphs in a webview UI (React + React Flow).
- Execution is orchestrated in the extension: LLM nodes run via Amp SDK, CLI nodes via shell, with approvals, resume, and partial graph execution.

Core capabilities
- VS Code extension + command: registers the workflow editor panel and routes messages.
  - See [package.json](file:///home/prinova/CodeProjects/nebulaflow/package.json#L9-L18), [extension.ts](file:///home/prinova/CodeProjects/nebulaflow/src/extension.ts#L7-L12), [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L79-L92)
- Webview app (React): React Flow graph, sidebars, and messaging to the extension.
  - See [index.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/index.tsx#L9-L14), [WorkflowApp.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/WorkflowApp.tsx#L9-L16), [Flow.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/Flow.tsx#L75-L83)
- Node types and execution routing: CLI, LLM, Preview, Input, Variable, If/Else, Accumulator (Loop nodes exist; parallel path excludes loops).
  - See [models.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Core/models.ts#L11-L21), [NodeDispatch.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Application/handlers/NodeDispatch.ts#L1-L18), [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/engine/parallel-scheduler.ts#L1-L11)
- Parallel executor with branch control and resume seeds: caps by node type, materializes/prunes IF/ELSE branches, supports seed outputs/decisions.
  - See [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/engine/parallel-scheduler.ts#L62-L79), [parallel-scheduler.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Core/engine/parallel-scheduler.ts#L159-L176)
- LLM node via Amp SDK: creates an in‑process agent, streams JSONL events, forwards assistant content, and handles tool approvals; model selection normalized via SDK.
  - See [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Application/handlers/ExecuteSingleNode.ts#L93-L121), [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Application/handlers/ExecuteSingleNode.ts#L174-L184), [fs.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/fs.ts#L40-L55)
- CLI node: executes shell commands with abort support and optional approval.
  - See [shell.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/shell.ts#L10-L23), [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Application/handlers/ExecuteSingleNode.ts#L389-L399)
- Persistence and custom nodes: saves workflows under `.nebulaflow/workflows/`, custom nodes under `.nebulaflow/nodes/`; migrates legacy dirs.
  - See [fs.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/fs.ts#L7-L13), [fs.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/fs.ts#L198-L205)
- Webview UI for LLM node config and execution controls.
  - See [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx#L18-L27), [LLM_Node.tsx](file:///home/prinova/CodeProjects/nebulaflow/workflow/Web/components/nodes/LLM_Node.tsx#L80-L88)

External contribution points
- Amp SDK integration: LLM nodes inherit SDK capabilities (MCP servers and custom tools registered via SDK tool service).
  - See [ExecuteSingleNode.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/WorkflowExecution/Application/handlers/ExecuteSingleNode.ts#L93-L121)
- Small scripts via CLI node: runs local shell commands, with optional user approval and abort.
  - See [shell.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/shell.ts#L10-L23)
- Custom nodes as files: user-defined node JSON stored in `.nebulaflow/nodes/` and loaded into the palette.
  - See [fs.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/DataAccess/fs.ts#L218-L226), [register.ts](file:///home/prinova/CodeProjects/nebulaflow/workflow/Application/register.ts#L360-L369)

## Build and Linting

- Build: `npm run build` (webview + extension). Parts: `webview/vite.config.mts`, `tsconfig.json`.
  - SDK Sync: Builds auto-sync the upstream SDK via `sync:sdk` in the `prebuild` hook; manual linking not required. To force, run `npm i /home/prinova/CodeProjects/upstreamAmp/sdk`.
- Webview only: `npm run build:webview`. Extension only: `npm run build:ext` (uses esbuild to bundle extension + SDK).
- Webview watch: `npm run watch:webview`.
- Typecheck: `npm run typecheck` (TS 5.x; extends `@sourcegraph/tsconfig`).
- Lint: Biome configured (no ESLint/Prettier). `npm run lint` or `npm run check` (typecheck + Biome preferred over Typecheck). Auto-fix with `npm run biome`.
- Format: `npm run format` (Biome).
- Tests: not configured. Single-test N/A. If added (e.g., Vitest), run: `npx vitest run path -t "name"`.

- Extension entry: `src/extension.ts` (registers `nebulaFlow.openWorkflow`, hosts webview, handles protocol).
- Protocol (ext side): `workflow/Core/Contracts/Protocol.ts` (node/edge types, message contracts).
- Execution (ext side): `workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts` (graph execution, node handlers, LLM/CLI/preview logic).
- LLM node: `workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts` lines 750–820 (`executeLLMNode` path); requires `AMP_API_KEY` env var; workflows stream events and approvals via the slice.
- Webview app: React + @xyflow/react under `workflow/Web/` via Vite; entry `workflow/Web/workflow.html` + `workflow/Web/index.tsx`.
- Nodes/graph: `workflow/Web/components/nodes/Nodes.tsx` (NodeType, default workflow, nodeTypes); LLM node UI in `workflow/Web/components/nodes/LLM_Node.tsx`.
- Webview protocol mirror: `workflow/Web/services/WorkflowProtocol.ts`.
- Sidebar: `workflow/Web/components/WorkflowSidebar.tsx` (categories, node palette, property editor); v0.1.4+ Property Editor displays as static header using `accordion.module.css` styling (no collapse/expand toggle, content driven by node selection state); v0.1.6+ Category labels render via `displayCategoryLabel` helper (lines 49–55) mapping `llm` → `Agents`, `text-format` → `Text`, others unchanged.
- TS config: strict; ES2022; CJS for extension; `jsx: react-jsx`; extends `@sourcegraph/tsconfig`. `noUnusedLocals` is currently disabled to avoid breaking the build; enable it once unused locals are cleaned up. Webview builds via Vite React plugin.
- Imports: extension uses `import * as vscode` + Node builtins; webview uses ESM React TS; prefer explicit type imports.
- Naming: lowerCamelCase vars/fns; PascalCase components/types; enums like `NodeType`.
- Errors: show user via `vscode.window.showErrorMessage`; avoid unhandled rejections; return sanitized strings.
- Formatting: Biome formats code; run `npm run format`. Keep functions small/pure in core helpers; side-effects at boundaries (webview/engine).
- Editor rules: none found (.cursor, .cursorrules, CLAUDE.md, .windsurfrules, .clinerules, .goosehints, Copilot instructions).
- VS Code: engines `>=1.90.0`; main `dist/extension.js`; webview output `dist/webviews`. Run: `npm i && npm run build`, launch in VS Code.
- Amp SDK reference implementation: `/home/prinova/CodeProjects/upstreamAmp/sdk` with the root at `/home/prinova/CodeProjects/upstreamAmp`
- LLM node dev: set `AMP_API_KEY` env var before F5. Errors: "Amp SDK not available" → link SDK; "AMP_API_KEY is not set" → set env; timeout/abort handled gracefully.
