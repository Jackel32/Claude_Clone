import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProfile } from './config/index.js';
import { getApiKey } from './auth/index.js';
import { createAIProvider } from './ai/provider-factory.js';
import { logger } from './logger/index.js';
import { AppContext, ChatMessage } from './types.js';
import { getChatContext } from './core/chat-core.js';
import { constructChatPrompt } from './ai/index.js';
import { runAddDocs } from './core/add-docs-core.js';
import { scanProject } from './codebase/index.js';
import { getRecentCommits, getDiffBetweenCommits } from './fileops/index.js';
import { runRefactor } from './core/refactor-core.js';
import { runTestGeneration } from './core/test-core.js';
import * as diff from 'diff';

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // --- Create a shared AppContext for the server ---
    const profile = await getProfile();
    const apiKey = await getApiKey();
    const aiProvider = createAIProvider(profile, apiKey);
    const appContext: Omit<AppContext, 'args'> = { profile, aiProvider, logger };
    // ---------------------------------------------------
    
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../public')));

    // Endpoint to get the list of project files
    app.get('/api/files', async (req, res) => {
        try {
            const files = await scanProject('.');
            res.json(files);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to run the "add-docs" command and return a diff
    app.post('/api/add-docs', async (req, res) => {
        try {
            const { filePath } = req.body;
            const originalContent = await fs.readFile(filePath, 'utf-8');
            const newContent = await runAddDocs(filePath, { ...appContext, args: {} });
            const patch = diff.createPatch(filePath, originalContent, newContent);
            res.json({ patch, newContent });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to apply the changes to a file
    app.post('/api/apply-changes', async (req, res) => {
        try {
            const { filePath, newContent } = req.body;
            await fs.writeFile(filePath, newContent, 'utf-8');
            res.json({ success: true, message: `File ${filePath} updated.` });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to get the list of recent git commits
    app.get('/api/commits', async (req, res) => {
        try {
            const commits = await getRecentCommits();
            res.json(commits);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to get a diff between two commits
    app.post('/api/diff', async (req, res) => {
        try {
            const { startCommit, endCommit } = req.body;
            const diffContent = await getDiffBetweenCommits(startCommit, endCommit);
            
            // For now, we'll just send the raw diff. We could also ask the AI to summarize it.
            const patch = diff.createPatch('commit.diff', '', diffContent);
            res.json({ patch });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to run the "refactor" command
    app.post('/api/refactor', async (req, res) => {
        try {
            const { filePath, prompt } = req.body;
            const originalContent = await fs.readFile(filePath, 'utf-8');
            const newContent = await runRefactor(filePath, prompt, { ...appContext, args: {} });
            const patch = diff.createPatch(filePath, originalContent, newContent);
            res.json({ patch, newContent });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to run the "test" command
    app.post('/api/test', async (req, res) => {
        try {
            const { filePath, symbol, framework } = req.body;
            const newContent = await runTestGeneration(filePath, symbol, framework, { ...appContext, args: {} });
            res.json({ newContent });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    wss.on('connection', (ws) => {
        logger.info('Client connected to WebSocket');
        const conversationHistory: ChatMessage[] = [];

        ws.on('message', async (message) => {
            try {
                const query = JSON.parse(message.toString()).content;
                conversationHistory.push({ role: 'user', content: query });

                const contextStr = await getChatContext(query, { ...appContext, args: {} });
                const prompt = constructChatPrompt(conversationHistory, contextStr);

                const stream = await aiProvider.invoke(prompt, true);
                
                ws.send(JSON.stringify({ type: 'start' }));

                const reader = stream.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    fullResponse += decoder.decode(value, { stream: true });
                }
                const responseArray = JSON.parse(fullResponse);
                for (const chunk of responseArray) {
                    const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        ws.send(JSON.stringify({ type: 'chunk', content: text }));
                    }
                }
                
                conversationHistory.push({ role: 'assistant', content: fullResponse });
                ws.send(JSON.stringify({ type: 'end' }));

            } catch (error) {
                logger.error(error, 'Error processing WebSocket message');
                ws.send(JSON.stringify({ type: 'error', content: (error as Error).message }));
            }
        });

        ws.on('close', () => logger.info('Client disconnected'));
    });

    server.listen(PORT, () => {
        logger.info(`Server is listening on http://localhost:${PORT}`);
    });
}

main();