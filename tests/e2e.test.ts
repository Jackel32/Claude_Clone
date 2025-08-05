import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';

describe('End-to-End Tests for Multi-Language Support', () => {
    let server: http.Server;
    let agent: request.SuperTest<request.Test>;

    // Start the server before any tests run
    beforeAll(async () => {
        server = await startServer();
        // Supertest attaches to the running server instance
        agent = request(server);
    });

    // Stop the server after all tests are done
    afterAll(async () => {
        await stopServer();
    });

    it('should correctly parse a Python project and list its symbols', async () => {
        const pythonProjectPath = 'tests/fixtures/python-sample';
        const pythonFilePath = path.join(pythonProjectPath, 'main.py');

        // 1. Tell the server to use our Python sample project as the CWD
        await agent.post('/api/test/set-active-repo')
            .send({ repoPath: pythonProjectPath })
            .expect(200);

        // 2. Ask for the list of symbols in the main.py file
        const response = await agent.post('/api/list-symbols')
            .send({ filePath: pythonFilePath })
            .expect(200);
        
        // 3. Assert that it found the correct Python symbols
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body).toContain('Greeter');
        expect(response.body).toContain('say_hello');
    });
});