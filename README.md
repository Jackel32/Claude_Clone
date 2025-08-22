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

## Setup and Usage
Follow these steps to set up and run the application as a global command-line tool.

**1. Prerequisites**
Ensure you have Node.js (v18 or higher) and npm installed on your system.

**2. Installation & Configuration**
First, clone the repository and install the necessary dependencies.
```bash
git clone <repository-url>
cd Claude-Code-Clone
npm install
```
Next, add your AI provider API key to the configuration file located at `~/.claude-code/config.json`.

**3. Build the Project**
Compile the TypeScript source code into JavaScript. This creates a `dist` directory containing the executable files needed to run the tool.
```bash
npm run build
```

**4. Link the Command**
To make the `kinch-code` command available anywhere on your system, use npm to create a global link.
```bash
npm link
```
This command creates a symbolic link from your global `node_modules` to your project, allowing you to run `kinch-code` from any directory.

**5. Running the Application**
Once linked, you can navigate to any project directory you want to analyze and use the tool.

* **For the interactive menu:**
```bash
    kinch-code menu
```
* **For direct commands:**
```bash
    # cd into the directory you want to analyze
    cd /path/to/your/project

    # Index the current directory (the path is optional)
    kinch-code index

    # Start a chat session with the codebase
    kinch-code chat
```
**6. Running Tests**
To run the included test suite:
```bash
npm test
```


TODO:
1. Enhancing Core Functionality
Interactive Code Modification in Chat: Allow the AI in the chat command to not just answer questions but also propose code changes. It could generate a diff of the proposed change, show it to you for approval, and then apply it to the file. This would make the chat feature much more powerful and action-oriented.

Smarter Context for Chat: Augment the vector search context. When a user's query mentions a specific function or class (e.g., "explain the runIndex function"), use the AST to find that exact symbol and add its full source code to the prompt, in addition to the vector search results. This provides the AI with more precise, targeted information.

2. Adding New Commands & Capabilities
Automated Documentation Generation (kinch-code docs): Create a new command that scans the entire project, uses the AI to summarize key modules and functions, and generates a comprehensive DOCUMENTATION.md file.

Automated Test Generation (kinch-code test): Build a command that can automatically write unit tests for a specified file or function. For example, kinch-code test src/utils.ts would create a src/utils.test.ts file with relevant test cases.

Deeper Git Integration (kinch-code git ...):

kinch-code git review: Have the AI analyze your staged git changes and provide a code review summary.

kinch-code git commit: Automatically generate a conventional commit message based on your staged changes.

4. Extensibility
Plugin System for Custom Tasks: Allow users to define their own custom tasks in a local file (e.g., kinch-tasks.js). The application could dynamically load these tasks into the "Execute a Task" menu, making the tool highly extensible for different teams and workflows.