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
import { buildFileTree, listSymbolsInFile, buildTestableFileTree, detectProjectLanguages } from '../codebase/index.js';
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
        router.post('/test/set-active-repo', (req, res) => {
            const { repoPath } = req.body;
            req.app.set('CODE_ANALYSIS_ROOT', path.resolve(repoPath));
            logger.info(`[TEST] Active repository set to: ${req.app.get('CODE_ANALYSIS_ROOT')}`);
            res.json({ success: true });
        });
    }

    router.get('/file-tree', async (req, res) => {
        try {
            const tree = await buildFileTree(getActiveRepoPath(req));
            res.json(tree);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });
    
    router.get('/testable-file-tree', async (req, res) => {
        try {
            const tree = await buildTestableFileTree(getActiveRepoPath(req));
            res.json(tree);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.post('/list-symbols', async (req, res) => {
        try {
            const { filePath } = req.body;
            const symbols = await listSymbolsInFile(filePath);
            res.json(symbols);
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

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

    router.get('/branches', async (req, res) => {
        try {
            const branches = await getBranches(getActiveRepoPath(req));
            res.json(branches);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    router.post('/apply-changes', async (req, res) => {
        try {
            const { filePath, newContent } = req.body;
            await fs.writeFile(filePath, newContent, 'utf-8');
            res.json({ success: true, message: `File ${filePath} updated.` });
        } catch (error) { res.status(500).json({ error: (error as Error).message }); }
    });

    router.get('/prompt-library', (req, res) => {
        // We only send the parts the UI needs, not the prompt function
        const libraryForUI = TASK_LIBRARY.map(({ id, title, description, inputs }) => ({ id, title, description, inputs }));
        res.json(libraryForUI);
    });

    router.get('/tasks', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const projectLangs = await detectProjectLanguages(activeRepoPath);
            
            const filteredTasks = TASK_LIBRARY.filter(task => {
                // If a task has no language specified, it's universal.
                if (!task.supportedLanguages || task.supportedLanguages.length === 0) {
                    return true;
                }
                // Otherwise, check if any of the project's languages are supported by the task.
                return task.supportedLanguages.some(lang => projectLangs.includes(lang));
            });

            const libraryForUI = filteredTasks.map(({ id, title, description, inputs, group }) => ({ id, title, description, inputs, group }));
            res.json(libraryForUI);
        } catch (error) {
            logger.error(error, 'Error in /api/tasks');
            res.status(500).json({ error: (error as Error).message });
        }
    });

    router.post('/generate', async (req, res) => {
        try {
            const activeRepoPath = getActiveRepoPath(req);
            const { prompt } = req.body;
            if (!prompt) {
                return res.status(400).json({ error: 'Prompt is required.' });
            }
            const requestContext: AppContext = { ...appContext, args: { path: activeRepoPath } };
            const newContent = await runGenerate(prompt, requestContext);
            res.json({ newContent });
        } catch (error) {
            logger.error(error, `Error in /api/generate`);
            res.status(500).json({ error: (error as Error).message });
        }
    });

    router.post('/check-init', async (req, res) => {
        try {
            const { projectPath } = req.body;
            if (!projectPath) {
                return res.status(400).json({ error: 'projectPath is required.' });
            }
            const initFilePath = path.join(projectPath, 'Kinch_Code.md');
            
            // Log the path being checked for debugging
            logger.info(`Checking for init file at: ${initFilePath}`);

            await fs.access(initFilePath);
            res.json({ initialized: true });
        } catch (error: any) {
            // Only treat "file not found" as "not initialized"
            if (error.code === 'ENOENT') {
                res.json({ initialized: false });
            } else {
                // For all other errors (e.g., permissions), return a server error
                logger.error(error, `Error checking for init file at ${req.body.projectPath}`);
                res.status(500).json({ error: 'Failed to check for initialization file.' });
            }
        }
    });
    
    return router;
}