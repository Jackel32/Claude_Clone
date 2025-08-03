/**
 * @file src/commands/handlers/task.ts
 * @description Handler for the agentic 'task' command using a ReAct loop.
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { constructReActPrompt } from '../../ai/index.js';
import { AppContext } from '../../types.js';
import { extractJson } from './utils.js';
import { scanProject } from '../../codebase/index.js';

const execAsync = promisify(exec);

export async function handleTaskCommand(context: AppContext): Promise<void> {
  const { logger, aiProvider } = context;
  const { default: inquirer } = await import('inquirer');
  const ora = (await import('ora')).default;

  const { userTask } = await inquirer.prompt([{
    type: 'input',
    name: 'userTask',
    message: 'What task would you like me to perform?',
  }]);

  if (!userTask) return;

  const files = await scanProject('.');
  const initialContext = files.join('\n');
  let history = '';
  const maxTurns = 10;

  for (let i = 0; i < maxTurns; i++) {
    const spinner = ora('🤔 AI is thinking...').start();
    try {
      const prompt = constructReActPrompt(userTask, history, initialContext);
      const response = await aiProvider.invoke(prompt, false);
      const rawResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawResponse) {
        spinner.fail("AI returned an empty response.");
        history += "\nObservation: Error - AI returned an empty response. Please try again.";
        continue;
      }

      const responseJson = JSON.parse(extractJson(rawResponse));

      // --- STRICT VALIDATION BLOCK ---
      if (
        !responseJson ||
        typeof responseJson.thought !== 'string' ||
        typeof responseJson.action !== 'object' ||
        responseJson.action === null ||
        typeof responseJson.action.tool !== 'string'
      ) {
        spinner.fail("AI returned a malformed action. Trying again...");
        history += `\nObservation: Error - Your last response was malformed. You must provide a JSON object with a 'thought' (string) and an 'action' (object with a 'tool' property).`;
        continue; // Go to the next turn and let the AI recover.
      }
      // --- END VALIDATION BLOCK ---

      const { thought, action } = responseJson;
      spinner.succeed(`Thought: ${thought}`);
      history += `\nThought: ${thought}\nAction: ${JSON.stringify(action)}`;

      if (action.tool === 'finish') {
        logger.info(`✅ Task Complete: ${action.summary}`);
        return;
      }

      const actionSpinner = ora(`[${action.tool}] Executing...`).start();
      let observation = '';
      try {
        switch (action.tool) {
          case 'writeFile':
            if (typeof action.path !== 'string' || typeof action.content !== 'string')
              throw new Error("Action 'writeFile' is missing 'path' or 'content'.");
            await fs.writeFile(action.path, action.content, 'utf-8');
            observation = `Successfully wrote to ${action.path}.`;
            break;
          case 'executeCommand':
            if (typeof action.command !== 'string')
              throw new Error("Action 'executeCommand' is missing 'command'.");
            const { stdout } = await execAsync(action.command);
            observation = `Command output:\n${stdout}`;
            break;
          case 'readFile':
            if (typeof action.path !== 'string')
              throw new Error("Action 'readFile' is missing 'path'.");
            observation = await fs.readFile(action.path, 'utf-8');
            break;
          default:
            observation = `Error: Unknown tool "${action.tool}"`;
        }
        actionSpinner.succeed(`[${action.tool}] Success.`);
        logger.info(`Observation:\n${observation}`);
        history += `\nObservation: ${observation}`;
      } catch (e) {
        const err = e as Error;
        actionSpinner.fail(`[${action.tool}] Failed.`);
        logger.error(err.message);
        history += `\nError: ${err.message}`;
      }
    } catch (error) {
      spinner.fail('An error occurred during the task.');
      logger.error(error);
      return;
    }
  }
  logger.warn('Task ended due to reaching the maximum number of turns.');
}