/**
 * @file src/core/agent-core.ts
 * @description Core ReAct agent logic, decoupled from any UI.
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { constructReActPrompt, constructPlanPrompt, PlanStep } from '../ai/index.js';
import { AppContext } from '../types.js';
import { extractJson } from '../commands/handlers/utils.js';
import { getSymbolContent, listSymbolsInFile, queryVectorIndex, scanProject } from '../codebase/index.js';
import { getRecentCommits, getDiffBetweenCommits } from '../fileops/index.js';
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
  const files = await scanProject(context.args.path || '.');
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

  const allToolNames = Object.keys(ALL_TOOLS);
  for (const tool of requiredTools) {
      if (!allToolNames.includes(tool)) {
          onUpdate({ type: 'error', content: `Task requires tool "${tool}", but it is not a valid tool.` });
          return;
      }
  }

  for (let i = 0; i < maxTurns; i++) {
    let responseJson;
    try {
      const prompt = constructReActPrompt(
        userTask,
        history,
        initialContext,
        requiredTools as (keyof typeof ALL_TOOLS)[]
      );
      const response = await aiProvider.invoke(prompt, false);
      const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawResponse) throw new Error("AI returned an empty response.");

      try {
        responseJson = JSON.parse(extractJson(rawResponse));
      } catch (parseError) {
        const errorMessage = `Error: Your last response was not valid JSON. Please correct the syntax and provide a single, valid JSON object with 'thought' and 'action'. Error details: ${(parseError as Error).message}`;
        onUpdate({ type: 'thought', content: 'Received malformed JSON, attempting to self-correct...' });
        history += `\nObservation: ${errorMessage}`;
        continue;
      }

      if (!responseJson || typeof responseJson.thought !== 'string' || typeof responseJson.action !== 'object' || responseJson.action === null || typeof responseJson.action.tool !== 'string') {
        history += `\nObservation: Error - AI response was not in the expected format.`;
        onUpdate({ type: 'thought', content: 'Received incomplete JSON, attempting to self-correct...' });
        continue;
      }

      const { thought, action } = responseJson;
      onUpdate({ type: 'thought', content: thought });
      history += `\nThought: ${thought}\nAction: ${JSON.stringify(action)}`;

      if (action.tool === 'finish') {
        onUpdate({ type: 'finish', content: action.summary });
        return;
      }
      
      onUpdate({ type: 'action', content: `[${action.tool}] Executing...` });
      let observation = '';
      try {
        switch (action.tool) {
          case 'writeFile':
            if (typeof action.path !== 'string' || typeof action.content !== 'string') {
              throw new Error("Action 'writeFile' is missing 'path' or 'content'.");
            }
            await fs.writeFile(action.path, action.content, 'utf-8');
            observation = `Successfully wrote to ${action.path}.`;
            break;

          case 'executeCommand':
            if (typeof action.command !== 'string') {
                throw new Error("Action 'executeCommand' is missing 'command'.");
            }
            const { stdout } = await execAsync(action.command);
            observation = `Command output:\n${stdout}`;
            break;

          case 'readFile':
            if (typeof action.path !== 'string') {
                throw new Error("Action 'readFile' is missing 'path'.");
            }
            observation = await fs.readFile(action.path, 'utf-8');
            break;

          case 'listFiles':
            const files = await scanProject(context.args.path || '.');
            observation = `The following files were found in the project:\n${files.join('\n')}`;
            break;

          case 'listSymbols':
            if (typeof action.path !== 'string') {
              throw new Error("Action 'listSymbols' is missing 'path'.");
            }
            const symbols = await listSymbolsInFile(action.path);
            observation = `The file "${action.path}" contains the following symbols:\n${symbols.join('\n')}`;
            break;
            
          case 'readSymbol':
            if (typeof action.path !== 'string' || typeof action.symbolName !== 'string') {
              throw new Error("Action 'readSymbol' is missing 'path' or 'symbolName'.");
            }
            const content = await getSymbolContent(action.path, action.symbolName);
            if (!content) {
              throw new Error(`Symbol "${action.symbolName}" not found in "${action.path}".`);
            }
            observation = `Content of symbol "${action.symbolName}" from "${action.path}":\n${content}`;
            break;

          case 'getRecentCommits':
            const commits = await getRecentCommits(context.args.path || '.');
            observation = `Recent commits:\n${commits.join('\n')}`;
            break;
            
          case 'getGitDiff':
            if (typeof action.startCommit !== 'string' || typeof action.endCommit !== 'string') {
              throw new Error("Action 'getGitDiff' is missing 'startCommit' or 'endCommit'.");
            }
            observation = await getDiffBetweenCommits(action.startCommit, action.endCommit, context.args.path || '.');
            break;
          
          case 'queryVectorIndex':
            if (typeof action.query !== 'string') {
              throw new Error("Action 'queryVectorIndex' is missing a 'query'.");
            }
            const topK = profile.rag?.topK || 5; // Use a slightly larger topK for the agent
            const contextString = await queryVectorIndex(context.args.path || '.', action.query, aiProvider, topK);
            observation = `Vector index query for "${action.query}" returned the following context:\n${contextString}`;
            break;

          case 'askUser':
            if (typeof action.question !== 'string') {
              throw new Error("Action 'askUser' is missing a 'question'.");
            }
            // Use the callback instead of inquirer
            const answer = await onPrompt(action.question);
            observation = `The user responded: "${answer}"`;
            break;

          case 'createPlan': { // Use a block scope for new variables
            if (typeof action.goal !== 'string') {
              throw new Error("Action 'createPlan' is missing a 'goal'.");
            }

            onUpdate({ type: 'thought', content: `Generating a plan for the goal: "${action.goal}"` });
            const planPrompt = constructPlanPrompt(action.goal, initialContext);
            const planResponse = await aiProvider.invoke(planPrompt, false);
            const rawPlan = planResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawPlan) throw new Error("Could not generate a plan.");

            const plan = JSON.parse(extractJson(rawPlan)) as PlanStep[];
            const planObservations: string[] = [];
            onUpdate({ type: 'thought', content: `Plan generated with ${plan.length} steps. Now executing...` });

            for (let i = 0; i < plan.length; i++) {
              const step = plan[i];
              onUpdate({ type: 'thought', content: `Step ${i + 1}/${plan.length}: ${step.reasoning}` });
              onUpdate({ type: 'action', content: `[${step.operation}] Executing...` });

              try {
                let stepResult = '';
                switch (step.operation) {
                  case 'writeFile':
                    if (!step.path || !step.content) throw new Error("Plan step 'writeFile' is missing 'path' or 'content'.");
                    await fs.writeFile(step.path, step.content, 'utf-8');
                    stepResult = `Successfully wrote to ${step.path}.`;
                    break;
                  case 'executeCommand':
                    if (!step.command) throw new Error("Plan step 'executeCommand' is missing 'command'.");
                    const { stdout } = await execAsync(step.command);
                    stepResult = `Command output:\n${stdout}`;
                    break;
                  case 'readFile':
                    if (!step.path) throw new Error("Plan step 'readFile' is missing 'path'.");
                    stepResult = await fs.readFile(step.path, 'utf-8');
                    break;
                  default:
                    stepResult = `Error: Unknown operation "${step.operation}" in plan.`;
                }
                planObservations.push(`Step ${i + 1} (${step.operation}) Result: ${stepResult}`);
              } catch (e) {
                const err = e as Error;
                const errorResult = `Step ${i + 1} (${step.operation}) Failed: ${err.message}`;
                planObservations.push(errorResult);
                observation = `Plan execution failed. ${errorResult}\n\nCompleted Observations:\n${planObservations.join('\n')}`;
                throw new Error(observation);
              }
            }
            
            observation = `Successfully executed all ${plan.length} steps of the plan.\n\nObservations:\n${planObservations.join('\n')}`;
            break;
          }
            
          default:
            observation = `Error: Unknown tool "${action.tool}"`;
        }
        onUpdate({ type: 'observation', content: observation });
        history += `\nObservation: ${observation}`;
      } catch (e) {
        const err = e as Error;
        const errorMessage = `Action [${action.tool}] Failed: ${err.message}`;
        onUpdate({ type: 'error', content: errorMessage });
        history += `\nError: ${errorMessage}`;
      }

    } catch (error) {
      const err = error as Error;
      onUpdate({ type: 'error', content: err.message });
      logger.error(err, 'A critical error occurred during the agent task.');
      return;
    }
  }
  onUpdate({ type: 'error', content: 'Task ended due to reaching the maximum number of turns.' });
}