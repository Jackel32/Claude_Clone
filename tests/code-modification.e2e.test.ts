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

    // --- FIX: Use afterEach to clean up the test file after every test ---
    afterEach(async () => {
        // Ensure the file is deleted after each test to guarantee isolation
        await fs.rm(testFile, { force: true });
    });

    it('should add documentation to a TypeScript file', async () => {
        const originalContent = 'export function sayHello(name: string) {\n  return `Hello, ${name}`;\n}';
        await fs.writeFile(testFile, originalContent); // File is created just for this test

        const response = await agent
            .post('/api/add-docs')
            .send({ filePath: testFile })
            .expect(200);

        expect(response.body.newContent).toContain('/**');
        expect(response.body.newContent).toContain('@param');
        expect(response.body.newContent).toContain(originalContent);
    }, 20000);

    it('should refactor a TypeScript file based on a prompt', async () => {
        const originalContent = 'function add(a, b) { return a + b; }';
        await fs.writeFile(testFile, originalContent); // A fresh file is created for this test

        const refactorPrompt = 'Convert this to a TypeScript arrow function with explicit types.';
        const response = await agent
            .post('/api/refactor')
            .send({ filePath: testFile, prompt: refactorPrompt })
            .expect(200);

        const newContent = response.body.newContent;
        expect(newContent).not.toEqual(originalContent);
        expect(newContent).toContain('const add');
        expect(newContent).toContain('=>');
        expect(newContent).toContain('a: number');
        expect(newContent).toContain('b: number');
    }, 20000);
});