import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import { initializeParser } from '../src/codebase/ast.js';

describe('AI Provider Factory API Endpoint', () => {
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

        // Set the active project
        await agent.post('/api/set-active-project').send({ projectPath: testProjectDir }).expect(200);
    }, 30000);

    afterAll(async () => {
        await stopServer();
        // Clean up the analysis directory after tests
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
    }, 30000);

    it('should return a configured AI provider instance', async () => {
        // Assuming the server is configured to use a specific AI provider (e.g., Gemini)
        // This test will indirectly check if the provider factory is working by calling an API
        // that utilizes the AI provider, like the chat endpoint.
        const userMessage = 'Test message to check AI provider integration.';
        const response = await agent.post('/api/chat')
            .send({ message: userMessage })
            .expect(200);

        // Assert that the chat endpoint returned a valid response, indicating the AI provider was likely instantiated correctly.
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
        expect(response.body.message).not.toBe('');
    }, 30000); // Increased timeout for potential AI processing

    // More specific tests could be added if there's a direct endpoint to query provider configuration
    // or to instantiate a provider with specific parameters.
});
