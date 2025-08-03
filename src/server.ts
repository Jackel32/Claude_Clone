/**
 * @file src/server.ts
 * @description The Express.js webserver for the GUI.
 */

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as diff from 'diff';

import { getProfile } from './config/index.js';
import { getApiKey } from './auth/index.js';
import { createAIProvider } from './ai/provider-factory.js';
import { logger } from './logger/index.js';
import { AppContext, ChatMessage } from './types.js';
import { constructChatPrompt, constructDiffAnalysisPrompt  } from './ai/index.js';

import { getRecentCommits, getDiffBetweenCommits } from './fileops/index.js';
import { buildFileTree } from './codebase/index.js';

import { getChatContext } from './core/chat-core.js';
import { runAddDocs } from './core/add-docs-core.js';
import { runRefactor } from './core/refactor-core.js';
import { runTestGeneration } from './core/test-core.js';
import { runAgent } from './core/agent-core.js';

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CODE_ANALYSIS_ROOT = './code-to-analyze';

async function main() {
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    const profile = await getProfile();
    const apiKey = await getApiKey();
    const aiProvider = createAIProvider(profile, apiKey);
    const appContext: Omit<AppContext, 'args'> = { profile, aiProvider, logger };
    
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../public')));
    
    // --- API ENDPOINTS ---

    app.get('/api/file-tree', async (req, res) => {
        try {
            const tree = await buildFileTree(CODE_ANALYSIS_ROOT);
            res.json(tree);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

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

    app.post('/api/test', async (req, res) => {
        try {
            const { filePath, symbol, framework } = req.body;
            const newContent = await runTestGeneration(filePath, symbol, framework, { ...appContext, args: {} });
            res.json({ newContent });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    app.get('/api/commits', async (req, res) => {
        try {
            const commits = await getRecentCommits(CODE_ANALYSIS_ROOT);
            res.json(commits);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // Endpoint to get a diff between two commits
    app.post('/api/diff', async (req, res) => {
        try {
            const { startCommit, endCommit } = req.body;
            const diffContent = await getDiffBetweenCommits(startCommit, endCommit, CODE_ANALYSIS_ROOT);
            
            let analysis = 'AI analysis could not be generated for this diff.';
            if (diffContent && diffContent.trim()) {
                const analysisPrompt = constructDiffAnalysisPrompt(diffContent);
                const response = await aiProvider.invoke(analysisPrompt, false);
                analysis = response?.candidates?.[0]?.content?.parts?.[0]?.text || analysis;
            }
            
            // It now correctly sends BOTH the patch and the analysis.
            res.json({ patch: diffContent, analysis });

        } catch (error) {
            logger.error(error, `Error in /api/diff`);
            res.status(500).json({ error: (error as Error).message });
        }
    });

    app.post('/api/apply-changes', async (req, res) => {
        try {
            const { filePath, newContent } = req.body;
            await fs.writeFile(filePath, newContent, 'utf-8');
            res.json({ success: true, message: `File ${filePath} updated.` });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    // --- WebSocket Server ---
    wss.on('connection', (ws) => {
        logger.info('Client connected to WebSocket');
        const conversationHistory: ChatMessage[] = [];

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'agent-task') {
                    const onUpdate = (update: any) => ws.send(JSON.stringify(update));
                    await runAgent(data.task, { ...appContext, args: {} }, onUpdate);
                } else { // Default to chat
                    const query = data.content;
                    conversationHistory.push({ role: 'user', content: query });

                    const contextStr = await getChatContext(query, { ...appContext, args: {} });
                    const prompt = constructChatPrompt(conversationHistory, contextStr);
                    const stream = await aiProvider.invoke(prompt, true);
                    
                    ws.send(JSON.stringify({ type: 'start' }));

                    // This part needs to be adapted for different streaming formats
                    // For Gemini, we read the whole stream then send chunks
                    const reader = stream.getReader();
                    const decoder = new TextDecoder();
                    let fullResponse = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        fullResponse += decoder.decode(value, { stream: true });
                    }
                    
                    let accumulatedText = '';
                    const responseArray = JSON.parse(fullResponse);
                    for (const chunk of responseArray) {
                        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            ws.send(JSON.stringify({ type: 'chunk', content: text }));
                            accumulatedText += text;
                        }
                    }
                    
                    conversationHistory.push({ role: 'assistant', content: accumulatedText });
                    ws.send(JSON.stringify({ type: 'end' }));
                }
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