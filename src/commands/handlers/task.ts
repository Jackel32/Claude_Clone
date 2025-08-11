/**
 * @file src/commands/handlers/task.ts
 * @description Handler for the agentic 'task' command using a ReAct loop.
 */

import { AppContext } from '../../types.js';
import { runAgent, AgentUpdate } from '../../core/agent-core.js';
import inquirer from 'inquirer';

export async function handleTaskCommand(context: AppContext): Promise<void> {
  const { logger } = context;
  const ora = (await import('ora')).default;
  
  const { userTask } = await inquirer.prompt([{
    type: 'input',
    name: 'userTask',
    message: 'What task would you like me to perform?',
  }]);

  if (!userTask) return;

  const spinner = ora('Initializing agent...').start();

  const onUpdate = (update: AgentUpdate) => {
    spinner.stop(); // Stop the spinner to print the update
    switch (update.type) {
      case 'thought':
        logger.info(`[THOUGHT] ${update.content}`);
        spinner.start('🤔 AI is thinking...');
        break;
      case 'action':
        logger.info(`[ACTION] ${update.content}`);
        spinner.start(`[${update.content}] Executing...`);
        break;
      case 'observation':
        logger.info(`[OBSERVATION]\n${update.content}`);
        break;
      case 'finish':
        logger.info(`✅ [FINISH] ${update.content}`);
        break;
      case 'error':
        logger.error(`❌ [ERROR] ${update.content}`);
        break;
    }
  };

  const onPrompt = async (question: string): Promise<string> => {
      spinner.stop(); // Pause spinner for user input
      const { answer } = await inquirer.prompt([{
          type: 'input',
          name: 'answer',
          message: question,
      }]);
      spinner.start('🤔 AI is thinking...'); // Resume spinner
      return answer;
  };

  try {
    await runAgent(userTask, context, onUpdate, onPrompt);
  } catch (error) {
    spinner.fail('An unexpected error occurred in the agent.');
    logger.error(error);
  }
}