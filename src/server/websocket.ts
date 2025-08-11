/**
 * @file src/server/websocket.ts
 * @description Manages WebSocket connections and message handling.
 */

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { AppContext, ChatMessage } from '../types.js';
import { runAgent, AgentUpdate } from '../core/agent-core.js';
import { runReport } from '../core/report-core.js';
import { runIndex, runInit } from '../core/index-core.js';
import { logger } from '../logger/index.js';
import { Indexer } from '../codebase/indexer.js';
import { getChatContext } from '../core/chat-core.js';
import { constructChatPrompt } from '../ai/index.js';

export function initializeWebSocketServer(server: import('http').Server, app: express.Application, appContext: Omit<AppContext, 'args'>) {
    const wss = new WebSocketServer({ server });
    const { aiProvider } = appContext;

    wss.on('connection', (ws: WebSocket) => {
        logger.info('Client connected to WebSocket');
        const conversationHistory: ChatMessage[] = [];
        
        const onUpdate = (update: AgentUpdate) => {
            ws.send(JSON.stringify(update));
        };
        
        ws.on('message', async (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());
                const activeRepo = app.get('CODE_ANALYSIS_ROOT');
                
                if (!activeRepo && data.type !== 'start-init') {
                     ws.send(JSON.stringify({ type: 'error', content: 'No active repository selected.' }));
                     return;
                }

                const agentContext = { ...appContext, args: { path: activeRepo } };

                // ... (rest of the WebSocket message handling logic remains the same)

            } catch (error) {
                logger.error(error, 'Error processing WebSocket message');
                ws.send(JSON.stringify({ type: 'error', content: (error as Error).message }));
            }
        });

        ws.on('close', () => logger.info('Client disconnected'));
    });
}