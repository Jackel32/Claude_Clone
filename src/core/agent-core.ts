/**
 * @file src/core/agent-core.ts
 * @description Core ReAct agent logic, decoupled from any UI.
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { constructReActPrompt } from '../ai/index.js';
import { AppContext } from '../types.js';
import { extractJson } from '../commands/handlers/utils.js';
import { scanProject } from '../codebase/index.js';

const execAsync = promisify(exec);

export type AgentUpdate = {
    type: 'thought' | 'action' | 'observation' | 'finish' | 'error' | 'stream-start' | 'stream-chunk' | 'stream-end';
    content: any;
    taskId?: string;
};
export type AgentCallback = (update: AgentUpdate) => void;

export async function runAgent(userTask: string, context: AppContext, onUpdate: AgentCallback) {
  const { logger, aiProvider } = context;

  const files = await scanProject(context.args.path);
  const initialContext = files.join('\n');
  let history = '';
  const maxTurns = 10;

  for (let i = 0; i < maxTurns; i++) {
    let responseJson;
    try {
      const prompt = constructReActPrompt(userTask, history, initialContext);
      const response = await aiProvider.invoke(prompt, false);
      const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawResponse) throw new Error("AI returned an empty response.");

      try {
        responseJson = JSON.parse(extractJson(rawResponse));
      } catch (parseError) {
        const errorMessage = `Error: Your last response was not valid JSON. Please correct the syntax and provide a single, valid JSON object with 'thought' and 'action'. Error details: ${(parseError as Error).message}`;
        onUpdate({ type: 'thought', content: 'Received malformed JSON, attempting to self-correct...' });
        history += `\nObservation: ${errorMessage}`;
        continue; // Skip the rest of this turn and let the AI try again
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
            // Validate that the required arguments exist
            if (typeof action.path !== 'string' || typeof action.content !== 'string') {
              throw new Error("Action 'writeFile' is missing 'path' or 'content'.");
            }
            await fs.writeFile(action.path, action.content, 'utf-8');
            observation = `Successfully wrote to ${action.path}.`;
            break;

          case 'executeCommand':
            // Validate the required argument
            if (typeof action.command !== 'string') {
                throw new Error("Action 'executeCommand' is missing 'command'.");
            }
            const { stdout } = await execAsync(action.command);
            observation = `Command output:\n${stdout}`;
            break;

          case 'readFile':
            // Validate the required argument
            if (typeof action.path !== 'string') {
                throw new Error("Action 'readFile' is missing 'path'.");
            }
            observation = await fs.readFile(action.path, 'utf-8');
            break;
            
          default:
            observation = `Error: Unknown tool "${action.tool}"`;
        }
      } catch (e) {
        const err = e as Error;
        onUpdate({ type: 'error', content: `Action [${action.tool}] Failed: ${err.message}` });
        history += `\nError: ${err.message}`;
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