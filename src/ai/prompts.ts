/**
 * @file src/ai/prompts.ts
 * @description Functions for constructing AI prompts.
 */
import { ChatMessage } from '../types.js';

/**
 * Constructs a structured chat prompt with conversation history.
 * @param {ChatMessage[]} history - The conversation history.
 * @param {string} context - The retrieved codebase context.
 * @returns {string} The formatted prompt string.
 */
export function constructChatPrompt(history: ChatMessage[], context: string): string {
  const formattedHistory = history
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const systemPrompt = `You are an expert AI software architect and coding assistant.
Your goal is to help the user understand, improve, and work with their codebase. Analyze the user's query and the conversation history carefully.

- If the user asks for an **explanation** (e.g., "how does this work?"), use the provided <CODE CONTEXT> to give a specific, accurate answer.
- If the user asks for **improvements or a critique** (e.g., "how can I make this better?"), treat the provided <CODE CONTEXT> as the code to be reviewed. Provide actionable advice, best practices, and suggestions for refactoring.
- If the user asks a **general programming question** and the <CODE CONTEXT> is not relevant, feel free to ignore the context and answer from your general knowledge.

Always be concise, clear, and helpful.`;

  return `${systemPrompt}

<CODE CONTEXT>
${context}
</CODE CONTEXT>

<CONVERSATION HISTORY>
${formattedHistory}
</CONVERSATION HISTORY>

Assistant:`;
}

// The old constructPrompt can be kept for other commands or removed if no longer used.
export function constructPrompt(userQuery: string, context: string): string {
  return `You are an expert software architect. Analyze the provided code context and answer the user's question.

<context>
${context}
</context>

User Question: "${userQuery}"

Answer:`;
}

/**
 * Constructs a prompt for code generation.
 * @param {string} userPrompt - The user's instruction for what to generate.
 * @param {string} context - Relevant code snippets for style and context.
 * @returns {string} The formatted prompt string.
 */
export function constructGeneratePrompt(userPrompt: string, context: string): string {
  return `You are an expert code generator. Your task is to write a new, clean, and correct code snippet based on the user's request.
Use the provided <CODE CONTEXT> as a reference for style, formatting, and conventions.
Only output the raw code for the user's request. Do not include any explanations, markdown formatting, or any text other than the code itself.

<CODE CONTEXT>
${context}
</CODE CONTEXT>

User Request: "${userPrompt}"

Generated Code:`;
}

/**
 * Constructs a prompt for generating a unit test.
 * @param {string} symbolContent - The source code of the symbol(s) to test.
 * @param {string} framework - The testing framework to use (e.g., 'jest', 'vitest').
 * @returns {string} The formatted prompt string.
 */
export function constructTestPrompt(symbolContent: string, framework: string): string {
  return `You are an expert software quality assurance engineer specializing in automated testing.
Your task is to write a comprehensive and effective unit test for the provided code snippet using the ${framework} testing framework.
The test should cover the main functionality and at least one edge case.
Only output the raw, complete code for the test file. Do not include explanations, markdown, or any text other than the code itself.

<CODE TO TEST>
${symbolContent}
</CODE TO TEST>

${framework} test file:`;
}

/**
 * Defines the structure for a single step in an AI-generated plan.
 */
export interface PlanStep {
  operation: 'writeFile' | 'executeCommand' | 'readFile' | 'askUser';
  path?: string;
  content?: string;
  command?: string;
  question?: string;
  reasoning: string;
}

/**
 * Constructs a prompt that asks the AI to create a step-by-step plan.
 * @param userTask The high-level task from the user.
 * @param context Relevant code context for the task.
 * @returns The formatted prompt string.
 */
