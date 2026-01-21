# NebulaFlow Documentation

Welcome to the NebulaFlow documentation! This is the main entry point for all documentation related to the NebulaFlow VS Code extension.

## What is NebulaFlow?

NebulaFlow is a VS Code extension that enables you to design and run LLM+CLI workflows as visual node graphs. It provides an intuitive webview interface where you can connect nodes representing different operations and execute them in sequence.

## Documentation Structure

### Getting Started
- [Introduction](getting-started/introduction.md) - Overview of NebulaFlow
- [Installation](getting-started/installation.md) - How to install the extension
- [Configuration](getting-started/configuration.md) - Configure your environment
- [Quick Start](getting-started/quick-start.md) - Build your first workflow in 5 minutes

### User Guide
- [Workflow Design](user-guide/workflow-design.md) - Design effective workflows
- [Node Types](user-guide/nodes/index.md) - Complete node reference
  - [LLM Nodes](user-guide/nodes/llm-nodes.md)
  - [CLI Nodes](user-guide/nodes/cli-nodes.md)
  - [Condition Nodes](user-guide/nodes/condition-nodes.md)
  - [Loop Nodes](user-guide/nodes/loop-nodes.md)
- [Connections & Flow](user-guide/connections.md)
- [Variables & State](user-guide/variables-state.md)
- [Execution & Debugging](user-guide/execution-debugging.md)

### API Reference
- [Extension API](api-reference/extension.md)
- [Protocol Contracts](api-reference/protocol.md)
- [Node Types & Interfaces](api-reference/node-types.md)
- [Event System](api-reference/events.md)

### Workflow Examples
- [Basic Workflows](workflows/basic.md)
- [Advanced Patterns](workflows/advanced.md)
- [Integration Examples](workflows/integrations/index.md)
  - [LLM Integration](workflows/integrations/llm.md)
  - [CLI Integration](workflows/integrations/cli.md)
  - [External APIs](workflows/integrations/apis.md)

### Technical Documentation
- [Architecture Details](technical/architecture.md)
- [Development Setup](technical/development.md)
- [Testing](technical/testing.md)
- [Build Process](technical/build.md)
- [Deployment](technical/deployment.md)

### Contributing
- [Contribution Guidelines](contributing/guidelines.md)
- [Development Workflow](contributing/workflow.md)
- [Code Style](contributing/code-style.md)
- [Pull Request Process](contributing/pull-requests.md)

### Resources
- [FAQ](resources/faq.md)
- [Troubleshooting](resources/troubleshooting.md)
- [Glossary](resources/glossary.md)
- [Changelog](../CHANGELOG.md)
- [Roadmap](../future-enhancements.md)

## Quick Links

- [GitHub Repository](https://github.com/PriNova/nebulaflow)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=PriNova.nebulaflow)
- [Amp SDK Documentation](https://github.com/PriNova/amp-sdk)
- [React Flow Documentation](https://reactflow.dev/)

## Getting Help

### Documentation Issues
If you find issues in the documentation, please open an issue on GitHub.

### Technical Support
For technical support and questions:
1. Check the [FAQ](resources/faq.md)
2. Review the [Troubleshooting](resources/troubleshooting.md) guide
3. Open an issue on GitHub

### Community
Join our community for discussions, tips, and best practices.

## Contributing to Documentation

We welcome contributions to the documentation! See [Contributing Guidelines](contributing/guidelines.md) for details.

### Documentation Style Guide
- Use clear, concise language
- Include code examples where appropriate
- Link to related topics
- Keep documentation up to date with code changes

### Adding New Documentation
1. Create a new markdown file in the appropriate directory
2. Update the navigation in `mkdocs.yml`
3. Update the Table of Contents
4. Submit a pull request

## Building Documentation Locally

### Prerequisites
- Python 3.11+
- pip
- Git

### Installation
```bash
# Install MkDocs and plugins
pip install mkdocs mkdocs-material mkdocs-video pymdown-extensions

# Clone the repository
git clone https://github.com/PriNova/nebulaflow.git
cd nebulaflow

# Build the documentation
mkdocs build

# Serve locally
mkdocs serve
```

The documentation will be available at `http://127.0.0.1:8000`.

### Using GitHub Actions
The documentation is automatically deployed to GitHub Pages when changes are pushed to the `main` branch. See `.github/workflows/deploy-docs.yml` for the deployment workflow.

## Versioning

Documentation is versioned alongside the code. See the [Changelog](../CHANGELOG.md) for version history.

## License

Documentation is licensed under the same license as the NebulaFlow project. See [LICENSE](../LICENSE) for details.

---

*Last Updated: 2026-01-21*
