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
    // ===================================
    // == For the Software Engineer 👩‍💻 ==
    // ===================================
    {
        id: 'add-error-handling',
        title: 'Add Error Handling',
        description: 'Analyze a function and add robust try/catch error handling to it.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select the file containing the function:' },
            { name: 'symbolName', type: 'symbol', message: 'Select the function to add error handling to:' },
        ],
        prompt: (inputs) => `Analyze the function named "${inputs.symbolName}" in the file at "${inputs.filePath}". Modify the function to include robust try/catch error handling for all potentially problematic operations (e.g., I/O, API calls, JSON parsing). Return the complete, updated file content.`,
    },
    {
        id: 'refactor-to-async-await',
        title: 'Refactor to Async/Await',
        description: 'Convert a function that uses promise chains (.then/.catch) to modern async/await syntax.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select the file containing the function to refactor:' },
            { name: 'symbolName', type: 'symbol', message: 'Select the function to convert to async/await:' },
        ],
        prompt: (inputs) => `Analyze the function named "${inputs.symbolName}" in the file at "${inputs.filePath}". Refactor this specific function from using .then() and .catch() promise chains to the modern async/await syntax. Ensure that the functionality remains identical. Return the complete, updated file content.`,
    },
    {
        id: 'implement-api-client',
        title: 'Implement API Client',
        description: 'Generate a TypeScript function to fetch data from a specified public API endpoint.',
        inputs: [
            { name: 'apiUrl', type: 'text', message: 'Enter the full URL of the public API endpoint:' },
            { name: 'functionName', type: 'text', message: 'What should the fetch function be named?' },
            { name: 'outputPath', type: 'text', message: 'Enter the path for the new file (e.g., src/clients/api.ts):' },
        ],
        prompt: (inputs) => `Create a new TypeScript file at "${inputs.outputPath}". In this file, write an async function named "${inputs.functionName}" that fetches data from the following public API endpoint: "${inputs.apiUrl}". The function should use the built-in 'fetch' API, handle potential network errors with a try/catch block, and parse the JSON response. Include basic JSDoc comments explaining what the function does.`,
    },
    {
        id: 'find-and-remove-dead-code',
        title: 'Find & Remove Dead Code',
        description: 'Analyze a file to identify and remove unused functions, variables, or imports.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select the file to clean up:' },
        ],
        prompt: (inputs) => `Perform a static analysis on the file at "${inputs.filePath}". Identify all unused variables, functions, classes, and imports that are not exported or called from within the file. After identifying them, remove the dead code. Return the complete, cleaned-up file content.`,
    },
    {
        id: 'create-github-action-workflow',
        title: 'Create CI/CD GitHub Action',
        description: 'Generate a basic CI/CD workflow file for GitHub Actions to build and test the project.',
        inputs: [],
        prompt: () => `Analyze the 'package.json' file to identify the build and test scripts. Based on this, generate a new GitHub Actions workflow file at '.github/workflows/ci.yml'. This workflow should trigger on pushes to the main branch, set up the correct Node.js version, install dependencies, and run the build and test commands.`,
    },

    // ===================================
    // ==   For the Tester 🧪           ==
    // ===================================
    {
        id: 'suggest-regression-tests',
        title: 'Suggest Regression Tests',
        description: 'Analyze a git diff and suggest which areas of the application need regression testing.',
        inputs: [
            { name: 'baseBranch', type: 'text', message: 'Enter the base branch (e.g., main):' },
            { name: 'compareBranch', type: 'text', message: 'Enter the feature branch to analyze:' },
        ],
        prompt: (inputs) => `Analyze the git diff between the "${inputs.baseBranch}" and "${inputs.compareBranch}" branches. Based on the files and code that have changed, generate a list of features and user flows that should be prioritized for regression testing to ensure no new bugs were introduced. The output should be a markdown checklist.`,
    },
    {
        id: 'generate-unit-tests',
        title: 'Generate Unit Tests',
        description: 'Create a full suite of unit tests for all functions in a selected file.',
        inputs: [
            { name: 'filePath', type: 'testable-file', message: 'Select the file to generate tests for:' },
            { name: 'framework', type: 'text', message: 'Enter the testing framework (e.g., jest, pytest):' },
        ],
        prompt: (inputs) => `Create a complete unit test file using the ${inputs.framework} framework for the source file located at "${inputs.filePath}". Ensure all functions/classes are covered with meaningful tests, including edge cases and mocking of dependencies. Create a new file for these tests.`,
    },
    {
        id: 'generate-e2e-test-spec',
        title: 'Generate E2E Test Spec',
        description: 'Create a new end-to-end test file for a user journey using Vitest and Supertest.',
        inputs: [
            { name: 'featureDescription', type: 'text', message: 'Describe the user journey to test (e.g., "User logs in, creates a post, and logs out"):' },
            { name: 'outputPath', type: 'text', message: 'Enter the path for the new test file (e.g., tests/e2e/posting.e2e.test.ts):' },
        ],
        prompt: (inputs) => `Based on the following user journey, generate a new end-to-end test file at "${inputs.outputPath}" using Vitest for the test structure and Supertest for making API requests. The test should follow best practices for E2E testing, including setup and teardown logic.\n\nUser Journey: "${inputs.featureDescription}"`,
    },
    {
        id: 'generate-mock-data',
        title: 'Generate Mock Data',
        description: 'Create a JSON file with realistic mock data based on a TypeScript interface.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select the file containing the TypeScript interface:' },
            { name: 'symbolName', type: 'symbol', message: 'Select the interface to generate mock data for:' },
            { name: 'count', type: 'text', message: 'How many mock objects should be generated?' },
            { name: 'outputPath', type: 'text', message: 'Enter the path for the new mock data file (e.g., tests/mocks/users.json):' },
        ],
        prompt: (inputs) => `Read the TypeScript interface named "${inputs.symbolName}" from the file at "${inputs.filePath}". Generate a JSON array containing ${inputs.count} realistic mock data objects that conform to this interface. Write the generated JSON array to a new file at "${inputs.outputPath}".`,
    },

    // ===================================
    // ==  For the Architect 🏛️        ==
    // ===================================
    {
        id: 'draft-decision-record',
        title: 'Draft Architecture Decision Record',
        description: 'Create an Architecture Decision Record (ADR) for a technical choice.',
        inputs: [
            { name: 'decision', type: 'text', message: 'What is the technical decision that was made?' },
            { name: 'context', type: 'text', message: 'What is the context or problem that led to this decision?' },
            { name: 'alternatives', type: 'text', message: 'What other options were considered (comma-separated)?' },
        ],
        prompt: (inputs) => `Generate an Architecture Decision Record (ADR) in markdown format. The ADR should document the decision to "${inputs.decision}". Use the provided context to fill out the 'Context' section. List the considered alternatives: "${inputs.alternatives}". The main body of the ADR should detail the positive consequences and trade-offs of the chosen decision. Create this as a new file named 'docs/adr/001-record-of-decision.md'.`,
    },
    {
        id: 'analyze-circular-dependencies',
        title: 'Analyze for Circular Dependencies',
        description: 'Scan the project to identify potential circular dependency issues between modules.',
        inputs: [],
        prompt: () => `Analyze the import/export statements across all TypeScript files in the 'src' directory. Identify potential circular dependencies where Module A imports Module B, and Module B (or a module it imports) in turn imports Module A. Generate a markdown report listing any circular dependency chains found and suggest potential refactoring strategies to break the cycle.`,
    },
    {
        id: 'write-readme',
        title: 'Generate Project README',
        description: 'Performs a full-codebase analysis and generates a new README.md file.',
        inputs: [],
        prompt: () => `Perform a comprehensive analysis of the entire codebase and generate a detailed, professional README.md file. The README should include sections for Project Overview, Features, Architecture, and Setup Instructions. Overwrite the existing README.md file with this new content.`,
    },
    {
        id: 'create-architecture-diagram',
        title: 'Create Architecture Diagram',
        description: 'Generate a Mermaid.js diagram to visualize the project architecture.',
        inputs: [],
        prompt: () => `Analyze the entire codebase, focusing on the relationships between the major components (e.g., server, database, AI provider, file system, client UI). Generate a sequence or flowchart diagram using Mermaid.js syntax that visualizes this architecture and data flow. The diagram should be detailed enough to be useful for new developers. Return only the raw Mermaid.js markdown block.`,
    },
    {
        id: 'propose-tech-stack-migration',
        title: 'Propose Tech Stack Migration',
        description: 'Analyze the codebase and propose a plan for migrating to a new technology.',
        inputs: [
            { name: 'currentTech', type: 'text', message: 'What is the current technology to be replaced (e.g., Express.js)?' },
            { name: 'newTech', type: 'text', message: 'What is the new technology to migrate to (e.g., Fastify)?' },
        ],
        prompt: (inputs) => `Analyze the codebase to understand how "${inputs.currentTech}" is currently being used. Create a high-level migration plan in markdown format for replacing it with "${inputs.newTech}". The plan should include: a list of affected files, a step-by-step migration guide, potential risks and challenges, and a proposed validation strategy.`,
    },

    // ===================================
    // == For the Product Manager 📝    ==
    // ===================================
    {
        id: 'create-feature-rollout-plan',
        title: 'Create Feature Rollout Plan',
        description: 'Generate a phased rollout plan for a new feature, including communication points.',
        inputs: [
            { name: 'featureName', type: 'text', message: 'What is the name of the new feature?' },
            { name: 'targetAudience', type: 'text', message: 'Who is the target audience for this feature?' },
        ],
        prompt: (inputs) => `Create a phased rollout plan in markdown for a new feature called "${inputs.featureName}" targeting "${inputs.targetAudience}". The plan should include phases like "Internal Testing (Dogfooding)," "Beta Release to 10% of Users," and "Full Public Release." For each phase, list the objectives, success metrics, and a draft of the communication message to be sent to users.`,
    },
    {
        id: 'generate-api-docs',
        title: 'Generate API Documentation',
        description: 'Create user-friendly documentation for an API endpoint from its source code.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select the file containing the API route definition:' },
            { name: 'symbolName', type: 'symbol', message: 'Select the function or class that defines the API routes:' },
        ],
        prompt: (inputs) => `Analyze the code for "${inputs.symbolName}" in the file "${inputs.filePath}". This code defines one or more API endpoints. Generate user-facing API documentation in markdown format. For each endpoint, include the HTTP method, the URL path, a description of what it does, a list of any parameters (path, query, or body), and an example of a successful response.`,
    },
    {
        id: 'generate-user-stories',
        title: 'Generate User Stories',
        description: 'Break down a high-level feature idea into Agile user stories with acceptance criteria.',
        inputs: [
            { name: 'featureIdea', type: 'text', message: 'Describe the high-level feature idea:' },
        ],
        prompt: (inputs) => `Based on the following feature idea, break it down into a set of Agile user stories. Each user story should follow the format "As a [user type], I want [goal] so that [benefit]." For each story, also provide a list of clear acceptance criteria. The output should be in a markdown format.\n\nFeature Idea: "${inputs.featureIdea}"`,
    },
    {
        id: 'create-release-notes',
        title: 'Draft Release Notes',
        description: 'Analyze recent git commits between two tags/commits and draft release notes.',
        inputs: [
            { name: 'startCommit', type: 'text', message: 'Enter the starting git tag or commit hash (older):' },
            { name: 'endCommit', type: 'text', message: 'Enter the ending git tag or commit hash (newer):' },
        ],
        prompt: (inputs) => `Analyze the git history between commits "${inputs.startCommit}" and "${inputs.endCommit}". Based on the commit messages, draft a set of user-facing release notes in markdown. Categorize the changes into sections like "🚀 New Features," "🐛 Bug Fixes," and "🔧 Improvements."`,
    },
    {
        id: 'analyze-user-feedback',
        title: 'Analyze User Feedback',
        description: 'Summarize raw user feedback into key themes, sentiment, and actionable insights.',
        inputs: [
            { name: 'filePath', type: 'file', message: 'Select a file containing raw user feedback (e.g., feedback.txt):' },
        ],
        prompt: (inputs) => `Read the user feedback from the file at "${inputs.filePath}". Analyze the text to identify recurring themes, overall sentiment (positive, negative, neutral), and actionable feature requests or bug reports. Present your analysis as a markdown summary with sections for "Key Themes," "Sentiment Analysis," and "Actionable Insights."`,
    },
];