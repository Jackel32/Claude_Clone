/**
 * @file src/server/websocket.ts
 * @description Manages WebSocket connections and message handling.
 */

import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { randomUUID } from 'crypto';
import { AppContext, ChatMessage } from '../types.js';
import { runAgent, AgentUpdate } from '../core/agent-core.js';
import { runReport } from '../core/report-core.js';
import { runIndex, runInit } from '../core/index-core.js';
import { logger } from '../logger/index.js';
import { getIndexer } from '../codebase/indexer.js';
import { getChatContext } from '../core/chat-core.js';
import { constructChatPrompt, TASK_LIBRARY, ToolName } from '../ai/index.js';

export function initializeWebSocketServer(server: import('http').Server, app: express.Application, appContext: Omit<AppContext, 'args'>) {
    const wss = new WebSocketServer({ server });
    const { aiProvider } = appContext;

    wss.on('connection', (ws: WebSocket) => {
        logger.info('Client connected to WebSocket');
        const conversationHistory: ChatMessage[] = [];
        const pendingPrompts = new Map<string, (answer: string) => void>();
        let pendingUserMessage: any = null;

        const onUpdate = (update: AgentUpdate) => {
            logger.info({ wsMessageOut: update }, 'Sending WebSocket message to client');
            ws.send(JSON.stringify(update));
        };

        // --- Refactored Chat Logic ---
        async function handleChatLogic(query: string, context: AppContext) {
            conversationHistory.push({ role: 'user', content: query });

            const contextStr = await getChatContext(query, context);
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
                const responseArray = JSON.parse(`[${fullResponse.replace(/}\s*{/g, '},{')}]`);
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
            }

            conversationHistory.push({ role: 'assistant', content: accumulatedText });
            ws.send(JSON.stringify({ type: 'end' }));
        }
        
        ws.on('message', async (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'prompt-response' && data.promptId) {
                    if (pendingPrompts.has(data.promptId)) {
                        const resolve = pendingPrompts.get(data.promptId);
                        resolve?.(data.answer);
                        pendingPrompts.delete(data.promptId);
                    }
                    return;
                }

                const activeRepo = app.get('CODE_ANALYSIS_ROOT');
                
                if (!activeRepo && !['start-init', 'agent-task-from-library', 'chat'].includes(data.type)) {
                     ws.send(JSON.stringify({ type: 'error', content: 'No active repository selected.' }));
                     return;
                }

                const agentContext: AppContext = { ...appContext, args: { path: activeRepo } };
                
                const taskCallback = async (update: Omit<AgentUpdate, 'taskId'>) => {
                    const fullUpdate = { ...update, taskId: data.taskId };
                    onUpdate(fullUpdate);

                    if (fullUpdate.type === 'finish' && pendingUserMessage && data.type === 'start-indexing') {
                        logger.info('Indexing finished, processing pending chat message directly.');
                        const messageToProcess = pendingUserMessage;
                        pendingUserMessage = null; // Clear it first
                        await handleChatLogic(messageToProcess.content, agentContext);
                    }
                };
                
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
                        const { taskId, taskTemplateId, inputs } = data;
                        const taskTemplate = TASK_LIBRARY.find(t => t.id === taskTemplateId);
                        if (taskTemplate) {
                            const userTask = taskTemplate.prompt(inputs);
                            
                            const onAgentPrompt = async (question: string): Promise<string> => {
                                const promptId = randomUUID();
                                const PROMPT_TIMEOUT = 5 * 60 * 1000;

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
                            await runAgent(userTask, agentContext, taskCallback, onAgentPrompt, taskTemplate.requiredTools as ToolName[], taskTemplateId);
                        } else {
                            onUpdate({ type: 'error', content: `Unknown task ID: ${taskTemplateId}`, taskId: taskId });
                        }
                        break;
                    }

                    case 'chat': {
                        const indexer = await getIndexer(activeRepo);

                        if (!(await indexer.isIndexUpToDate())) {
                            pendingUserMessage = data; // Save the message
                            ws.send(JSON.stringify({ type: 'index-required' }));
                            return;
                        }
                        // If index is ready, just call the main chat logic.
                        await handleChatLogic(data.content, agentContext);
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
            if (pendingPrompts.size > 0) {
                logger.warn(`Client disconnected with ${pendingPrompts.size} pending prompts. Rejecting them.`);
                for (const [promptId, resolve] of pendingPrompts.entries()) {
                    pendingPrompts.delete(promptId);
                }
            }
        });
    });
}