# AGENTS – NebulaFlow Editor Quick Guide

## Amp (`/home/prinova/CodeProjects/upstreamAmp`)

- Amp is an agentic coding app: the LLM inference core makes decisions; builtin tools execute repo‑aware actions (editing, refactoring, generation, planning).
- The same core runs across CLI/VS Code/Desktop/Web; clients provide platform glue.

## Amp SDK (`/home/prinova/CodeProjects/upstreamAmp/sdk`)

- Amp SDK spins up the Amp core in-process for Node, with threads, builtin tools, MCP integration, and optional custom tools.
- You get simple run APIs (including streaming), tool approvals, system‑prompt overrides, and settings to shape model/tools behavior.

## NebulaFlow (this project `/home/prinova/CodeProjects/nebulaflow`)

- NebulaFlow is a VS Code extension that lets you design and run LLM+CLI workflows as node graphs in a webview UI (React + React Flow).
- Execution is orchestrated in the extension: LLM nodes run via Amp SDK, CLI nodes via shell, with approvals, resume, and partial graph execution.

## Coding Conventions

- **Node.js Imports** - Always use the `node:` protocol for Node.js built-in modules (e.g., `import * as fs from 'node:fs'` instead of `'fs'`).

## Build and Linting

- Build: `npm run build` (webview + extension). Parts: `webview/vite.config.mts`, `tsconfig.json`.
  - SDK Sync: Builds auto-sync the upstream SDK via `sync:sdk` in the `prebuild` hook; manual linking not required. To force, run `npm i /home/prinova/CodeProjects/upstreamAmp/sdk`.
- Webview only: `npm run build:webview`. Extension only: `npm run build:ext` (uses esbuild to bundle extension + SDK).
- Webview watch: `npm run watch:webview`.
- Typecheck: `npm run check` (TS 5.x; extends `@sourcegraph/tsconfig`).
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
