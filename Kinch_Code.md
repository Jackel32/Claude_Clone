# Kinch_Code.md

## Tech Stack

*   **Languages:** TypeScript, JavaScript
*   **Runtime:** Node.js
*   **CLI Argument Parsing:** `yargs`
*   **Interactive CLI:** `inquirer`, `ora`, `chalk`, `cli-progress`
*   **File System Operations:** Node.js `fs` module (`fs/promises`)
*   **Path Manipulation:** Node.js `path` module
*   **Hashing:** Node.js `crypto` module
*   **AST Parsing:** `tree-sitter` (TypeScript, Python, C#, C, C++, Ada)
*   **Ignoring Files:** `ignore` library
*   **Vector Database:** `vectra` (for `LocalIndex`)
*   **AI:** `@google/generative-ai` (Gemini models: `gemini-2.5-flash-lite`, `gemini-2.5-flash-embedding`)
*   **Testing Framework:** `vitest`
*   **HTTP Testing:** `supertest`
*   **Logging:** `pino`, `pino-pretty`
*   **Utilities:** `util` (`promisify`), `child_process` (`exec`), `os`, `diff`, `lowdb`

## Project Structure

*   `src/`
    *   `ai/`: AI provider interfaces, implementations, prompts, context gathering.
    *   `codebase/`: Codebase analysis tools (AST, scanning, indexing, vectorizing).
    *   `commands/`: CLI command handlers and parsing logic.
        *   `handlers/`: Specific command implementations.
    *   `config/`: Configuration loading and schema.
    *   `core/`: Core agent logic, indexing, database management.
    *   `errors/`: Custom error types.
    *   `logger/`: Logging setup.
    *   `types/`: Shared TypeScript types and interfaces.
    *   `app.ts`: Main application entry point for interactive menu.
    *   `cli.ts`: CLI argument parsing and command dispatch.
    *   `index.ts`: Application entry point.
    *   `server.ts`: API server (implied).
*   `tests/`: Unit and end-to-end tests.
    *   `fixtures/`: Sample code files.
    *   `setup.ts`: Global Vitest setup.
*   `dist/`: Compiled JavaScript output.
*   `.github/workflows/`: CI/CD workflows (implied).
*   `docs/adr/`: Architecture Decision Records (implied).

## Commands

*   `npm start`: Starts the interactive main menu.
*   `npm run cli -- <command>`: Executes specific commands via `src/cli.ts`.
    *   `index [path]`: Analyzes and caches the codebase.
        *   `--force` / `-f`: Forces re-indexing.
        *   `--output-dir`: Specifies analysis storage.
    *   `report`: Generates a high-level analysis report.
    *   `chat`: Starts an interactive AI chat session.
    *   `task`: Executes an AI agent task.
    *   `menu`: Displays the interactive main menu.
    *   `init`: Initializes/regenerates `Kinch_Code.md`.
*   `npm test`: Runs the test suite.

## Code Style & Conventions

*   **Language:** TypeScript.
*   **File Naming:** `kebab-case`.
*   **Directory Naming:** `kebab-case`.
*   **Variable/Function Naming:** `camelCase`.
*   **Class/Interface Naming:** `PascalCase`.
*   **Async Operations:** `async/await`.
*   **Imports:** Uses `.js` extension for ES module imports.
*   **Linting:** ESLint configured (`eslint.config.js`).
    *   `no-console`: Disallows `log`, `info`; allows `warn`, `error`.
*   **Error Handling:** Custom error classes (`AppError`, `ConfigError`, `ApiKeyError`, `VectorIndexError`). `try...catch` blocks used.
*   **Configuration:** JSON configuration (`~/.claude-code/config.json`), environment variables prioritized for API keys.
*   **Comments:** JSDoc comments for documentation.
*   **Logging:** `pino` instances used.
*   **Promises:** `util.promisify` used for older Node.js APIs.
*   **Code Chunking:** AST (Tree-sitter) used for meaningful code unit chunking.
*   **AI Interaction:** `AIProvider` interface. Prompts constructed using helper functions.
*   **Agent Workflow:** "Gather-plan-confirm" (ReAct-style) workflow (`runAgent`).
*   **AI Response Parsing:** Utility functions (`extractJson`, `extractCode`).
*   **User Interaction:** `inquirer` for interactive prompts.

## Core Files & Utilities

*   `src/index.ts`: Application entry point, starts interactive menu.
*   `src/cli.ts`: CLI argument parsing and command dispatch.
*   `src/app.ts`: Orchestrates the main interactive menu.
*   `src/codebase/ast.ts`: Multi-language AST parsing using Tree-sitter.
*   `src/codebase/scanner.ts`: Scans project directory, respects ignore files.
*   `src/codebase/indexer.ts`: Manages file analysis caching and staleness checks.
*   `src/codebase/vectorizer.ts`: Manages vector database (creation, upserting, querying).
*   `src/ai/provider-factory.ts`: Factory for creating AI provider instances.
*   `src/ai/prompts.ts`: Functions for constructing AI prompts.
*   `src/ai/prompt-library.ts`: Library of predefined AI tasks and prompts.
*   `src/config/index.ts`: Loads and manages application configuration.
*   `src/core/agent-core.ts`: Core AI agent logic (planning, execution).
*   `src/core/index-core.ts`: Manages project indexing and `Kinch_Code.md` generation.
*   `src/commands/handlers/chat.ts`: Implements interactive chat, session management, history persistence.
*   `src/commands/handlers/task.ts`: Orchestrates interactive task selection and execution.
*   `src/commands/handlers/utils.ts`: Utility functions for file operations, diffing, user prompts.
*   `src/core/db.ts`: Manages persistent chat history using `lowdb`.
*   `src/logger/index.ts`: Configures and exports the application logger.
*   `tests/setup.ts`: Global Vitest setup (e.g., AST parser initialization).
*   `Kinch_Code.md`: Meta-documentation file.

## The "Do Not Touch" List

*   (No specific files or directories identified as "Do Not Touch" in the provided summaries.)