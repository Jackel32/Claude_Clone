# Kinch Code - AI-Powered Coding Assistant

Kinch Code is a sophisticated, multi-interface tool designed to be your AI pair programmer. It allows you to interact with, analyze, and modify your codebases through a feature-rich web UI, an interactive command-line menu, and a powerful AI agent.

Built with a modular and extensible architecture, it leverages a local vector database for semantic understanding and an Abstract Syntax Tree (AST) parser for deep, structural code analysis.

## Features

### 🖥️ User Interfaces
* **Web UI:** A full-featured, browser-based interface with a tabbed layout, real-time chat, and interactive workflows for all AI tasks.
* **Interactive CLI:** A menu-driven command-line interface for a guided, terminal-based experience.
* **Direct CLI:** A standard command-line interface for scripting and power users (e.g., `kinch-code test <file>`).

### 🤖 Core AI Capabilities
* **AI Agent Mode**: Give high-level tasks (e.g., "add ESLint to this project") and the AI will generate, propose, and execute a multi-step plan to accomplish the goal, showing its reasoning in real-time.
* **Conversational Chat (RAG)**: Have a natural language conversation with your codebase. The assistant uses a vector index (RAG) and AST analysis to provide contextually-aware answers.
* **Code Generation**: Create new functions, classes, or test files from a simple prompt, with an option to save directly to a file.
* **Code Refactoring**: Request specific refactors for any file, review a side-by-side diff of the proposed changes, and approve them to be written to disk.
* **Documentation Generation**: Automatically add JSDoc comments to any file, and review/approve the changes via a diff.
* **Test Generation**: Select a file and a specific function/class to automatically generate a unit test using a framework of your choice (e.g., Jest, Vitest).

### ⚙️ Developer & Workflow Tools
* **Interactive Git Analysis**: Get an interactive list of recent commits and view a side-by-side diff of the changes between any two points in the history, complete with an AI-generated summary of the changes.
* **Intelligent File Pickers**: UI features a collapsible file-tree and a pre-filtered list of testable files to make selection fast and intuitive.
* **Project Reporting**: Generate a high-level summary of the entire project's architecture and purpose.
* **Persistent Codebase Indexing**: Uses a local vector database to store an index of your code, only re-indexing files that have changed.

## Architecture
* **Stack**: Node.js, TypeScript, Express.js, WebSockets
* **Module System**: Modern ES Modules (ESM)
* **AI Providers**: Modular "Strategy" pattern allows for easily adding different AI backends (e.g., Anthropic, OpenAI).
* **UI**: Decoupled core logic allows for both a command-line interface (`inquirer`) and a web interface (HTML/CSS/JS) to be powered by the same backend.
* **Persistence**: Uses a local file-based vector database (`vectra`) for RAG.
* **Containerization**: Fully containerized with a multi-stage `Dockerfile` and managed with `docker-compose`.

## How to Run

### Docker (Recommended for Web UI)
1.  Create an `.env` file from the project root (or rename the example).
2.  Customize the `CODE_TO_ANALYZE_PATH` and `CONFIG_PATH` variables in the `.env` file.
3.  Run `docker-compose up --build`.
4.  Open your browser to `http://localhost:3000`.

### Local Development (CLI)
1.  Run `npm install`.
2.  Run `npm run build`.
3.  **For the interactive menu:** `npm run start`.
4.  **For direct commands:** `npm run cli -- <command> [options]`.