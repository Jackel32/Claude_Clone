import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import WebSocket from 'ws';
import { AppContext } from '../src/types.js';
import { getProfile } from '../src/config/index.js';
import { createAIProvider } from '../src/ai/provider-factory.js';
import { logger } from '../src/logger/index.js';
import { runIndex } from '../src/core/index-core.js';
import { initializeParser } from '../src/codebase/ast.js';

// This suite tests AI-driven content generation features.
describe('Content Generation API', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    let ws: WebSocket;
    const testDir = path.resolve(process.cwd(), 'tests/temp-generation');
    let serverAddress: string;

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });
        await initializeParser(); // Ensure parser is ready
        server = await startServer();
        await new Promise<void>(resolve => server.listen(0, () => resolve()));
        const address = server.address();
        if (typeof address === 'string' || address === null) throw new Error('Server address is not in the expected format.');
        serverAddress = `ws://localhost:${address.port}`;
        agent = request(server);
        await agent.post('/api/set-active-project').send({ projectPath: testDir });
    }, 30000);

    afterAll(async () => {
        await stopServer();
        await fs.rm(testDir, { recursive: true, force: true });
    }, 30000);

    afterEach(async () => {
        if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
        }
        // Clean the directory for test isolation
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.mkdir(testDir, { recursive: true });
    });

    it('should generate a project report via WebSocket', async () => {
        await fs.writeFile(path.join(testDir, 'db.ts'), 'export const connect = () => "connected";');
        await fs.writeFile(path.join(testDir, 'server.ts'), 'import { connect } from "./db"; console.log(connect());');

        const reportPromise = new Promise<void>((resolve, reject) => {
            ws = new WebSocket(serverAddress);
            const receivedChunks: string[] = [];
            const taskId = `task-${Date.now()}`;

            ws.on('open', () => ws.send(JSON.stringify({ type: 'get-report', taskId })));
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.taskId !== taskId) return;
                if (message.type === 'stream-chunk') receivedChunks.push(message.content);
                else if (message.type === 'finish') {
                    const fullReport = receivedChunks.join('');
                    expect(fullReport.toLowerCase()).toContain('server');
                    expect(fullReport.toLowerCase()).toContain('database');
                    resolve();
                } else if (message.type === 'error') reject(new Error(message.content));
            });
            ws.on('error', (err) => reject(err));
        });
        await expect(reportPromise).resolves.not.toThrow();
    }, 30000);

    it('should generate a new code snippet from a prompt', async () => {
        const contextFilePath = path.join(testDir, 'existing-logic.ts');
        await fs.writeFile(contextFilePath, 'const PI = 3.14;\n\n// Add new function below');
        
        const profile = await getProfile();
        const apiKey = process.env.GOOGLE_API_KEY || profile.providers?.gemini?.apiKey || '';
        const aiProvider = createAIProvider(profile, apiKey, logger);
        const indexContext: AppContext = { profile, aiProvider, logger, args: { path: testDir } };
        await runIndex(indexContext, () => {});

        const generatePrompt = "a typescript function that calculates the area of a circle given a radius";
        const response = await agent
            .post('/api/generate')
            .send({ prompt: generatePrompt })
            .expect(200);

        expect(response.body).toHaveProperty('newContent');
        const newContent = response.body.newContent;
        expect(newContent).toContain('function');
        expect(newContent).toContain('radius');
        expect(newContent).toContain('PI');
    }, 30000);
});