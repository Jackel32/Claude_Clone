import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import { initializeParser } from '../src/codebase/ast.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';

// This test suite covers the basic, non-destructive API endpoints.
describe('General API Endpoints', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    const testProjectDir = path.resolve(process.cwd(), 'tests/fixtures/python-sample');
    const codeAnalysisDir = path.resolve(process.cwd(), 'code-to-analyze');

    // Start the server before any tests run in this suite
    beforeAll(async () => {
        await fs.mkdir(codeAnalysisDir, { recursive: true });
        await initializeParser();
        server = await startServer();
        agent = request(server);
    }, 30000);

    // Stop the server after all tests in this suite have finished
    afterAll(async () => {
        await stopServer();
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
    }, 30000);

    // Test case for fetching the list of available projects
    it('should list available local projects', async () => {
        const response = await agent.get('/api/projects').expect(200);

        // Assert the structure of the response
        expect(response.body).toHaveProperty('cloned');
        expect(response.body).toHaveProperty('local');
        expect(Array.isArray(response.body.local)).toBe(true);
    });

    // Test case for setting the active project
    it('should set the active project', async () => {
        const response = await agent
            .post('/api/set-active-project')
            .send({ projectPath: testProjectDir })
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    // Test case for fetching the file tree of the active project
    it('should return the file tree for the active project', async () => {
        // First, ensure the active project is set
        await agent.post('/api/set-active-project').send({ projectPath: testProjectDir });
        const response = await agent.get('/api/file-tree').expect(200);

        // Assert that the file tree has the expected structure
        expect(response.body.name).toBe('python-sample');
        expect(response.body.type).toBe('folder');
        expect(Array.isArray(response.body.children)).toBe(true);

        // Check for the existence of main.py in the file tree
        const mainPyFile = response.body.children.find(child => child.name === 'main.py');
        expect(mainPyFile).toBeDefined();
        expect(mainPyFile.type).toBe('file');
    });
});