/**
 * @file src/server.ts
 * @description The Express.js webserver for the GUI.
 */

import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import * as diff from 'diff';
import * as os from 'os';

import { getAppContext } from './config/index.js';
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
import { runIndex } from './core/index-core.js';
import { runGenerate } from './core/generate-core.js';
import { TASK_LIBRARY } from './ai/prompt-library.js';
import { getHistory, saveHistory } from './core/db.js';

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CODE_ANALYSIS_ROOT = './code-to-analyze';

let serverInstance: http.Server | null = null;

/**
 * A higher-order function to wrap async route handlers, providing
 * centralized error handling and removing boilerplate.
 * @param fn The async route handler function to wrap.
 * @returns An Express route handler.
 */
const asyncWrapper = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next))
            .then(data => res.json(data)) // Automatically send successful responses as JSON
            .catch(error => {
                logger.error(error, `Error in API endpoint: ${req.method} ${req.path}`);
                res.status(500).json({ error: (error as Error).message });
            });
};

async function validateProjectPath(projectPath: string): Promise<string> {
    if (!projectPath || typeof projectPath !== 'string') {
        throw new Error("A valid 'projectPath' must be provided with the request.");
    }
    // For security, resolve the path and ensure it's within an expected directory.
    // This is a basic check; you might want to enhance it based on your security needs.
    const resolvedPath = path.resolve(projectPath);
    // For example, ensure it's within the reposDir or the mounted code analysis root
    // This is left as an exercise for the user to implement based on their specific setup.
    await fs.access(resolvedPath); // Check if the directory exists
    return resolvedPath;
}