export function constructPlanPrompt(userTask: string, context: string): string {
  // FIX: Added a detailed one-shot example to guide the AI's response format.
  return `You are an expert AI agent. Your goal is to achieve the user's task by creating a step-by-step plan.
Analyze the user's request and the provided code context.
Generate a plan as a JSON array of objects. Each object must have a "reasoning" property explaining the step and an "operation" property.
You cannot ask for user input in the middle of a plan; all information must be inferred from the user's initial request.

The available operations are:
- "writeFile": Writes or overwrites content to a file. Requires "path" and "content" properties.
- "executeCommand": Executes a shell command. Requires a "command" property.
- "readFile": Reads a file to get information for a subsequent step. Requires a "path" property.

---
## Example ##
User Task: "Add a new function to the main utility file and then run the linter."

JSON Plan:
[
  {
    "reasoning": "First, I need to read the existing utility file to understand its current contents and conventions before adding a new function.",
    "operation": "readFile",
    "path": "src/utils.ts"
  },
  {
    "reasoning": "Now I will write the new function to the end of the utility file, including the original content.",
    "operation": "writeFile",
    "path": "src/utils.ts",
    "content": "<original content>\\n\\nexport function newFunction() {\\n  // ...\\n}"
  },
  {
    "reasoning": "Finally, I need to run the linter to ensure the new code meets the project's style guidelines.",
    "operation": "executeCommand",
    "command": "npm run lint"
  }
]
---

Your response MUST be only the raw JSON array.

<CODE CONTEXT>
${context}
</CODE CONTEXT>

User Task: "${userTask}"

JSON Plan:`;
}

export const ALL_TOOLS = {
    writeFile: 'Writes/overwrites a file. Args: "path", "content".',
    executeCommand: 'Executes a shell command. Args: "command".',
    readFile: 'Reads a file to gather information. Args: "path".',
    listFiles: 'Lists all files in the current project. Args: none.',
    listSymbols: 'Lists all functions and classes in a file. Args: "path".',
    readSymbol: 'Reads the content of a specific function or class. Args: "path", "symbolName".',
    getGitDiff: 'Gets the diff between two commits. Args: "startCommit", "endCommit".',
    getRecentCommits: 'Gets a list of recent commits. Args: none.',
    askUser: 'Asks the user a question and gets their response. Args: "question".',
    createPlan: 'Creates a step-by-step plan for a high-level goal. Args: "goal".',
    finish: 'Call this when the task is complete. Args: "summary".',
};

export type ToolName = keyof typeof ALL_TOOLS;

/**
 * Constructs a prompt for a ReAct-style agent.
 * @param userTask The original high-level task.
 * @param history A string representing the history of actions and observations.
 * @returns The formatted prompt string.
 */
export function constructReActPrompt(
    userTask: string,
    history: string,
    initialContext: string,
    availableTools: (keyof typeof ALL_TOOLS)[]
): string {
    const toolDescriptions = availableTools
        .map(toolName => `- "${toolName}": ${ALL_TOOLS[toolName]}`)
        .join('\n');

    return `You are an expert AI agent. Your goal is to achieve the user's task by reasoning and taking one action at a time.
You have access to the following tools:
${toolDescriptions}
- "finish": Call this when the task is complete. Args: "summary".

On each turn, you must respond with a JSON object containing your "thought" process and the next "action" you will take.

---
## Example ##
User Task: "Read the main entry point file."
Your JSON response:
{
  "thought": "The user wants me to read the main entry point. Based on the initial context, I see a 'package.json' which likely defines the entry point. I should read that file first to be sure.",
  "action": {
    "tool": "readFile",
    "path": "package.json"
  }
}
---

<INITIAL CONTEXT>
Here is a list of files in the current project:
${initialContext}
</INITIAL CONTEXT>

<TASK HISTORY>
${history}
</TASK HISTORY>

User Task: "${userTask}"

Your JSON response:`;
}
/**
 * Constructs a prompt that asks the AI to analyze a git diff.
 * @param {string} diffContent - The raw git diff output.
 * @returns {string} The formatted prompt string.
 */
