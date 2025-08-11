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

import { createAppContext } from './config/index.js';
import { logger } from './logger/index.js';
import { AppContext, ChatMessage } from './types.js';
import { constructChatPrompt, constructDiffAnalysisPrompt } from './ai/index.js';
import { getRecentCommits, getDiffBetweenCommits, cloneRepo, getBranches, getDiffBetweenBranches } from './fileops/index.js';
import { buildFileTree, listSymbolsInFile, buildTestableFileTree, initializeParser } from './codebase/index.js';
import { getChatContext } from './core/chat-core.js';
import { runAddDocs } from './core/add-docs-core.js';
import { runRefactor } from './core/refactor-core.js';
import { runTestGeneration } from './core/test-core.js';
import { runAgent, AgentUpdate } from './core/agent-core.js';
import { runReport } from './core/report-core.js';
import { Indexer } from './codebase/indexer.js';
import { runIndex, runInit } from './core/index-core.js';
import { runGenerate } from './core/generate-core.js';
import { TASK_LIBRARY } from './ai/prompt-library.js';

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CODE_ANALYSIS_ROOT = './code-to-analyze';

let serverInstance: http.Server | null = null;

export async function startServer() {
    await initializeParser();

    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    const appContext = await createAppContext();
    const { aiProvider } = appContext;
    
    const reposDir = path.join(process.env.HOME || '/root', '.claude-code', 'repos');
    await fs.mkdir(reposDir, { recursive: true });

    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../public')));
    
    app.use('/api', (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });

    app.set('CODE_ANALYSIS_ROOT', '');

    const getActiveRepoPath = (req: express.Request): string => {
        const repoPath = req.app.get('CODE_ANALYSIS_ROOT');
        if (!repoPath) throw new Error("No active repository selected.");
        return repoPath;
    }

    // --- API ENDPOINTS ---
    app.get('/api/projects', async (req, res) => {
        try {
            // Get projects cloned via the app
            const clonedEntries = await fs.readdir(reposDir, { withFileTypes: true });
            const clonedProjects = clonedEntries
                .filter(e => e.isDirectory())
                .map(e => ({ name: e.name, path: path.join(reposDir, e.name) }));

            // Get local projects from the base mounted volume, not the "active" one
            const localEntries = await fs.readdir(CODE_ANALYSIS_ROOT, { withFileTypes: true });
            const localProjects = localEntries
                .filter(e => e.isDirectory())
                .map(e => ({ name: e.name, path: path.join(CODE_ANALYSIS_ROOT, e.name) }));

            res.json({ cloned: clonedProjects, local: localProjects });
        } catch (error) {
            // Log the actual error on the server for better debugging
            logger.error(error, 'Error in /api/projects');
            res.status(500).json({ error: (error as Error).message });
        }
    });
    
    // This endpoint is now more generic
    app.post('/api/set-active-project', (req, res) => {
        const { projectPath } = req.body;
        // The path from the client is already the full path inside the container
        app.set('CODE_ANALYSIS_ROOT', projectPath);
        logger.info(`Active repository set to: ${projectPath}`);
        res.json({ success: true });
    });

    app.post('/api/repos/clone', async (req, res) => {
        try {
            const { repoUrl, pat } = req.body;
            const repoName = path.basename(repoUrl, '.git');
            const localPath = path.join(reposDir, repoName);
            await cloneRepo(repoUrl, pat, localPath);
            res.json({ success: true, repoName });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });
    
    app.post('/api/repos/active', (req, res) => {
        const { repoName } = req.body;
        const activeRepoPath = path.join(reposDir, repoName);
        app.set('CODE_ANALYSIS_ROOT', activeRepoPath);
        logger.info(`Active repository set to: ${activeRepoPath}`);
        res.json({ success: true });
    });

    if (process.env.NODE_ENV === 'test') {
        app.post('/api/test/set-active-repo', (req, res) => {
            const { repoPath } = req.body;
            app.set('CODE_ANALYSIS_ROOT', path.resolve(repoPath));
            logger.info(`[TEST] Active repository set to: ${app.get('CODE_ANALYSIS_ROOT')}`);
            res.json({ success: true });
        });
    }

    app.get('/api/file-tree', async (req, res) => {
        try {
            const tree = await buildFileTree(getActiveRepoPath(req));
            res.json(tree);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });
    
    app.get('/api/testable-file-tree', async (req, res) => {
        try {
            const tree = await buildTestableFileTree(getActiveRepoPath(req));
            res.json(tree);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.post('/api/list-symbols', async (req, res) => {
        try {
            const { filePath } = req.body;
            const symbols = await listSymbolsInFile(filePath);
            res.json(symbols);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.get('/api/commits', async (req, res) => {
        try {
            const commits = await getRecentCommits(getActiveRepoPath(req));
            res.json(commits);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.post('/api/diff', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const { startCommit, endCommit, baseBranch, compareBranch } = req.body;
            let diffContent = '';

            if (startCommit && endCommit) {
                diffContent = await getDiffBetweenCommits(startCommit, endCommit, activeRepoPath);
            } else if (baseBranch && compareBranch) {
                diffContent = await getDiffBetweenBranches(baseBranch, compareBranch, activeRepoPath);
            } else {
                throw new Error('Invalid request for diff. Provide either commits or branches.');
            }

            let analysis = 'AI analysis could not be generated for this diff.';
            if (diffContent && diffContent.trim()) {
                const analysisPrompt = constructDiffAnalysisPrompt(diffContent);
                const response = await aiProvider.invoke(analysisPrompt, false);
                analysis = response?.candidates?.[0]?.content?.parts?.[0]?.text || analysis;
            }
            res.json({ patch: diffContent, analysis });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.get('/api/branches', async (req, res) => {
        try {
            const branches = await getBranches(getActiveRepoPath(req));
            res.json(branches);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    app.post('/api/add-docs', async (req, res) => {
        try {
            const { filePath } = req.body;
            // The server reads the file content once.
            const originalContent = await fs.readFile(filePath, 'utf-8');
            
            const activeRepoPath = getActiveRepoPath(req);
            const requestContext = { ...appContext, args: { path: activeRepoPath } };

            // The content is passed to the core function.
            const newContent = await runAddDocs(originalContent, requestContext);
            
            const patch = diff.createPatch(filePath, originalContent, newContent);
            res.json({ patch, newContent });
        } catch (error) {
            logger.error(error, `Error in /api/add-docs for file: ${req.body.filePath}`);
            res.status(500).json({ error: (error as Error).message });
        }
    });
    
    app.post('/api/refactor', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const { filePath, prompt } = req.body;
            const originalContent = await fs.readFile(filePath, 'utf-8');
            const requestContext = { ...appContext, args: { path: activeRepoPath } };
            const newContent = await runRefactor(filePath, prompt, requestContext);
            const patch = diff.createPatch(filePath, originalContent, newContent);
            res.json({ patch, newContent });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.post('/api/test', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const { filePath, symbol, framework } = req.body;
            const requestContext = { ...appContext, args: { path: activeRepoPath } };
            const newContent = await runTestGeneration(filePath, symbol, framework, requestContext);
            res.json({ newContent });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.post('/api/apply-changes', async (req, res) => {
        try {
            const { filePath, newContent } = req.body;
            await fs.writeFile(filePath, newContent, 'utf-8');
            res.json({ success: true, message: `File ${filePath} updated.` });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    app.get('/api/prompt-library', (req, res) => {
        // We only send the parts the UI needs, not the prompt function
        const libraryForUI = TASK_LIBRARY.map(({ id, title, description, inputs }) => ({ id, title, description, inputs }));
        res.json(libraryForUI);
    });

    app.post('/api/generate', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const { prompt } = req.body;
            if (!prompt) {
                return res.status(400).json({ error: 'Prompt is required.' });
            }
            const requestContext: AppContext = { ...appContext, args: { path: activeRepoPath } };
            // You will need to create a 'runGenerate' function similar to 'runRefactor'
            const newContent = await runGenerate(prompt, requestContext);
            res.json({ newContent });
        } catch (error) {
            logger.error(error, `Error in /api/generate`);
            res.status(500).json({ error: (error as Error).message });
        }
    });

    app.post('/api/check-init', async (req, res) => {
        try {
            const { projectPath } = req.body;
            if (!projectPath) {
                return res.status(400).json({ error: 'projectPath is required.' });
            }
            const initFilePath = path.join(projectPath, 'Kinch_Code.md');
            await fs.access(initFilePath);
            res.json({ initialized: true });
        } catch (error) {
            // fs.access throws if file doesn't exist
            res.json({ initialized: false });
        }
    });

    // --- WebSocket Server ---
    wss.on('connection', (ws) => {
        logger.info('Client connected to WebSocket');
        const conversationHistory: ChatMessage[] = [];
        
    const onUpdate = (update: { type: string; content: string }) => {
        ws.send(JSON.stringify(update));
    };

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                let activeRepo = app.get('CODE_ANALYSIS_ROOT');
                if (activeRepo) {
                    activeRepo = path.resolve(activeRepo); 
                }
                
                if (!activeRepo && data.type !== 'agent-task') {
                     ws.send(JSON.stringify({ type: 'error', content: 'No active repository selected.' }));
                     return;
                }

                const agentContext = { ...appContext, args: { path: activeRepo } };

                if (data.type === 'agent-task-from-library') {
                    const { taskId, inputs } = data;
                    const taskTemplate = TASK_LIBRARY.find(t => t.id === taskId);
                    if (taskTemplate) {
                        const userTask = taskTemplate.prompt(inputs);
                        runAgent(userTask, agentContext, onUpdate);
                    } else {
                        onUpdate({ type: 'error', content: `Unknown task ID: ${taskId}`});
                    }
                } else if (data.type === 'agent-task') {
                    const { taskId, task } = data;
                    const onUpdate = (update: AgentUpdate) => ws.send(JSON.stringify({ ...update, taskId }));
                    runAgent(task, agentContext, onUpdate);
                } else if (data.type === 'get-report') {
                    const { taskId } = data;
                    const onUpdate = (update: AgentUpdate) => ws.send(JSON.stringify({ ...update, taskId }));
                    runReport(agentContext, onUpdate);
                } else if (data.type === 'start-init') {
                    const { taskId, projectPath } = data;
                    const onUpdate = (update: AgentUpdate) => ws.send(JSON.stringify({ ...update, taskId }));
                    const initContext = { ...appContext, args: { path: projectPath } };
                    runInit(initContext, onUpdate);
                } else if (data.type === 'start-indexing') {
                    const { taskId } = data;
                    const onUpdate = (update: AgentUpdate) => ws.send(JSON.stringify({ ...update, taskId }));
                    runIndex(agentContext, onUpdate);
                } else {
                    logger.info('Received chat message, checking if index is up to date...');

                    const activeRepoIndexer = new Indexer(activeRepo);
                    await activeRepoIndexer.init(); // Load its specific cache

                    if (!(await activeRepoIndexer.isIndexUpToDate())) {
                        ws.send(JSON.stringify({ type: 'index-required' }));
                        return;
                    }

                    const query = data.content;
                    conversationHistory.push({ role: 'user', content: query });
                    const contextStr = await getChatContext(query, agentContext);
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

                    let accumulatedText = '';
                        const responseArray = JSON.parse(`[${fullResponse.replace(/}\s*{/g, '},{')}]`);
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

    serverInstance = server;
    return server;
}

export function stopServer() {
    return new Promise<void>((resolve) => {
        if (serverInstance) {
            serverInstance.close(() => { serverInstance = null; resolve(); });
        } else {
            resolve();
        }
    });
}

async function mainEntryPoint() {
    try {
        const server = await startServer();
        server.listen(PORT, () => {
            logger.info(`Server is listening on http://localhost:${PORT}`);
        });
    } catch (error) {
        logger.error(error, 'The web server failed to start.');
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    mainEntryPoint();
}