/**
 * @file src/ai/prompts.ts
 * @description Functions for constructing AI prompts.
 */
import { ChatMessage } from '../types.js'; // Import from the new location

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

  // FIX: This new, more detailed system prompt gives the AI more nuanced instructions.
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
 * Constructs a prompt for refactoring code.
 * @param {string} userRequest - The user's instruction for how to refactor.
 * @param {string} codeContent - The original code to be refactored.
 * @returns {string} The formatted prompt string.
 */
export function constructRefactorPrompt(userRequest: string, codeContent: string): string {
  return `You are an expert senior software engineer specializing in code refactoring.
Your task is to rewrite the provided code based on the user's request.
Adhere to modern best practices, improve readability, and maintain existing functionality.
Only output the raw, complete, and refactored code for the entire file. Do not include explanations, markdown, or any text other than the code itself.

<USER REQUEST>
${userRequest}
</USER REQUEST>

<ORIGINAL CODE>
${codeContent}
</ORIGINAL CODE>

Refactored Code:`;
}

/**
 * Constructs a prompt for adding documentation to code.
 * @param {string} codeContent - The original code needing documentation.
 * @returns {string} The formatted prompt string.
 */
export function constructDocsPrompt(codeContent: string): string {
  return `You are an expert technical writer.
Your task is to add comprehensive JSDoc comments to all exported functions, classes, methods, and types in the provided code.
Do not change any of the existing code. Only add documentation.
Return the entire, complete file content with the new documentation added.
Only output the raw code. Do not include explanations, markdown, or any text other than the code itself.

<ORIGINAL CODE>
${codeContent}
</ORIGINAL CODE>

Code with Documentation:`;
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
  return `You are an expert AI agent. Your goal is to achieve the user's task by creating a step-by-step plan.
Analyze the user's request and the provided code context.
Generate a plan as a JSON array of objects. Each object must have a "reasoning" property explaining the step.
You cannot ask for user input in the middle of a plan; all information must be inferred from the user's initial request.

The available operations are:
- "writeFile": Writes or overwrites content to a file. Requires "path" and "content" properties.
- "executeCommand": Executes a shell command. Requires a "command" property.
- "readFile": Reads a file to get information for a subsequent step. Requires a "path" property.

Your response MUST be only the raw JSON array.

<CODE CONTEXT>
${context}
</CODE CONTEXT>

User Task: "${userTask}"

JSON Plan:`;
}

/**
 * Constructs a prompt for a ReAct-style agent.
 * @param userTask The original high-level task.
 * @param history A string representing the history of actions and observations.
 * @returns The formatted prompt string.
 */
export function constructReActPrompt(userTask: string, history: string, initialContext: string): string {
  // The new, more detailed prompt with a one-shot example
  return `You are an expert AI agent. Your goal is to achieve the user's task by reasoning and taking one action at a time.
You have access to the following tools:
- "writeFile": Writes/overwrites a file. Args: "path", "content".
- "executeCommand": Executes a shell command. Args: "command".
- "readFile": Reads a file to gather information. Args: "path".
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