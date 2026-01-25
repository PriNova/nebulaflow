# Pull Requests

This guide details the process for creating, reviewing, and merging pull requests (PRs) in the NebulaFlow repository.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Creating a Pull Request](#creating-a-pull-request)
- [PR Description and Checklist](#pr-description-and-checklist)
- [CI/CD Checks](#cicd-checks)
- [Review Process](#review-process)
- [Merging Strategies](#merging-strategies)
- [Post-Merge Steps](#post-merge-steps)
- [Troubleshooting](#troubleshooting)

## Overview

Contributing to NebulaFlow follows a standard open-source workflow:

1. Fork the repository
2. Create a feature branch
3. Make changes and run checks
4. Submit a pull request
5. Wait for review and address feedback
6. Merge into `main` (or `dev` for pre-release)

## Prerequisites

Before creating a PR, ensure you have:

1. **Forked the repository** on GitHub.
2. **Cloned your fork** locally and added the upstream remote:
   ```bash
   git remote add upstream https://github.com/PriNova/nebulaflow.git
   ```
3. **Created a feature branch** with a descriptive name:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Made your changes** following the [Code Style](code-style.md) guidelines.
5. **Run all checks** locally:
   ```bash
   npm run check
   ```
6. **Updated documentation** if you added or modified features.
7. **Verified your changes** manually (see [Testing](../technical/testing.md)).

## Creating a Pull Request

### Push Your Branch

Push your feature branch to your fork:

```bash
git push origin feature/your-feature-name
```

### Open a PR on GitHub

1. Navigate to the NebulaFlow repository on GitHub.
2. Click the **Pull requests** tab.
3. Click **New pull request**.
4. Select your fork and feature branch as the head branch.
5. Choose the base branch:
   - `main` for stable changes
   - `dev` for pre-release features (if applicable)
6. Click **Create pull request**.

### PR Title and Description

**Title**: Use a clear, concise description of the change. Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
```
<type>(<scope>): <subject>
```
Example: `feat(llm-node): add support for custom model parameters`

**Description**: Provide a detailed explanation of the changes:

- **What** was changed and **why**
- **How** it was implemented (high-level overview)
- **Any breaking changes** or migration steps
- **Related issues** (use `Closes #123` or `Fixes #456`)

### PR Description Template

If you want to use a template, you can copy the following into your PR description:

```markdown
## Summary

Brief description of the changes.

## Changes

- List key changes
- Bullet points for clarity

## Testing

- [ ] LLM node streams output and respects thread continuation
- [ ] CLI node executes with approval, script mode, and safety levels
- [ ] If/Else node routes correctly based on condition
- [ ] Loop node iterates and updates loop variable
- [ ] Variable node sets and retrieves values
- [ ] Accumulator node concatenates outputs
- [ ] Preview node displays data
- [ ] Subflow node executes saved workflow

## Checklist

- [ ] Code follows the [Code Style](code-style.md) guidelines
- [ ] Tests pass (if any)
- [ ] Documentation updated
- [ ] No new dependencies added (or justified)

## Related Issues

Closes #123
```

## CI/CD Checks

The NebulaFlow repository uses GitHub Actions for continuous integration. However, **CI does not run automatically on pull requests** from forks due to security restrictions. Instead, the CI pipeline runs on pushes to the `main` and `dev` branches.

### What This Means for Your PR

1. **Local Verification Required**: You must run all checks locally before opening a PR.
2. **Maintainer Verification**: Maintainers will verify your changes locally before merging.
3. **Post-Merge CI**: After your PR is merged, CI will run on the `main` branch to build and package the extension.

### Checks to Run Locally

#### 1. Type Checking and Linting

- **Command**: `npm run check`
- **What it does**: Runs TypeScript type checking and Biome linting.
- **How to fix**: Run `npm run check` locally and fix any errors.

#### 2. Build and Package

- **Command**: `npm run package:vsix`
- **What it does**: Builds the VS Code extension and creates a `.vsix` file.
- **How to fix**: Ensure your changes don't break the build. Run `npm run build` locally.

#### 3. Documentation (if docs changed)

- **Command**: `mkdocs build`
- **What it does**: Builds the documentation locally to verify no broken links or syntax errors.
- **How to fix**: Install mkdocs with `pip install mkdocs mkdocs-material` and run `mkdocs build`.

### Required Checks

All checks must pass locally before opening a PR. Maintainers will verify these checks before merging.

## Review Process

### What to Expect

1. **Initial Review**: A maintainer will review your changes within a few days.
2. **Feedback**: You may receive comments requesting changes or clarifications.
3. **Address Feedback**: Make the requested changes and push them to the same branch. The PR will update automatically.
4. **Re-review**: Once you've addressed feedback, request another review.
5. **Local Verification**: Maintainers may pull your branch and run checks locally before approving.

### Review Guidelines

- **Be respectful**: Assume good intent.
- **Be specific**: Point to exact lines and suggest improvements.
- **Ask questions**: If something is unclear, ask for clarification.
- **Test changes**: Reviewers may pull your branch and test locally.

### Approval

Once a maintainer approves your PR and verifies all checks locally, the PR is ready for merging. CI will run after merging on the `main` branch.

## Merging Strategies

### Squash Merge (Recommended)

- **When**: For most feature branches with many small commits.
- **Why**: Keeps the `main` branch history clean.
- **How**: Maintainers will squash all commits into a single commit with a descriptive message.

### Rebase Merge

- **When**: For long-lived branches with clean, logical commits.
- **Why**: Preserves individual commit history.
- **How**: Maintainers will rebase your branch onto `main` and merge.

### Merge Commit

- **When**: For merging a long-lived feature branch with a complex history.
- **Why**: Preserves the entire branch history.
- **How**: Maintainers will create a merge commit.

**Note**: The default merge strategy is determined by the repository settings. Maintainers may choose the appropriate strategy based on the PR.

## Post-Merge Steps

### Automatic Processes

1. **CI/CD Pipeline**: The `build` workflow runs on `main` and `dev` branches, building and packaging the extension.
2. **Release Creation**: If a Git tag is pushed (e.g., `v1.2.3`), a GitHub release is automatically created with the `.vsix` file.
3. **Documentation Deployment**: Changes to `docs/**` trigger the `deploy-docs` workflow, updating GitHub Pages.

### Manual Steps (if needed)

- **Update Changelog**: Add a summary of changes to `CHANGELOG.md`.
- **Notify Users**: If the change is significant, announce it in discussions or Discord.
- **Update Version**: For releases, update the version in `package.json` and create a Git tag.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **CI fails with type errors** | Run `npm run check` locally and fix diagnostics. |
| **CI fails with lint errors** | Run `npm run biome` to auto-fix, or `npm run check` to see errors. |
| **Build fails** | Run `npm run build` locally. Ensure dependencies are installed (`npm install`). |
| **Documentation deployment fails** | Check `mkdocs.yml` syntax and ensure all linked files exist. |
| **PR branch is out of date** | Merge `main` into your branch: `git merge upstream/main` and push. |
| **Conflicts with `main`** | Rebase your branch onto `main`: `git rebase upstream/main` and resolve conflicts. |
| **Amp SDK not available** | Ensure `vendor/amp-sdk/amp-sdk.tgz` exists (see [Development Setup](../technical/development.md)). |
| **AMP_API_KEY is not set** | Set the environment variable before launching VS Code. |
| **Webview assets don’t load** | Run `npm run build` or start the webview watcher (`npm run watch:webview`). |

---

*Last Updated: 2026-01-21*
