# Contribution Workflow

This guide outlines the complete workflow for contributing to NebulaFlow, from setting up your environment to merging your changes.

## Table of Contents

- [Overview](#overview)
- [Step 1: Fork and Clone](#step-1-fork-and-clone)
- [Step 2: Set Up Development Environment](#step-2-set-up-development-environment)
- [Step 3: Create a Feature Branch](#step-3-create-a-feature-branch)
- [Step 4: Make Your Changes](#step-4-make-your-changes)
- [Step 5: Run Checks](#step-5-run-checks)
- [Step 6: Update Documentation](#step-6-update-documentation)
- [Step 7: Commit Messages](#step-7-commit-messages)
- [Step 8: Push and Create Pull Request](#step-8-push-and-create-pull-request)
- [Step 9: Review Process](#step-9-review-process)
- [Step 10: CI/CD Pipeline](#step-10-cicd-pipeline)
- [Step 11: Merging and Release](#step-11-merging-and-release)
- [Troubleshooting](#troubleshooting)

## Overview

Contributing to NebulaFlow follows a standard open-source workflow:

1. Fork the repository
2. Create a feature branch
3. Make changes and run checks
4. Submit a pull request
5. Wait for review and address feedback
6. Merge into `main` (or `dev` for pre-release)

## Step 1: Fork and Clone

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

## Step 2: Set Up Development Environment

Follow the [Development Setup](../technical/development.md) guide to install dependencies, set environment variables, and build the project.

**Quick start:**
- Install Node.js ≥ 18 and npm ≥ 9
- Run `npm install`
- Set `AMP_API_KEY` and optionally `OPENROUTER_API_KEY`
- Build with `npm run build`

## Step 3: Create a Feature Branch

Create a descriptive branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**
- `feature/` – new features
- `fix/` – bug fixes
- `docs/` – documentation updates
- `refactor/` – code refactoring
- `chore/` – maintenance tasks

## Step 4: Make Your Changes

- Write clear, concise code following the [Code Style](code-style.md) guidelines.
- Keep functions small and pure; side effects at boundaries.
- Use explicit type imports and the `node:` protocol for Node.js built-ins.
- Add tests if applicable (currently manual testing only).
- Ensure your changes pass type checking and linting.

## Step 5: Run Checks

Before committing, run the full check suite:

```bash
npm run check
```

This runs:
- TypeScript type checking
- Biome linting and formatting

If there are errors, fix them before proceeding.

## Step 6: Update Documentation

If you add or modify features, update the relevant documentation:
- User guide (`docs/user-guide/`)
- API reference (`docs/api-reference/`)
- Examples (`docs/workflows/`)
- Update `mkdocs.yml` if adding new files.

## Step 7: Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, linting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, tooling, dependencies

**Example:**
```
feat(llm-node): add support for custom model parameters

- Extend LLM node data interface with `modelParams` field
- Update UI to allow editing model parameters
- Pass parameters to Amp SDK execution

Closes #123
```

## Step 8: Push and Create Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
2. **Create a pull request** on GitHub:
   - Base branch: `main` (or `dev` for pre-release features)
   - Head branch: your feature branch
   - Title: Clear description of the change
   - Description:
     - Reference any related issues
     - Summarize changes
     - Include a manual test checklist (if applicable)

## Step 9: Review Process

- Wait for a maintainer to review your PR.
- Address any feedback promptly.
- CI checks will run automatically (see below).
- Once approved, a maintainer will merge your PR.

## Step 10: CI/CD Pipeline

NebulaFlow uses GitHub Actions for continuous integration. The CI pipeline runs on pushes to `main` and `dev` branches and includes:

- Type checking and linting (`npm run check`)
- Building and packaging the extension (`npm run package:vsix`)
- Deploying documentation to GitHub Pages (when docs change)

You can run the same steps locally to verify your changes before pushing.

## Step 11: Merging and Release

- **Merging**: PRs are merged via squash merge (or rebase) into `main` or `dev`.
- **Release**: Releases are created by pushing a Git tag (e.g., `v1.2.3`). The CI workflow automatically builds and packages the extension, then creates a GitHub release with the `.vsix` file.
- **Documentation**: Documentation changes are automatically deployed to GitHub Pages when merged into `main`.

For detailed release process, see [Deployment](../technical/deployment.md).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Amp SDK not available** | Ensure `vendor/amp-sdk/amp-sdk.tgz` exists. |
| **AMP_API_KEY is not set** | Set the environment variable before launching VS Code. |
| **Webview assets don’t load** | Run `npm run build` or start the webview watcher (`npm run watch:webview`). |
| **Type errors** | Run `npm run typecheck` and fix diagnostics. |
| **Lint/format issues** | Run `npm run check` or `npm run biome`. |
| **Extension fails to load** | Check VS Code version ≥ 1.90.0; reload the window. |
| **CI fails** | Run `npm run check` locally and fix any errors. |

---

*Last Updated: 2026-01-21*
