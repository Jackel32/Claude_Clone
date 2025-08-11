/**
 * @file src/server.ts
 * @description The Express.js webserver for the GUI.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { createAppContext } from './config/index.js';
import { initializeParser } from './codebase/index.js';
import { createApiRouter } from './server/routes.js';
import { initializeWebSocketServer } from './server/websocket.js';
import { logger } from './logger/index.js';

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CODE_ANALYSIS_ROOT = './code-to-analyze';

let serverInstance: http.Server | null = null;

export async function startServer() {
    await initializeParser();

    const app = express();
    const server = http.createServer(app);
    
    const appContext = await createAppContext();
    const reposDir = path.join(process.env.HOME || '/root', '.claude-code', 'repos');
    await fs.mkdir(reposDir, { recursive: true });

    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../public')));
    
    // Set initial value for the active repository path
    app.set('CODE_ANALYSIS_ROOT', '');

    // Apply middleware to all /api routes
    app.use('/api', (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });
    
    // Mount the API router
    app.use('/api', createApiRouter(appContext, reposDir, CODE_ANALYSIS_ROOT));
    
    // Initialize the WebSocket server with HTTP server and app context
    initializeWebSocketServer(server, app, appContext);

    serverInstance = server;
    return server;
}

export function stopServer() {
    return new Promise<void>((resolve) => {
        if (serverInstance) {
            serverInstance.close(() => {
                serverInstance = null;
                resolve();
            });
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