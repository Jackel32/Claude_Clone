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
    type: 'thought' | 'action' | 'observation' | 'finish' | 'error';
    content: any;
};
export type AgentCallback = (update: AgentUpdate) => void;

export async function runAgent(userTask: string, context: AppContext, onUpdate: AgentCallback) {
  const { logger, aiProvider } = context;

  const files = await scanProject('.');
  const initialContext = files.join('\n');
  let history = '';
  const maxTurns = 10;

  for (let i = 0; i < maxTurns; i++) {
    try {
      const prompt = constructReActPrompt(userTask, history, initialContext);
      const response = await aiProvider.invoke(prompt, false);
      const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawResponse) throw new Error("AI returned an empty response.");

      const responseJson = JSON.parse(extractJson(rawResponse));
      const { thought, action } = responseJson;
      onUpdate({ type: 'thought', content: thought });
      history += `\nThought: ${thought}\nAction: ${JSON.stringify(action)}`;

      if (action.tool === 'finish') {
        onUpdate({ type: 'finish', content: action.summary });
        return;
      }
      
      onUpdate({ type: 'action', content: `[${action.tool}] Executing...` });
      let observation = '';

      // ... (Validation logic and switch statement for actions remain the same)
      switch (action.tool) {
        // ...
      }
      onUpdate({ type: 'observation', content: observation });
      history += `\nObservation: ${observation}`;

    } catch (error) {
      const err = error as Error;
      onUpdate({ type: 'error', content: err.message });
      logger.error(err, 'An error occurred during the agent task.');
      return;
    }
  }
  onUpdate({ type: 'error', content: 'Task ended due to reaching the maximum number of turns.' });
}