export async function startServer() {
    await initializeParser();

    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    const appContext = await getAppContext();
    
    // Use os.homedir() for consistency with the config module
    const reposDir = path.join(os.homedir(), '.claude-code', 'repos');
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
    app.get('/api/projects', asyncWrapper(async (req, res) => {
        const clonedEntries = await fs.readdir(reposDir, { withFileTypes: true });
        const clonedProjects = clonedEntries.filter(e => e.isDirectory()).map(e => ({ name: e.name, path: path.join(reposDir, e.name) }));

        const localEntries = await fs.readdir(CODE_ANALYSIS_ROOT, { withFileTypes: true });
        const localProjects = localEntries.filter(e => e.isDirectory()).map(e => ({ name: e.name, path: path.join(CODE_ANALYSIS_ROOT, e.name) }));
        
        // No need for res.json() here, the wrapper handles it.
        return { cloned: clonedProjects, local: localProjects };
    }));

    app.post('/api/repos/clone', asyncWrapper(async (req, res) => {
        const { repoUrl, pat } = req.body;
        const repoName = path.basename(repoUrl, '.git');
        const localPath = path.join(reposDir, repoName);
        await cloneRepo(repoUrl, pat, localPath);
        return { success: true, repoName };
    }));

    app.post('/api/repos/active', asyncWrapper(async (req, res) => {
        const { repoName } = req.body;
        const activeRepoPath = path.join(reposDir, repoName);
        app.set('CODE_ANALYSIS_ROOT', activeRepoPath);
        logger.info(`Active repository set to: ${activeRepoPath}`);
        return { success: true };
    }));

    if (process.env.NODE_ENV === 'test') {
        app.post('/api/test/set-active-repo', asyncWrapper(async (req, res) => {
            const { repoPath } = req.body;
            app.set('CODE_ANALYSIS_ROOT', path.resolve(repoPath));
            logger.info(`[TEST] Active repository set to: ${app.get('CODE_ANALYSIS_ROOT')}`);
            return { success: true };
        }));
    }

    app.post('/api/file-tree', asyncWrapper(async (req, res) => {
        const projectPath = await validateProjectPath(req.body.projectPath);
        const tree = await buildFileTree(projectPath);
        return tree;
    }));

    app.get('/api/testable-file-tree', asyncWrapper(async (req, res) => {
        const projectPath = await validateProjectPath(req.body.projectPath);
        const tree = await buildTestableFileTree(projectPath);
        return tree;
    }));

    app.post('/api/list-symbols', asyncWrapper(async (req, res) => {
        const { filePath } = req.body;
        await validateProjectPath(path.dirname(filePath));
        const symbols = await listSymbolsInFile(filePath);
        return symbols;
    }));

    app.get('/api/commits', asyncWrapper(async (req, res) => {
        const projectPath = await validateProjectPath(req.body.projectPath);
        const commits = await getRecentCommits(projectPath);
        return commits;
    }));

    app.post('/api/diff', asyncWrapper(async (req, res) => {
        const projectPath = await validateProjectPath(req.body.projectPath);
        const { startCommit, endCommit, baseBranch, compareBranch } = req.body;
        let diffContent = '';

        if (startCommit && endCommit) {
            diffContent = await getDiffBetweenCommits(startCommit, endCommit, projectPath);
        } else if (baseBranch && compareBranch) {
            diffContent = await getDiffBetweenBranches(baseBranch, compareBranch, projectPath);
        } else {
            throw new Error('Invalid diff request. Provide either commits or branches.');
        }

        let analysis = 'AI analysis could not be generated for this diff.';
        if (diffContent && diffContent.trim()) {
            const analysisPrompt = constructDiffAnalysisPrompt(diffContent);
            const response = await appContext.aiProvider.invoke(analysisPrompt, false);
            analysis = response?.candidates?.[0]?.content?.parts?.[0]?.text || analysis;
        }
        return { patch: diffContent, analysis };
    }));

    app.post('/api/branches', asyncWrapper(async (req, res) => {
        const projectPath = await validateProjectPath(req.body.projectPath);
        const branches = await getBranches(projectPath);
        return branches;
    }));

    app.post('/api/add-docs', asyncWrapper(async (req, res) => {
        const { filePath, projectPath } = req.body;
        await validateProjectPath(projectPath);
        const originalContent = await fs.readFile(filePath, 'utf-8');
        const requestContext = { ...appContext, args: { path: projectPath } };
        const newContent = await runAddDocs(originalContent, requestContext);
        const patch = diff.createPatch(filePath, originalContent, newContent);
        return { patch, newContent };
    }));

    app.post('/api/refactor', asyncWrapper(async (req, res) => {
        const activeRepoPath = getActiveRepoPath(req);
        const { filePath, prompt } = req.body;
            const originalContent = await fs.readFile(filePath, 'utf-8');
            const requestContext = { ...appContext, args: { path: activeRepoPath } };
            const newContent = await runRefactor(filePath, prompt, requestContext);
            const patch = diff.createPatch(filePath, originalContent, newContent);
            return { patch, newContent };
    }));

    app.post('/api/test', asyncWrapper(async (req, res) => {
        const activeRepoPath = getActiveRepoPath(req);
        const { filePath, symbol, framework } = req.body;
        const requestContext = { ...appContext, args: { path: activeRepoPath } };
        const newContent = await runTestGeneration(filePath, symbol, framework, requestContext);
        return { newContent };
    }));

    app.post('/api/apply-changes', asyncWrapper(async (req, res) => {
        const { filePath, newContent } = req.body;
        await fs.writeFile(filePath, newContent, 'utf-8');
        return { success: true, message: `File ${filePath} updated.` };
    }));

    app.get('/api/prompt-library', asyncWrapper(async (req, res) => {
        // We only send the parts the UI needs, not the prompt function
        const libraryForUI = TASK_LIBRARY.map(({ id, title, description, inputs }) => ({ id, title, description, inputs }));
        return { library: libraryForUI };
    }));

    app.post('/api/generate', asyncWrapper(async (req, res) => {
        const activeRepoPath = getActiveRepoPath(req);
        const { prompt } = req.body;
        if (!prompt) {
            return { error: 'Prompt is required.' };
        }
        const requestContext: AppContext = { ...appContext, args: { path: activeRepoPath } };
        // You will need to create a 'runGenerate' function similar to 'runRefactor'
        const newContent = await runGenerate(prompt, requestContext);
        return { newContent };
    }));

    // --- WebSocket Server ---
    wss.on('connection', (ws) => {
        logger.info('Client connected to WebSocket');
        let conversationHistory: ChatMessage[] = [];
        let activeRepoPath: string | null = null;
        let currentSessionId: string | null = null;
        
        const onUpdate = (update: { type: string; content: string }) => {
            ws.send(JSON.stringify(update));
        };

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.sessionId && !currentSessionId) {
                    currentSessionId = data.sessionId;
                    // Load the history for this session when it's first identified
                    // FIX: Use data.sessionId directly, as we know it's a string here.
                    conversationHistory = await getHistory(data.sessionId);
                    if (conversationHistory.length > 0) {
                        // Send the loaded history back to the client so it can catch up
                        ws.send(JSON.stringify({ type: 'history-restored', history: conversationHistory }));
                    }
                }

                if (data.projectPath && !activeRepoPath) {
                    activeRepoPath = await validateProjectPath(data.projectPath);
                    logger.info(`WebSocket connection now targeting repository: ${activeRepoPath}`);
                }

                if (!activeRepoPath && data.type !== 'agent-task') {
                    ws.send(JSON.stringify({ type: 'error', content: 'No active repository selected.' }));
                    return;
                }

                const agentContext = { ...appContext, args: { path: activeRepoPath } };

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
                } else if (data.type === 'start-indexing') {
                    const { taskId } = data;
                    const onUpdate = (update: AgentUpdate) => ws.send(JSON.stringify({ ...update, taskId }));
                    runIndex(agentContext, onUpdate);
                } else {
                    if (!activeRepoPath) {
                        ws.send(JSON.stringify({ type: 'error', content: 'Cannot start chat. No project path has been set for this session.' }));
                        return;
                    }

                    logger.info('Received chat message, checking if index is up to date...');

                    const activeRepoIndexer = new Indexer(activeRepoPath);
                    await activeRepoIndexer.init(); // Load its specific cache

                    if (!(await activeRepoIndexer.isIndexUpToDate())) {
                        ws.send(JSON.stringify({ type: 'index-required' }));
                        return;
                    }

                    const query = data.content;
                    conversationHistory.push({ role: 'user', content: query });
                    const contextStr = await getChatContext(query, agentContext);
                    const prompt = constructChatPrompt(conversationHistory, contextStr);
                    const stream = await appContext.aiProvider.invoke(prompt, true);

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