export function constructDiffAnalysisPrompt(diffContent: string): string {
  return `You are an expert senior software engineer performing a code review.
Analyze the following git diff and provide a high-level summary of the changes.
Focus on the overall purpose of the changes, identify the most significant modifications, and point out any potential issues or improvements.
Structure your analysis with clear headings.

<GIT DIFF>
${diffContent}
</GIT DIFF>

Analysis:`;
}

/**
 * Constructs a prompt to summarize a single source file.
 * @param filePath The path of the file.
 * @param fileContent The content of the file.
 * @returns The formatted prompt string.
 */
export function constructFileSummaryPrompt(filePath: string, fileContent: string): string {
  return `Analyze the following source code file from the path "${filePath}".
Provide a concise, one-paragraph summary of its primary purpose, its key functions or classes, and its main responsibilities within the application.

<FILE CONTENT>
${fileContent}
</FILE CONTENT>

Summary:`;
}

/**
 * Constructs a prompt to generate a final report from a collection of file summaries.
 * @param summaries A string containing all the individual file summaries.
 * @returns The formatted prompt string.
 */
export function constructFinalReportPrompt(summaries: string): string {
  return `You are an expert software architect.
Analyze the following collection of file summaries from a codebase.
Based *only* on these summaries, generate a high-level technical README.md for the entire project.
The report should include:
1.  **Overall Architecture:** A brief description of the project's structure.
2.  **Key Components:** A breakdown of the main modules described in the summaries and their responsibilities.
3.  **Potential Improvements:** Suggest 2-3 potential feature enhancements or refactorings based on the summaries.

<FILE SUMMARIES>
${summaries}
</FILE SUMMARIES>

Full README.md Report:`;
}

export function constructInitPrompt(context: string): string {
  return `You are an expert software architect. Analyze the provided code context and generate a Kinch_Code.md file.
This file should contain:
- Tech Stack: A declaration of the project's tools and versions.
- Project Structure: An outline of key directories and their roles.
- Commands: A list of the most important npm, bash, or other scripts for building, testing, linting, and deploying the project.
- Code Style & Conventions: Explicit guidelines on formatting, naming conventions, import/export syntax, and other stylistic rules.
- Repository Etiquette: Instructions on branch naming, commit message formats, and whether to merge or rebase.
- Core Files & Utilities: Pointers to essential files.
- The "Do Not Touch" List: A critical section specifying things the AI should avoid.

<context>
${context}
</context>

Kinch_Code.md:`;
}

export function constructInitBatchPrompt(contextChunk: string): string {
  return `You are an expert software architect. Analyze the provided batch of code files.
Your goal is to extract key information that will be used to build a project context file (Kinch_Code.md).
From this batch of files, identify and list the following in a concise summary:
- Tech Stack: Any languages, frameworks, or key libraries mentioned (e.g., in package.json, import statements).
- Project Structure: Note the purpose of any directories if it's clear from the file paths.
- Commands: Any build/test/run scripts found (e.g., in package.json, Makefile).
- Code Style & Conventions: Any obvious coding patterns, naming conventions, or style rules.
- Core Files & Utilities: Point out any files that seem central or contain utility functions.

Do not generate the full Kinch_Code.md file yet. Just provide a summary of your findings from this specific batch of files.

<context>
${contextChunk}
</context>

Summary of this batch:`;
}

export function constructInitFinalPrompt(summaries: string): string {
  return `You are an expert software architect. You have been provided with several summaries, each analyzing a different part of a codebase.
Your task is to synthesize these summaries into a single, cohesive, and well-structured Kinch_Code.md file.
The final file should be lean, intentional, and written for an AI assistant, not a human developer. Use short, declarative bullet points.

Combine the information from the provided summaries to create the following sections:
- Tech Stack
- Project Structure
- Commands
- Code Style & Conventions
- Repository Etiquette (if information is available)
- Core Files & Utilities
- The "Do Not Touch" List (if information is available)

Do not include any commentary or explanations outside of the markdown file structure. Your entire output should be the raw Kinch_Code.md file content.

<SUMMARIES>
${summaries}
</SUMMARIES>

Kinch_Code.md:`;
}