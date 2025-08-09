import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '../src/server.js';
import http from 'http';
import * as path from 'path';
import { promises as fs } from 'fs';
import WebSocket from 'ws';
import { runIndex } from '../src/core/index-core.js';
import { getProfile } from '../src/config/index.js';
import { createAIProvider } from '../src/ai/provider-factory.js';
import { logger } from '../src/logger/index.js';
import { AppContext } from '../src/types.js';
import { initializeParser } from '../src/codebase/ast.js';

describe('Chat WebSocket API', () => {
    let server: http.Server;
    let agent: ReturnType<typeof request>;
    let ws: WebSocket;
    const testDir = path.resolve(process.cwd(), 'tests/temp-chat');
    let serverAddress: string;

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });
        await initializeParser();
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
        if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.mkdir(testDir, { recursive: true });
    });

    it('should respond with "index-required" if the project is not indexed', async () => {
        await fs.writeFile(path.join(testDir, 'new-file.ts'), 'export const a = 1;');
        
        const testPromise = new Promise<void>((resolve, reject) => {
            ws = new WebSocket(serverAddress);
            ws.on('open', () => ws.send(JSON.stringify({ type: 'chat', content: 'hello' })));
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message.type).toBe('index-required');
                resolve();
            });
            ws.on('error', (err) => reject(err));
        });
        await expect(testPromise).resolves.not.toThrow();
    }, 15000);

    it('should successfully send a message and receive an AI response after indexing', async () => {
        await fs.writeFile(path.join(testDir, 'config.ts'), 'export const GREETING = "hello from the config file";');
        const profile = await getProfile();
        const apiKey = process.env.GOOGLE_API_KEY || profile.providers?.gemini?.apiKey || '';
        if (!apiKey || apiKey.includes('YOUR_API_KEY')) throw new Error('GOOGLE_API_KEY is not set for testing.');
        const aiProvider = createAIProvider(profile, apiKey, logger);
        const indexContext: AppContext = { profile, aiProvider, logger, args: { path: testDir } };
        await runIndex(indexContext, () => {});

        const chatPromise = new Promise<void>((resolve, reject) => {
            ws = new WebSocket(serverAddress);
            const receivedChunks: string[] = [];
            ws.on('open', () => ws.send(JSON.stringify({ type: 'chat', content: 'What is the value of the GREETING constant?' })));
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'chunk') receivedChunks.push(message.content);
                else if (message.type === 'end') {
                    const fullResponse = receivedChunks.join('').toLowerCase();
                    expect(fullResponse).toContain('hello from the config file');
                    resolve();
                } else if (message.type === 'error') reject(new Error(message.content));
            });
            ws.on('error', (err) => reject(err));
        });
        await expect(chatPromise).resolves.not.toThrow();
    }, 45000);
});