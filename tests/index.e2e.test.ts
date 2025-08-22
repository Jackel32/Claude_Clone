import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import { initializeParser } from '../src/codebase/ast.js';

describe('Index API Endpoint', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    const testProjectDir = path.resolve(process.cwd(), 'tests/fixtures/python-sample');
    const codeAnalysisDir = path.resolve(process.cwd(), 'code-to-analyze');

    beforeAll(async () => {
        // Ensure the analysis directory exists and is clean
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
        await fs.mkdir(codeAnalysisDir, { recursive: true });

        // Initialize parser and start the server
        await initializeParser();
        server = await startServer();
        agent = request(server);

        // Set the active project before running index command
        await agent.post('/api/set-active-project').send({ projectPath: testProjectDir }).expect(200);
    }, 30000);

    afterAll(async () => {
        await stopServer();
        // Clean up the analysis directory after tests
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
    }, 30000);

    it('should successfully index the active project', async () => {
        // Trigger the index command
        const response = await agent.post('/api/index')
            .expect(200);

        // Assert that the indexing process was successful
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Codebase indexed successfully.');

        // Optional: Verify that some analysis files were created
        // This is a basic check; more thorough checks might involve looking for specific files or content.
        const indexedFiles = await fs.readdir(codeAnalysisDir);
        expect(indexedFiles.length).toBeGreaterThan(0);
        // For instance, check for a vector file if that's part of the output
        const vectorFileExists = indexedFiles.some(file => file.endsWith('.json')); // Assuming vector data is stored in .json files
        expect(vectorFileExists).toBe(true);
    }, 60000); // Increased timeout as indexing can take time

    // Add more tests for the index endpoint if needed, e.g., handling of different project types,
    // error scenarios, or re-indexing.
});
