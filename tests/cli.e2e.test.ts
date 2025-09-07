import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { promises as fs } from 'fs';

const exec = promisify(execCallback);

describe('CLI Commands End-to-End Tests', () => {
    const testProjectDir = path.resolve(process.cwd(), 'tests/fixtures/python-sample');
    const codeAnalysisDir = path.resolve(process.cwd(), 'code-to-analyze-cli');

    beforeAll(async () => {
        // Ensure the analysis directory exists and is clean for CLI operations
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
        await fs.mkdir(codeAnalysisDir, { recursive: true });

        // Set the current working directory to the test project for CLI commands
        process.chdir(testProjectDir);
    }, 30000);

    afterAll(async () => {
        // Clean up the analysis directory after tests
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
        // Reset the current working directory
        process.chdir(path.resolve(process.cwd(), '../../')); // Go back to the root of the project
    }, 30000);

    it('should execute the index command from CLI', async () => {
        // Execute the CLI index command, specifying the output directory
        // Note: We are assuming the 'cli.ts' is compiled and available in the PATH or can be executed directly.
        // For this test, we'll simulate running it using node.
        const cliCommand = `node dist/cli.js index --output-dir ${codeAnalysisDir}`;
        
        const { stdout, stderr } = await exec(cliCommand, {
            cwd: testProjectDir // Execute command from the project directory
        });

        // Assert that the command executed without errors
        expect(stderr).toBe('');
        expect(stdout).toContain('Codebase indexed successfully.');

        // Verify that some analysis files were created in the specified output directory
        const indexedFiles = await fs.readdir(codeAnalysisDir);
        expect(indexedFiles.length).toBeGreaterThan(0);
        // Check for a vector file (assuming .json format for vector data)
        const vectorFileExists = indexedFiles.some(file => file.endsWith('.json'));
        expect(vectorFileExists).toBe(true);
    }, 60000); // Increased timeout as indexing can take time

    // Add more tests for other CLI commands if they exist and are relevant to E2E testing.
});
