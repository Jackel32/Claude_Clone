import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import { initializeParser } from '../src/codebase/ast.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';

describe('Code Modification API', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    const testDir = path.resolve(process.cwd(), 'tests/temp-code-modification');
    // Define a single file path that will be created and deleted for each test
    const testFile = path.join(testDir, 'test-file.ts');

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });
        await initializeParser();
        server = await startServer();
        agent = request(server);
        await agent.post('/api/set-active-project').send({ projectPath: testDir });
    }, 30000);

    afterAll(async () => {
        await stopServer();
        await fs.rm(testDir, { recursive: true, force: true });
    }, 30000);

    afterEach(async () => {
        // Ensure the file is deleted after each test to guarantee isolation
        await fs.rm(testFile, { force: true });
    });
});