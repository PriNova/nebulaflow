# Contributing Guidelines

Thank you for your interest in contributing to NebulaFlow! We welcome contributions of all kinds: bug reports, documentation improvements, feature requests, and code contributions.

This document outlines the contribution process, coding standards, and development workflow.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Adding New Node Types](#adding-new-node-types)
- [Documentation](#documentation)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [CI/CD](#cicd)
- [Issue Reporting](#issue-reporting)

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/nebulaflow.git
   cd nebulaflow
   ```
3. **Add the upstream remote** to keep your fork in sync:
   ```bash
   git remote add upstream https://github.com/PriNova/nebulaflow.git
   ```
4. **Create a feature branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

For detailed setup instructions, see the [Development Guide](../technical/development.md).

**Quick start:**

1. Install Node.js ≥ 18 and npm ≥ 9.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set environment variables (required for LLM nodes):
   ```bash
   export AMP_API_KEY="your-amp-key"
   export OPENROUTER_API_KEY="your-openrouter-key"  # optional
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Launch the extension in VS Code:
   - Open the project folder in VS Code.
   - Press **F5** (Launch Extension).
   - In the new window, run the command **NebulaFlow: Open Workflow Editor**.

## Code Style

NebulaFlow follows a strict TypeScript style guide. Please adhere to the following:

### TypeScript

- **Strict mode** is enabled. Ensure your code compiles without errors.
- **Explicit type imports**: Prefer `import type { Foo } from './bar'` when only types are used.
- **Node.js built‑ins**: Always use the `node:` protocol (e.g., `import * as fs from 'node:fs'`).
- **Functions**: Keep them small and pure. Side effects should be isolated at boundaries (webview/engine).
- **Naming**:
  - Variables & functions: `lowerCamelCase`
  - Components & types: `PascalCase`
  - Enums: `PascalCase` (e.g., `NodeType`)
- **Imports**: Group external imports first, then internal imports. Sort alphabetically.

### Linting & Formatting

We use **Biome** for linting and formatting.

- Run checks: `npm run check` (typecheck + lint)
- Auto‑fix: `npm run biome` (also aliased as `npm run format`)

### Architecture

NebulaFlow uses a **Vertical Slice Architecture** (VSA). Key slices:

- `workflow/Web/` – React UI, React Flow graph, node components, sidebars.
- `workflow/Application/` – Message handling, command orchestration, lifecycle.
- `workflow/Core/` – Pure types, models, validation.
- `workflow/DataAccess/` – File system and shell adapters.
- `workflow/WorkflowExecution/` – Graph execution engine, node runners.
- `workflow/LLMIntegration/` – SDK integration, workspace configuration.
- `workflow/Shared/` – Generic primitives (Host, Infrastructure).

**Rule**: Keep related code together. Avoid creating global utilities unless used by 3+ unrelated slices.

## Testing

Currently, there are no automated unit tests. Manual testing is performed by creating workflows with various node types and verifying execution, streaming, approvals, and pause/resume.

**Manual test checklist** (copy into your PR description):

- [ ] LLM node streams output and respects thread continuation
- [ ] CLI node executes with approval, script mode, and safety levels
- [ ] If/Else node routes correctly based on condition
- [ ] Loop node iterates and updates loop variable
- [ ] Variable node sets and retrieves values
- [ ] Accumulator node concatenates outputs
- [ ] Preview node displays data
- [ ] Subflow node executes saved workflow

## Adding New Node Types

To add a new node type, follow these steps (detailed in [Development Guide](../technical/development.md#adding-new-node-types)):

1. **Define the node schema** in `workflow/Core/models.ts` (add a new `NodeType` and its data interface).
2. **Create a UI component** in `workflow/Web/components/nodes/`.
3. **Register the UI component** in `workflow/Web/components/nodes/Nodes.tsx`.
4. **Implement the node runner** in `workflow/WorkflowExecution/Application/node-runners/`.
5. **Register the node in the dispatcher** (`workflow/WorkflowExecution/Application/handlers/NodeDispatch.ts`).
6. **Hook the runner into execution** (`workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts` and `ExecuteSingleNode.ts`).
7. **Update the node palette** in `workflow/Web/components/sidebar/WorkflowSidebar.tsx`.
8. **Update documentation** in `docs/user-guide/nodes/index.md` and `docs/api-reference/node-types.md`.

## Documentation

We value clear, accurate documentation. When adding or modifying features:

1. Update the relevant markdown files in `docs/`.
2. Ensure navigation is updated in `mkdocs.yml`.
3. Verify links are correct and point to existing files.
4. Keep examples executable and up‑to‑date.

**Documentation style guide**:

- Use clear, concise language.
- Include code examples where appropriate.
- Link to related topics.
- Keep documentation synchronized with code changes.

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, linting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, tooling, dependencies

**Example**:

```
feat(llm-node): add support for custom model parameters

- Extend LLM node data interface with `modelParams` field
- Update UI to allow editing model parameters
- Pass parameters to Amp SDK execution

Closes #123
```

## Pull Request Process

1. **Ensure your branch is up‑to‑date** with upstream `main`:
   ```bash
   git pull upstream main
   ```
2. **Run checks** to verify your changes:
   ```bash
   npm run check
   ```
3. **Update documentation** if you added or modified features.
4. **Create a pull request** with a clear description:
   - Reference any related issues.
   - Include a summary of changes.
   - Add a manual test checklist (if applicable).
5. **Wait for review**. Address feedback promptly.

## CI/CD

NebulaFlow uses GitHub Actions for continuous integration. The CI pipeline runs on pushes to `main` and `dev` branches and includes:

- Type checking and linting (`npm run check`)
- Building and packaging the extension (`npm run package:vsix`)
- Deploying documentation to GitHub Pages (when docs change)

You can run the same steps locally to verify your changes before pushing.

## Issue Reporting

If you encounter a bug or have a feature request, please open an issue on GitHub.

**Before opening an issue**:

- Search existing issues to avoid duplicates.
- Provide a clear description and steps to reproduce.
- Include environment details (VS Code version, Node.js version, OS).
- For LLM‑related issues, mention which API key you are using (Amp or OpenRouter).

## Questions?

Feel free to open a discussion on GitHub or reach out to the maintainers.

---

*Last Updated: 2026-01-21*
