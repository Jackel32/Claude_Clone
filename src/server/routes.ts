/**
 * @file src/server/routes.ts
 * @description Defines all Express API routes for the application.
 */

import express, { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import * as diff from 'diff';
import { AppContext } from '../types.js';
import { constructDiffAnalysisPrompt } from '../ai/prompts.js';
import { getRecentCommits, getDiffBetweenCommits, cloneRepo, getBranches, getDiffBetweenBranches } from '../fileops/index.js';
import { buildFileTree, listSymbolsInFile, buildTestableFileTree } from '../codebase/index.js';
import { runAddDocs } from '../core/add-docs-core.js';
import { runRefactor } from '../core/refactor-core.js';
import { runTestGeneration } from '../core/test-core.js';
import { runGenerate } from '../core/generate-core.js';
import { TASK_LIBRARY } from '../ai/prompt-library.js';
import { logger } from '../logger/index.js';

export function createApiRouter(appContext: Omit<AppContext, 'args'>, reposDir: string, CODE_ANALYSIS_ROOT: string): Router {
    const router = Router();
    const { aiProvider } = appContext;

    const getActiveRepoPath = (req: express.Request): string => {
        const repoPath = req.app.get('CODE_ANALYSIS_ROOT');
        if (!repoPath) throw new Error("No active repository selected.");
        return repoPath;
    }

    router.get('/commits', async (req, res) => {
        try {
            const commits = await getRecentCommits(getActiveRepoPath(req));
            res.json(commits);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.post('/diff', async (req, res) => {
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

    router.use('/api', (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });

    // --- API ENDPOINTS ---
    router.get('/projects', async (req, res) => {
        try {
            const clonedEntries = await fs.readdir(reposDir, { withFileTypes: true });
            const clonedProjects = clonedEntries
                .filter(e => e.isDirectory())
                .map(e => ({ name: e.name, path: path.join(reposDir, e.name) }));

            const localEntries = await fs.readdir(CODE_ANALYSIS_ROOT, { withFileTypes: true });
            const localProjects = localEntries
                .filter(e => e.isDirectory())
                .map(e => ({ name: e.name, path: path.join(CODE_ANALYSIS_ROOT, e.name) }));

            res.json({ cloned: clonedProjects, local: localProjects });
        } catch (error) {
            logger.error(error, 'Error in /api/projects');
            res.status(500).json({ error: (error as Error).message });
        }
    });
    
    router.post('/set-active-project', (req, res) => {
        const { projectPath } = req.body;
        req.app.set('CODE_ANALYSIS_ROOT', projectPath);
        logger.info(`Active repository set to: ${projectPath}`);
        res.json({ success: true });
    });

    router.post('/repos/clone', async (req, res) => {
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

    router.post('/repos/active', (req, res) => {
        const { repoName } = req.body;
        const activeRepoPath = path.join(reposDir, repoName);
        req.app.set('CODE_ANALYSIS_ROOT', activeRepoPath);
        logger.info(`Active repository set to: ${activeRepoPath}`);
        res.json({ success: true });
    });

    if (process.env.NODE_ENV === 'test') {
        router.post('/api/test/set-active-repo', (req, res) => {
            const { repoPath } = req.body;
            req.app.set('CODE_ANALYSIS_ROOT', path.resolve(repoPath));
            logger.info(`[TEST] Active repository set to: ${req.app.get('CODE_ANALYSIS_ROOT')}`);
            res.json({ success: true });
        });
    }

    router.get('/api/file-tree', async (req, res) => {
        try {
            const tree = await buildFileTree(getActiveRepoPath(req));
            res.json(tree);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });
    
    router.get('/api/testable-file-tree', async (req, res) => {
        try {
            const tree = await buildTestableFileTree(getActiveRepoPath(req));
            res.json(tree);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.post('/api/list-symbols', async (req, res) => {
        try {
            const { filePath } = req.body;
            const symbols = await listSymbolsInFile(filePath);
            res.json(symbols);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.get('/api/commits', async (req, res) => {
        try {
            const commits = await getRecentCommits(getActiveRepoPath(req));
            res.json(commits);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.post('/api/diff', async (req, res) => {
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

    router.get('/api/branches', async (req, res) => {
        try {
            const branches = await getBranches(getActiveRepoPath(req));
            res.json(branches);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    router.post('/api/add-docs', async (req, res) => {
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
    
    router.post('/api/refactor', async (req, res) => {
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

    router.post('/api/test', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const { filePath, symbol, framework } = req.body;
            const requestContext = { ...appContext, args: { path: activeRepoPath } };
            const newContent = await runTestGeneration(filePath, symbol, framework, requestContext);
            res.json({ newContent });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.post('/api/apply-changes', async (req, res) => {
        try {
            const { filePath, newContent } = req.body;
            await fs.writeFile(filePath, newContent, 'utf-8');
            res.json({ success: true, message: `File ${filePath} updated.` });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.get('/api/prompt-library', (req, res) => {
        // We only send the parts the UI needs, not the prompt function
        const libraryForUI = TASK_LIBRARY.map(({ id, title, description, inputs }) => ({ id, title, description, inputs }));
        res.json(libraryForUI);
    });

    router.post('/api/generate', async (req, res) => {
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

    router.post('/api/check-init', async (req, res) => {
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
    
    return router;
}