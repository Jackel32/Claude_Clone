# TODO: Feature Enhancements & Creative Roadmap

## Tier 1: Enhancing Core Intelligence & Interaction

### Truly Interactive Chat-Driven Development

* **Live Refactoring:** Instead of just showing a diff, allow the AI to propose changes in the chat, which the user can accept/reject. Upon acceptance, the AI applies the changes to the file in real-time.
* **Follow-Up Actions:** After applying a change, the AI should proactively suggest next steps, like "I've added the function. Would you like me to generate a unit test for it now?" or "This change may affect `other-file.ts`. Should I check for necessary updates there?".

### Hyper-Aware Contextual Understanding

* **AST-Powered Chat:** When a user mentions a function like `explain runIndex`, the chat should automatically use the AST to fetch the full content of that specific function, providing pinpoint context to the AI.
* **Dependency-Awareness:** Integrate the dependency graph into the chat context. If a user asks about a function, the AI could respond with, "This function is used by `componentA.ts` and `serviceB.ts`. Its test file seems to be `runIndex.test.ts`. How can I help you with it?".

### "MCP" (Master Control Program) Client Integration

* **Persistent AI Supervisor:** Develop a long-running "MCP" agent that monitors the codebase. It could run in the background, automatically indexing changes, identifying potential issues (like new TODOs, failing tests, and security vulnerabilities), and alerting the user.
* **VS Code Extension:** Create a VS Code extension that acts as a client for the MCP. This would provide a UI for interacting with the agent, displaying alerts, and triggering tasks directly from the editor.
* **Project Dashboard:** The MCP client could feature a dashboard summarizing project health, recent activities, and suggestions from the AI.

## Tier 2: New & Automated Capabilities

### Automated Documentation Suite (`kinch-code docs`)

* **From Code to DOCUMENTATION.md:** A command that scans the entire project, uses the AI to summarize every module and public function, and generates a complete `DOCUMENTATION.md` file.
* **API Documentation:** Automatically generate OpenAPI/Swagger documentation for API routes by analyzing the route definition files.

### Intelligent Test Generation (`kinch-code test`)

* **Targeted Unit Tests:** Generate unit tests for a specific file or function (e.g., `kinch-code test src/utils.ts`) that intelligently mock dependencies found in the dependency graph.
* **Edge-Case Analysis:** Have the AI analyze a function's logic to propose and write tests for specific edge cases (e.g., null inputs, empty arrays, error conditions).

### Advanced Git Integration (`kinch-code git`)

* **AI-Powered Code Review (`kinch-code git review`):** The AI analyzes staged changes and provides a summary of the changes, potential bugs, and style violations before you commit.
* **Automated Commit Messages (`kinch-code git commit`):** Automatically generate a conventional commit message (e.g., `feat: add user authentication endpoint`) based on the staged changes.
* **Release Notes Generation:** Analyze commits between two tags and draft user-facing release notes.

## Tier 3: Extensibility & Polish

### Dynamic Plugin System for Tasks

* Allow users to define their own custom tasks in a local project file (e.g., `.kinch/tasks.js`). The tool would dynamically load these into the "Execute a Task" menu, making it highly extensible.

### Multi-Agent Workflows

* Allow chaining of agents. For example, a "Developer Agent" could write a new feature, and upon completion, automatically trigger a "Tester Agent" to write unit tests for the newly created code.

### Performance and Optimization

* **Cache Summaries:** Cache AI-generated summaries of files so that subsequent commands (like `docs` or `chat`) don't need to re-analyze unchanged files.

---

## Tier 1: Foundational MCP Integration

### Transform the CLI into an MCP Host:

* Refactor the core application (`src/app.ts`, `src/cli.ts`) to act as an MCP Host. This means its primary role will be to manage the AI model and facilitate communication between MCP clients and servers.
* Implement an internal MCP client that translates the AI's requests into the standardized JSON-RPC 2.0 messages used by the protocol. The official TypeScript SDK can be used for this.

### Create a "Codebase" MCP Server:

* Bundle all your existing file system and code analysis tools (`readFile`, `writeFile`, `listSymbols`, `getSymbolContent`, `scanProject`, `queryVectorIndex`) into a single, local MCP server.
* This server would expose tools like `codebase:readFile`, `codebase:listSymbols`, etc., to the AI model in a standardized way. This makes your toolset discoverable by any MCP-compatible AI.

### Standardize the Agent Loop:

* Modify the ReAct agent in `src/core/agent-core.ts` to consume the list of available tools directly from connected MCP servers instead of the hardcoded `ALL_TOOLS` object. The agent's thought process will now be about choosing from MCP-provided tools.

## Tier 2: Expanding the MCP Ecosystem

### Connect to External MCP Servers:

* Implement functionality to connect to third-party MCP servers. Add a configuration section in `~/.claude-code/config.json` for users to register remote servers.
* **Use Case:** Connect to the official open-source Git MCP server to replace your custom Git integration. This would allow the AI to perform complex git operations like analyzing the commit history or reviewing staged changes through a standard interface.
* **Use Case:** Connect to a GitHub MCP server to allow the agent to read issues, analyze pull requests, or search for repositories.

### AI-Powered Test Generation via MCP:

* Create a new `testing:generateUnitTest` tool in your local MCP server.
* When called, this tool would use existing tools (like `codebase:readSymbol`) to get the necessary code, then generate a test file, and finally use `codebase:writeFile` to save it. This encapsulates a complex workflow into a single, powerful, and reusable MCP tool.

### MCP-based Documentation Generation (`kinch-code docs`):

* Create a workflow where the agent uses `codebase:scanProject` and `codebase:readFile` via MCP to gather context, then synthesizes a `DOCUMENTATION.md` file. This demonstrates how MCP can be used for complex, read-only orchestration.

## Tier 3: Advanced Agentic Capabilities

### Dynamic Tool Discovery (Agent Mode):

* Integrate with an MCP registry service. This would allow the agent, when faced with a task it can't solve, to search the registry for a public server that provides the necessary tool.
* **Use Case:** If the user asks, "Deploy the latest changes to Vercel," the agent could find and dynamically connect to a community-built "Vercel MCP Server" to complete the task.

### Interactive Multi-Agent System:

* Develop specialized agents (e.g., a "Developer Agent," a "Tester Agent," a "Docs Agent").
* Allow these agents to collaborate on a single task by passing information and requests to each other through the shared MCP servers. For instance, the Developer Agent could implement a feature and then call a tool on a "CI/CD" MCP server, which triggers the Tester Agent.

### VS Code Extension as an MCP Client UI:

* Build a Visual Studio Code extension that acts as a graphical user interface for your MCP host. This would provide a much richer user experience than the command line.
* The extension could feature a "Toolbox" UI that shows all connected MCP servers and their available tools, allowing users to enable/disable them for the AI on the fly, similar to the new features in Visual Studio.