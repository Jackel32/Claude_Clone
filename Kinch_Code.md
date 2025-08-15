## Kinch_Code.md

### Tech Stack

*   Node.js
*   TypeScript
*   Vitest
*   ESLint
*   Tree-sitter
*   Yargs
*   Inquirer
*   Supertest
*   `ws`
*   `vectra`
*   `pino`
*   `lowdb`
*   `diff`
*   `ora`
*   `cli-progress`
*   `@google/generative-ai` (or similar)

### Project Structure

*   `src/`: Source code
    *   `ai/`: AI modules (prompts, providers, context)
    *   `codebase/`: Codebase interaction (scanning, indexing, parsing, vectorizing, caching)
    *   `commands/`: CLI command logic
        *   `handlers/`: Command implementations
    *   `config/`: Configuration loading
    *   `core/`: Core application logic (agent execution, database, indexing)
    *   `errors/`: Custom error types
    *   `logger/`: Logging utility
    *   `types/`: Shared types and interfaces
    *   `app.ts`: Main application loop/menu
    *   `cli.ts`: CLI entry point
    *   `index.ts`: Application entry point
*   `tests/`: Test suite
    *   `fixtures/`: Test codebases
    *   `temp-*`: Temporary test directories
*   `dist/`: Compiled output
*   `grammars/`: Tree-sitter grammars
*   `public/`: Static assets

### Commands

*   `npm start`: Start interactive main menu.
*   `npm run cli -- <command>`: Execute specific commands.
    *   `index [path]`: Analyze and cache codebase.
        *   `--force` / `-f`: Re-index.
    *   `report`: Generate analysis report.
    *   `chat`: Start conversational session.
    *   `task`: Execute AI Agent task.
    *   `menu`: Show interactive main menu.
    *   `init`: Initialize or regenerate `Kinch_Code.md`.
*   `--profile` / `-p`: Specify configuration profile.
*   **Agent Tools (Internal)**: `writeFile`, `executeCommand`, `readFile`, `listFiles`, `listSymbols`, `readSymbol`, `queryVectorIndex`, `askUser`, `createPlan`.

### Code Style & Conventions

*   **Language**: TypeScript.
*   **Naming**:
    *   Variables/Functions: `camelCase`
    *   Classes/Interfaces: `PascalCase`
    *   Files/Directories: `kebab-case`
*   **Async**: `async/await` is standard.
*   **Imports**: Use `.js` extension.
*   **ESLint**: Enforces rules (e.g., `no-console` allowing `warn`/`error`, `@typescript-eslint/no-unused-vars` warn, `@typescript-eslint/no-explicit-any` warn).
*   **Error Handling**: Custom error types (`AppError`, `ConfigError`, `ApiKeyError`, `VectorIndexError`), `try...catch`.
*   **Logging**: `pino` for structured logging.
*   **Promises**: `util.promisify` used.
*   **Constants**: `const` for non-reassigned variables.
*   **Comments**: JSDoc style for documentation.
*   **CLI**: `inquirer`, `ora`, `cli-progress` for interaction and feedback.
*   **JSON**: Robust extraction from AI responses.
*   **Agent Pattern**: ReAct (Reasoning + Acting).

### Core Files & Utilities

*   `src/app.ts`: Main interactive menu logic.
*   `src/cli.ts`: CLI argument parsing and command dispatch.
*   `src/index.ts`: Application entry point (starts menu).
*   `src/config/index.ts`: Configuration loading (`~/.claude-code/config.json`).
*   `src/codebase/ast.ts`: Code parsing (Tree-sitter), symbol extraction.
*   `src/codebase/vectorizer.ts`: Vector database operations.
*   `src/codebase/scanner.ts`: Project directory scanning.
*   `src/ai/prompt-library.ts`: AI task definitions and prompts.
*   `src/ai/prompts.ts`: AI prompt construction utilities.
*   `tests/setup.ts`: Vitest global setup (parser initialization).
*   `eslint.config.js`: ESLint configuration.
*   `tsconfig.json`: TypeScript compiler configuration.
*   `src/core/agent-core.ts`: ReAct agent orchestration.
*   `src/core/index-core.ts`: Codebase indexing logic (`runIndex`, `runInit`).
*   `src/commands/handlers/chat.ts`: Interactive chat session management.
*   `src/commands/handlers/task.ts`: Complex task execution via agent.
*   `src/ai/index.ts`: AI utilities, prompt construction, tool definitions.
*   `src/ai/providers/interface.ts`: AI provider contract.
*   `src/ai/providers/gemini.ts`: Gemini AI provider implementation.
*   `src/commands/handlers/utils.ts`: Command handler utilities (`extractCode`, `confirmAndApplyChanges`, `extractJson`).
*   `src/core/db.ts`: `lowdb` database management (chat history).
*   `src/logger/index.ts`: `pino` logger configuration.

### The "Do Not Touch" List

*   No specific files or directories are designated as "Do Not Touch" in the provided summaries.