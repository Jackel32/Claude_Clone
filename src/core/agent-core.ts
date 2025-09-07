/**
 * @file src/core/agent-core.ts
 * @description Core agent logic with a hybrid gather-plan-confirm workflow.
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { constructPlanPrompt, constructReActPrompt, PlanStep } from '../ai/index.js';
import { AppContext } from '../types.js';
import { extractJson } from '../commands/handlers/utils.js';
import { getSymbolContent, listSymbolsInFile, queryVectorIndex, scanProject } from '../codebase/index.js';
import { runIndex } from './index-core.js';
import { ALL_TOOLS, TASK_LIBRARY } from '../ai/index.js';

const execAsync = promisify(exec);

export type AgentUpdate = {
    type: 'thought' | 'action' | 'observation' | 'finish' | 'error' | 'stream-start' | 'stream-chunk' | 'stream-end';
    content: any;
    taskId?: string;
};
export type AgentCallback = (update: AgentUpdate) => void;

export async function runAgent(
    userTask: string,
    context: AppContext,
    onUpdate: AgentCallback,
    onPrompt: (question: string) => Promise<string>,
    requiredTools: string[],
    taskTemplateId?: string
) {
    const { logger, aiProvider, profile } = context;
    const projectRoot = path.resolve(context.args.path || '.');

    // --- Pre-run Index Check ---
    try {
        await queryVectorIndex(projectRoot, "test query", aiProvider, 1);
    } catch (e) {
        if (e instanceof Error && e.message.includes('Vector index not found')) {
            onUpdate({ type: 'thought', content: 'Codebase index is not ready. Running indexer before proceeding...' });
            await runIndex(context, onUpdate);
        } else {
            onUpdate({ type: 'error', content: `Failed during pre-run index check: ${(e as Error).message}` });
            return;
        }
    }

    const files = await scanProject(projectRoot);
    let initialContext = `Files in the project:\n${files.join('\n')}`;

    if (taskTemplateId === 'analyze-task-tools') {
      try {
          const libraryJson = JSON.stringify(TASK_LIBRARY, null, 2);
          initialContext = `You have been asked to analyze the following TASK_LIBRARY:\n\n${libraryJson}\n\n---\n\n${initialContext}`;
      } catch (e) {
          logger.error(e, "Failed to serialize TASK_LIBRARY for agent context");
      }
    }

    let history = '';
    const maxTurns = 20;

    for (let i = 0; i < maxTurns; i++) {
        let responseJson;
        try {
            const prompt = constructReActPrompt(userTask, history, initialContext, requiredTools as (keyof typeof ALL_TOOLS)[]);
            const response = await aiProvider.invoke(prompt, false);
            const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawResponse) throw new Error("AI returned an empty response.");

            try {
                responseJson = JSON.parse(extractJson(rawResponse));
            } catch (parseError) {
                const errorMessage = `Error: Your last response was not valid JSON. Please correct the syntax. Error details: ${(parseError as Error).message}`;
                onUpdate({ type: 'thought', content: 'Received malformed JSON, attempting to self-correct...' });
                history += `\nObservation: ${errorMessage.replace(/\n/g, ' ')}`;
                continue; // Give the agent a chance to recover
            }

            const { thought, action } = responseJson;
            onUpdate({ type: 'thought', content: thought });
            history += `\nThought: ${thought}\nAction: ${JSON.stringify(action)}`;

            if (action.tool === 'finish') {
                onUpdate({ type: 'finish', content: action.summary });
                return;
            }

            // --- NEW: Handle the proposePlan tool separately ---
            if (action.tool === 'proposePlan') {
                if (typeof action.goal !== 'string') {
                    throw new Error("Action 'proposePlan' is missing a 'goal'.");
                }
                
                // The context for the planner is the entire history of the agent's information gathering
                const planContext = history; 
                onUpdate({ type: 'thought', content: `Okay, I have enough information. I will now create a plan to: ${action.goal}` });
                const planPrompt = constructPlanPrompt(action.goal, planContext);
                const planResponse = await aiProvider.invoke(planPrompt, false);
                const rawPlan = planResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawPlan) throw new Error("The AI failed to generate a plan.");

                const plan = JSON.parse(extractJson(rawPlan)) as PlanStep[];

                let planString = "Here is the plan I've constructed:\n";
                plan.forEach((step, index) => {
                    planString += `\nStep ${index + 1}: ${step.operation}\n  - Reasoning: ${step.reasoning}\n`;
                });
                planString += "\nDo you approve this plan? (yes/no)";

                const userApproval = await onPrompt(planString);

                if (userApproval.trim().toLowerCase() !== 'yes') {
                    onUpdate({ type: 'finish', content: 'Plan rejected by user. Task aborted.' });
                    return;
                }

                // --- Execute the approved plan ---
                onUpdate({ type: 'thought', content: `Plan approved. Executing ${plan.length} steps...` });
                for (const step of plan) {
                    onUpdate({ type: 'thought', content: `Executing: ${step.reasoning}` });
                    onUpdate({ type: 'action', content: `[${step.operation}]` });
                    let stepObservation = '';
                    switch (step.operation) {
                        case 'writeFile':
                            await fs.writeFile(step.path!, step.content!, 'utf-8');
                            stepObservation = `Successfully wrote to ${step.path}.`;
                            break;
                        case 'executeCommand':
                            const { stdout } = await execAsync(step.command!);
                            stepObservation = `Command output:\n${stdout}`;
                            break;
                        // Note: Read-only tools are not part of the execution plan
                    }
                    onUpdate({ type: 'observation', content: stepObservation });
                }

                onUpdate({ type: 'finish', content: 'Successfully executed all steps of the plan.' });
                return; // End the agent's run
            }

            onUpdate({ type: 'action', content: `[${action.tool}] Executing...` });
            let observation = '';
            // --- This switch now ONLY contains read-only tools ---
            switch (action.tool) {
                case 'queryVectorIndex':
                    observation = await queryVectorIndex(projectRoot, action.query, aiProvider, profile.rag?.topK || 5);
                    break;
                case 'listFiles':
                    observation = `The following files were found:\n${(await scanProject(projectRoot)).join('\n')}`;
                    break;
                case 'readFile':
                    observation = await fs.readFile(action.path, 'utf-8');
                    break;
                case 'listSymbols':
                    observation = `Symbols in ${action.path}:\n${(await listSymbolsInFile(action.path)).join('\n')}`;
                    break;
                case 'readSymbol':
                    observation = await getSymbolContent(action.path, action.symbolName) || `Symbol ${action.symbolName} not found.`;
                    break;
                case 'askUser':
                    observation = `The user responded: "${await onPrompt(action.question)}"`;
                    break;
                default:
                    observation = `Error: The tool "${action.tool}" is not a valid information-gathering tool. You must propose a plan to perform actions like 'writeFile' or 'executeCommand'.`;
            }
            const sanitizedObservation = observation.replace(/\n/g, ' ');
            onUpdate({ type: 'observation', content: sanitizedObservation });
            history += `\nObservation: ${sanitizedObservation}`;
        } catch (error) {
            const err = error as Error;
            onUpdate({ type: 'error', content: `A critical error occurred: ${err.message}` });
            logger.error(err, 'Agent task failed');
            return;
        }
    }
    onUpdate({ type: 'error', content: 'Task ended due to reaching the maximum number of turns.' });
}