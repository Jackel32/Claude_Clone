import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import { initializeParser } from '../src/codebase/ast.js';

describe('Parser API Endpoint - JavaScript Support', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    // Using a JavaScript fixture for testing parser's multi-language capabilities
    const jsProjectPath = 'tests/fixtures/javascript-sample';
    const jsFilePath = path.join(jsProjectPath, 'main.js');
    const codeAnalysisDir = path.resolve(process.cwd(), 'code-to-analyze');

    beforeAll(async () => {
        // Ensure the analysis directory exists and is clean
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
        await fs.mkdir(codeAnalysisDir, { recursive: true });

        // Initialize parser and start the server
        await initializeParser();
        server = await startServer();
        agent = request(server);

        // Set the active project to the JavaScript fixture
        await agent.post('/api/set-active-project').send({ projectPath: jsProjectPath }).expect(200);
    }, 30000);

    afterAll(async () => {
        await stopServer();
        // Clean up the analysis directory after tests
        await fs.rm(codeAnalysisDir, { recursive: true, force: true });
    }, 30000);

    it('should list symbols from a JavaScript file', async () => {
        const response = await agent.post('/api/list-symbols')
            .send({ filePath: jsFilePath })
            .expect(200);

        // Assert that the response contains expected JavaScript symbols
        expect(response.body).toBeInstanceOf(Array);
        // Assuming 'myFunction' and 'MyClass' are present in tests/fixtures/javascript-sample/main.js
        expect(response.body).toContain('myFunction');
        expect(response.body).toContain('MyClass');
        expect(response.body).toContain('instanceMethod');
    }, 20000);

    // Add more tests for parser functionality if needed, e.g., testing different JS features,
    // error handling for invalid JS files, or parsing of other languages.
});
