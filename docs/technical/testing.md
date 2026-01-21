# Testing Guide

This guide covers the testing strategy, tools, and practices for NebulaFlow.

## Overview

NebulaFlow currently employs a **manual testing** approach for verifying core functionality. However, there is an existing **integration test suite** for subflows, and there are plans to expand automated testing coverage.

## Current Testing State

### Manual Testing

Since there are no automated unit tests, manual testing is performed by creating workflows with various node types and verifying execution, streaming, approvals, and pause/resume.

**Manual test checklist**:

- [ ] **LLM node**: Streams output and respects thread continuation
- [ ] **CLI node**: Executes with approval, script mode, and safety levels
- [ ] **If/Else node**: Routes correctly based on condition
- [ ] **Loop node**: Iterates and updates loop variable
- [ ] **Variable node**: Sets and retrieves values
- [ ] **Accumulator node**: Concatenates outputs
- [ ] **Preview node**: Displays data
- [ ] **Subflow node**: Executes saved workflow

### Integration Tests (Subflows)

An integration test suite exists for subflow execution, located in `.sourcegraph/tasks/subflow-integration/`. It tests:

- **Aggregate progress**: Verifies that subflow nodes emit correct progress messages (x/y)
- **Resume seeds bypass**: Ensures bypass nodes work correctly with resume seeds
- **Hybrid seeds with pre-loop IF/ELSE**: Tests seeded decisions before loops
- **Hybrid seeds with IF/ELSE inside loop**: Tests seeded decisions inside loops
- **Hybrid seeds with IF/ELSE after loop**: Tests seeded decisions after loops

The test suite uses a custom runner that builds the tests with esbuild and executes them in a Node.js environment with mocked VS Code APIs.

## Running Tests

### Integration Tests (Subflows)

Run the integration test suite:

```bash
node .sourcegraph/tasks/subflow-integration/run-subflows-tests.mjs
```

The script will:
1. Build the test bundle using esbuild
2. Execute the tests with a temporary storage path
3. Output results to the console

**Note**: The package.json script `test:subflows` currently points to a non‑existent path (`tasks/integration/run-subflows-tests.mjs`). Use the correct path above.

### Manual Testing

To perform manual testing:

1. Launch the extension in debug mode (F5)
2. Open the NebulaFlow workflow editor
3. Create workflows using the node palette
4. Execute workflows and verify:
   - Node execution status updates
   - Streaming output (for LLM nodes)
   - Approval dialogs (for CLI nodes)
   - Loop iteration counts
   - Conditional branching
   - Variable persistence
   - Subflow execution

## Future Automated Tests

The project roadmap includes expanding test coverage with:

### Unit Tests

- **Pure functions** in the Core slice (e.g., graph algorithms, validation logic)
- **Node runners** (isolated execution logic)
- **Protocol message handling**

### Integration Tests

- **Node runners**: Test each node type in isolation with mocked dependencies
- **Workflow execution**: Test end‑to‑end execution with various graph structures
- **Streaming & approvals**: Verify event streaming and user approval flows

### End‑to‑End Tests

- **Full workflow scenarios**: Test complex workflows with multiple node types
- **UI interactions**: Test webview interactions (if feasible)
- **Extension lifecycle**: Test activation, deactivation, and storage

## Adding New Tests

When automated testing is introduced, follow these guidelines:

### Test Location

- **Unit tests**: Co‑locate with source files (e.g., `my‑module.ts` → `my‑module.spec.ts`)
- **Integration tests**: Place in `tests/integration/` or `tests/e2e/` directories
- **Test utilities**: Shared helpers go in `tests/utils/`

### Test Naming

- Use descriptive names: `describe('NodeDispatch', () => { ... })`
- Follow the pattern: `should <behavior> when <condition>`

### Test Structure

```typescript
import { describe, it, expect } from 'vitest'

describe('MyModule', () => {
  it('should return expected result for valid input', () => {
    const result = myFunction(validInput)
    expect(result).toEqual(expectedOutput)
  })

  it('should throw error for invalid input', () => {
    expect(() => myFunction(invalidInput)).toThrow()
  })
})
```

### Running Tests

Once a test runner is configured (e.g., Vitest), run tests with:

```bash
npm test
```

Or run specific test suites:

```bash
npm test -- --run tests/integration/node-runners
```

## Best Practices

1. **Test‑Driven Development**: Write tests before implementing new features
2. **Isolate Side Effects**: Mock external dependencies (file system, network, VS Code APIs)
3. **Keep Tests Fast**: Use in‑memory mocks instead of real I/O
4. **One Assertion Per Test**: Focus each test on a single behavior
5. **Clear Test Data**: Use descriptive fixtures and avoid magic numbers
6. **Document Test Intent**: Add comments explaining why a test exists

## Continuous Integration

The GitHub Actions workflow (`.github/workflows/build.yml`) currently runs:

- Type checking (`npm run typecheck`)
- Linting (`npm run lint`)
- Build and packaging (`npm run package:vsix`)

When automated tests are added, they should be integrated into the CI pipeline:

```yaml
- name: Run tests
  run: npm test
```

## References

- [Development Guide](development.md) – Setting up the environment
- [Architecture](architecture.md) – Technical design overview
- [Node Types](../../workflow/Core/models.ts) – Available node definitions
- [Execution Handler](../../workflow/WorkflowExecution/Application/handlers/ExecuteWorkflow.ts) – Workflow execution logic
- [Subflow Integration Tests](../../.sourcegraph/tasks/subflow-integration/tests/subflows.spec.ts) – Existing integration test examples
