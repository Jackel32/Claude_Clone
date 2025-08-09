/**
 * @file src/ai/prompt-library.ts
 * @description Defines a library of pre-defined tasks for the AI agent.
 */

export interface TaskInput {
    name: string; // e.g., 'filePath', 'symbolName'
    type: 'file' | 'testable-file' | 'symbol' | 'text';
    message: string;
}

export interface TaskTemplate {
    id: string;
    title: string;
    description: string;
    inputs: TaskInput[];
    prompt: (inputs: Record<string, string>) => string;
}

export const TASK_LIBRARY: TaskTemplate[] = [
    {
        id: 'generate-unit-tests',
        title: 'Generate Unit Tests',
        description: 'Create a full suite of unit tests for all functions in a selected file.',
        inputs: [
            { name: 'filePath', type: 'testable-file', message: 'Select the file to generate tests for:' },
            { name: 'framework', type: 'text', message: 'Enter the testing framework (e.g., jest, pytest):' },
        ],
        prompt: (inputs) => `Create a complete unit test file using the ${inputs.framework} framework for the source file located at "${inputs.filePath}". Ensure all functions/classes are covered with meaningful tests, including edge cases. Create a new file for these tests.`,
    },
    {
        id: 'add-error-handling',
        title: 'Add Error Handling',
        description: 'Analyze a function and add robust try/catch error handling to it.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select the file containing the function:' },
            { name: 'symbolName', type: 'symbol', message: 'Select the function to add error handling to:' },
        ],
        prompt: (inputs) => `Analyze the function named "${inputs.symbolName}" in the file at "${inputs.filePath}". Modify the function to include robust try/catch error handling for all potentially problematic operations (e.g., I/O, API calls). Return the complete, updated file content.`,
    },
    {
        id: 'write-readme',
        title: 'Generate Project README',
        description: 'Performs a full-codebase analysis and generates a new README.md file.',
        inputs: [],
        prompt: () => `Perform a comprehensive analysis of the entire codebase and generate a detailed, professional README.md file. The README should include sections for Project Overview, Features, Architecture, and Setup Instructions. Overwrite the existing README.md file with this new content.`,
    },
];