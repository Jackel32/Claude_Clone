# Claude Code Clone

## Project Overview
This project is a sophisticated AI-powered code analysis and modification tool. It leverages advanced language models to understand, refactor, and test code, aiming to enhance developer productivity.

## Features
* **Code Analysis:** Deep understanding of code structure and logic.
* **Code Modification:** AI-driven refactoring, bug fixing, and style improvements.
* **Chat Interface:** Interactive chat for discussing and implementing code changes.
* **Extensible Architecture:** Support for multiple AI providers and custom commands.

## Architecture
The project follows a modular, CLI-first architecture:
* **Core Logic:** Handles AI interactions and command orchestration.
* **AI Providers:** Interfaces with AI models like Gemini.
* **Codebase Management:** Tools for scanning, indexing, and analyzing code via ASTs.
* **Commands:** A system for defining and executing specific developer tasks.

## Setup Instructions
1.  **Prerequisites:** Node.js (LTS) and npm/yarn.
2.  **Installation:**
    ```bash
    git clone <repository-url>
    cd Claude-Code-Clone
    npm install
    ```
3.  **Configuration:** Add your AI provider API key to `~/.claude-code/config.json`.
4.  **Running the Application:**
    * For an interactive menu: `npm start`
    * For direct commands: `npm run cli -- <command>` (e.g., `npm run cli -- index`)
5.  **Running Tests:** `npm test`