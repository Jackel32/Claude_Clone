/**
 * @file src/server/websocket.ts
 * @description Manages WebSocket connections and message handling.
 */

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { randomUUID } from 'crypto'; // Import for unique IDs
import { AppContext, ChatMessage } from '../types.js';
import { runAgent, AgentUpdate } from '../core/agent-core.js';
import { runReport } from '../core/report-core.js';
import { runIndex, runInit } from '../core/index-core.js';
import { logger } from '../logger/index.js';
import { getIndexer } from '../codebase/indexer.js';
import { getChatContext } from '../core/chat-core.js';
import { constructChatPrompt } from '../ai/index.js';
import { TASK_LIBRARY } from '../ai/prompt-library.js';

export function initializeWebSocketServer(server: import('http').Server, app: express.Application, appContext: Omit<AppContext, 'args'>) {
    const wss = new WebSocketServer({ server });
    const { aiProvider } = appContext;

    wss.on('connection', (ws: WebSocket) => {
        logger.info('Client connected to WebSocket');
        const conversationHistory: ChatMessage[] = [];
        // Map to store pending prompts: key is promptId, value is the resolver function
        const pendingPrompts = new Map<string, (answer: string) => void>();
        
        const onUpdate = (update: AgentUpdate) => {
            logger.info({ wsMessageOut: update }, 'Sending WebSocket message to client');
            ws.send(JSON.stringify(update));
        };
        
        ws.on('message', async (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());

                // Handle responses to agent prompts separately
                if (data.type === 'prompt-response' && data.promptId) {
                    if (pendingPrompts.has(data.promptId)) {
                        const resolve = pendingPrompts.get(data.promptId);
                        resolve?.(data.answer);
                        pendingPrompts.delete(data.promptId);
                    }
                    return; // Stop further processing for this message type
                }

                const activeRepo = app.get('CODE_ANALYSIS_ROOT');
                
                if (!activeRepo && data.type !== 'start-init' && data.type !== 'agent-task-from-library' && data.type !== 'chat') {
                     ws.send(JSON.stringify({ type: 'error', content: 'No active repository selected.' }));
                     return;
                }

                const agentContext = { ...appContext, args: { path: activeRepo } };
                const taskCallback = (update: Omit<AgentUpdate, 'taskId'>) => onUpdate({ ...update, taskId: data.taskId });

                switch (data.type) {
                    case 'start-init':
                        await runInit({ ...appContext, args: { path: data.projectPath } }, taskCallback);
                        break;
                    
                    case 'start-indexing':
                        await runIndex(agentContext, taskCallback);
                        break;

                    case 'get-report':
                        await runReport(agentContext, taskCallback);
                        break;
                    
                    case 'agent-task-from-library': {
                        const { taskId, inputs } = data;
                        const taskTemplate = TASK_LIBRARY.find(t => t.id === taskId);
                        if (taskTemplate) {
                            const userTask = taskTemplate.prompt(inputs);
                            
                            const onAgentPrompt = async (question: string): Promise<string> => {
                                const promptId = randomUUID();
                                const PROMPT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

                                return new Promise((resolve, reject) => {
                                    const timeoutId = setTimeout(() => {
                                        pendingPrompts.delete(promptId);
                                        reject(new Error(`User did not respond to prompt within ${PROMPT_TIMEOUT / 60000} minutes.`));
                                    }, PROMPT_TIMEOUT);

                                    pendingPrompts.set(promptId, (answer: string) => {
                                        clearTimeout(timeoutId);
                                        resolve(answer);
                                    });

                                    const promptMessage = { type: 'prompt', question, taskId: data.taskId, promptId };
                                    ws.send(JSON.stringify(promptMessage));
                                });
                            };
                            await runAgent(userTask, agentContext, taskCallback, onAgentPrompt);
                        } else {
                            onUpdate({ type: 'error', content: `Unknown task ID: ${taskId}`, taskId: data.taskId });
                        }
                        break;
                    }

                    case 'chat': {
                        const indexer = await getIndexer(activeRepo); // Use singleton getter

                        // If index is out of date, update it automatically inside this handler
                        if (!(await indexer.isIndexUpToDate())) {
                            ws.send(JSON.stringify({ type: 'start' }));
                            ws.send(JSON.stringify({ type: 'chunk', content: 'Project index is out of date. Updating now, please wait...\n\n' }));

                            // Create a temporary callback to stream indexing progress directly to the chat window
                            const indexCallback = (update: AgentUpdate) => {
                                if (update.type === 'thought' || update.type === 'action' || update.type === 'finish' || update.type === 'error') {
                                    ws.send(JSON.stringify({ type: 'chunk', content: `[INDEX] ${update.content}\n` }));
                                }
                            };
                            
                            await runIndex(agentContext, indexCallback);
                            ws.send(JSON.stringify({ type: 'chunk', content: '\nIndexing complete. Now processing your request...\n\n' }));
                        }

                        // --- Original chat logic now proceeds with an up-to-date index ---
                        const query = data.content;
                        conversationHistory.push({ role: 'user', content: query });

                        const contextStr = await getChatContext(query, agentContext);
                        const prompt = constructChatPrompt(conversationHistory, contextStr);
                        const stream = await aiProvider.invoke(prompt, true);

                        ws.send(JSON.stringify({ type: 'start' }));
                        const reader = stream.getReader();
                        const decoder = new TextDecoder();
                        let fullResponse = '';
                        let accumulatedText = '';

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            fullResponse += decoder.decode(value, { stream: true });
                        }
                        
                        try {
                            const jsonArrayString = `[${fullResponse.replace(/}\s*{/g, '},{')}]`;
                            const responseArray = JSON.parse(jsonArrayString);
                            for (const chunk of responseArray) {
                                const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) {
                                    ws.send(JSON.stringify({ type: 'chunk', content: text }));
                                    accumulatedText += text;
                                }
                            }
                        } catch (error) {
                             ws.send(JSON.stringify({ type: 'chunk', content: fullResponse }));
                             accumulatedText = fullResponse;
                             logger.warn('Could not parse AI stream as JSON, sending raw text.');
                        }

                        conversationHistory.push({ role: 'assistant', content: accumulatedText });
                        ws.send(JSON.stringify({ type: 'end' }));
                        break;
                    }

                    default:
                        logger.warn(`Unknown WebSocket message type: ${data.type}`);
                        ws.send(JSON.stringify({ type: 'error', content: `Unknown message type: ${data.type}` }));
                }

            } catch (error) {
                logger.error(error, 'Error processing WebSocket message');
                ws.send(JSON.stringify({ type: 'error', content: (error as Error).message }));
            }
        });

        ws.on('close', () => {
            logger.info('Client disconnected');
            // Clean up any pending prompts to prevent agent from hanging
            if (pendingPrompts.size > 0) {
                logger.warn(`Client disconnected with ${pendingPrompts.size} pending prompts. Rejecting them.`);
                for (const [promptId, resolve] of pendingPrompts.entries()) {
                    // The promise will be rejected by the timeout, but we ensure cleanup
                    pendingPrompts.delete(promptId);
                }
            }
        });
    });
}
