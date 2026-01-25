# Glossary

This glossary defines key terms used in NebulaFlow documentation and the extension interface.

## A

**Approval**  
A security feature that requires user confirmation before executing potentially dangerous operations, such as CLI commands. Approval requests appear as VS Code notifications.

**Amp SDK**  
The Amp Software Development Kit, used by NebulaFlow to interact with LLM providers. It provides APIs for creating LLM sessions, streaming responses, and handling tool calls.

**Accumulator Node**  
A node that concatenates text from multiple inputs into a single output, accumulating values across multiple executions (e.g., in loops).

## C

**CLI Node**  
A node that executes shell commands or scripts. It can run in command mode (single command) or script mode (multi‑line script), with configurable safety levels and approval requirements.

**Condition Node**  
See **If/Else Node**.

**Connection**  
See **Edge**.

## E

**Edge**  
A visual connection between two nodes in the workflow graph. Edges define data flow and execution dependencies: data flows from the source node's output to the target node's input.

**Execution**  
The process of running a workflow. Execution starts from nodes with no incoming edges and proceeds according to dependencies. NebulaFlow supports parallel execution of independent nodes.

**Extension**  
The VS Code extension that hosts NebulaFlow. It manages the webview, handles workflow execution, and communicates with the underlying LLM SDKs.

## I

**If/Else Node**  
A logic node that branches workflow execution based on a condition. It evaluates a JavaScript expression (using template variables) and routes data to either the true or false output branch.

**Input Node**  
See **Text Node**.

## L

**LLM Node**  
A node that interacts with Large Language Models. It sends a prompt (optionally with images) to an LLM provider (Amp SDK or OpenRouter) and streams the response.

**Loop Node**  
A pair of nodes (**Loop Start** and **Loop End**) that enable iterative processing. The Loop Start node defines the iteration variable and maximum iterations; the Loop End node marks the end of each iteration.

## N

**Node**  
A building block of a workflow. Each node performs a specific operation (e.g., LLM, CLI, condition, variable). Nodes are connected by edges to form a graph.

**Node Execution Status**  
The current state of a node during execution: `running`, `completed`, `error`, `interrupted`, `pending_approval`.

## P

**Preview Node**  
A node that displays its input data for debugging purposes. It shows the raw text or JSON output of the previous node.

**Protocol**  
The message contract between the VS Code extension (backend) and the webview (frontend). It defines the types of messages exchanged, such as node execution status, errors, and user actions.

## S

**Safety Level**  
A setting for CLI nodes that determines how strictly commands are sanitized. `safe` uses a denylist to block dangerous commands; `advanced` disables sanitization (use with caution).

**Script Mode**  
A mode for CLI nodes where the content is treated as a shell script (multi‑line) rather than a single command. Supports stdin piping and environment variable mapping.

**Subflow**  
A reusable workflow component that can be embedded in a main workflow. Subflows have their own graph of nodes and define input/output ports for data exchange.

**Subflow Input Node**  
A node that defines an input port for a subflow. It receives data from the parent workflow and makes it available inside the subflow.

**Subflow Output Node**  
A node that defines an output port for a subflow. It sends data from the subflow back to the parent workflow.

## T

**Text Node**  
A node that provides static text input to a workflow. Formerly called "Input Node".

**Tool Call**  
A request from an LLM to execute a tool (e.g., Bash, filesystem operation). NebulaFlow can approve or reject tool calls based on user input or the `dangerouslyAllowAll` setting.

**Tool Result**  
The output of a tool call, which is sent back to the LLM as part of the conversation thread.

## V

**Variable Node**  
A node that stores a value in a named variable. The variable can be referenced in other nodes using template syntax (`${variableName}`).

**Variable State**  
The collection of all variables and their current values during workflow execution. Variables are scoped to the workflow session.

## W

**Webview**  
The graphical user interface of NebulaFlow, built with React and React Flow. It runs inside a VS Code webview panel and communicates with the extension via the protocol.

**Workflow**  
A directed graph of nodes and edges that defines a sequence of operations. Workflows can be saved, edited, and executed.

**Workflow Execution**  
The runtime process of a workflow, managed by the extension. It handles node scheduling, parallel execution, approval requests, and error handling.

---

*Last Updated: 2026-01-21*
