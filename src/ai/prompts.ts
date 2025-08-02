/**
 * @file Contains functions for constructing AI prompts.
 */

/**
 * Constructs a formatted prompt for an instruction-following AI model.
 *
 * @param userQuery - The user's specific request (e.g., "Explain this code").
 * @param context - The contextual information, such as code file contents.
 * @returns A fully formatted prompt string ready to be sent to the AI.
 */
export function constructPrompt(userQuery: string, context: string): string {
  return `
You are an expert software architect and programmer. Your task is to analyze the provided codebase context and answer the user's question. Be concise, accurate, and provide code examples where helpful.

<user_query>
${userQuery}
</user_query>

<code_context>
${context}
</code_context>

Please provide your analysis below:
`;
}