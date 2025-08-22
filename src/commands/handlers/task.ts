import { AppContext } from '../../types.js';
import { runAgent, AgentUpdate } from '../../core/agent-core.js';
import { ALL_TOOLS, TASK_LIBRARY, TaskTemplate } from '../../ai/index.js';
import { logger } from '../../logger/index.js';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';

export async function handleTaskCommand(context: AppContext): Promise<void> {
    let userTask: string | null = null;
    let requiredTools: string[] = Object.keys(ALL_TOOLS);
    let taskTemplate: TaskTemplate | undefined;

    // Loop to allow the user to go "back" to the role selection
    while (userTask === null) {
        // Get unique group names from the library
        const taskGroups = [...new Set(TASK_LIBRARY.map(task => task.group))];
        
        // Create the first level of choices: The Roles/Groups
        const roleChoices = [
            ...taskGroups.map(group => ({ name: chalk.bold.yellow(group), value: group })),
            new inquirer.Separator(),
            { name: chalk.bold.cyan('Custom Task (Free Type)'), value: 'custom' },
        ];

        const { selected_role } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selected_role',
                message: 'Which role would you like to assume?',
                choices: roleChoices,
            },
        ]);

        if (selected_role === 'custom') {
            const { customTask } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'customTask',
                    message: 'Please describe the task you want me to perform:',
                },
            ]);
            if (!customTask) return; // Exit if the user enters nothing
            userTask = customTask;
            break; // Exit the loop
        }

        // Filter tasks based on the selected role
        const tasksForRole = TASK_LIBRARY.filter(task => task.group === selected_role);
        
        const taskChoices = [
            ...tasksForRole.map(task => ({
                name: `${chalk.bold(task.title)}: ${chalk.dim(task.description)}`,
                value: task.id,
                short: task.title,
            })),
            new inquirer.Separator(),
            { name: chalk.gray('.. Back'), value: 'back' } // The new "Back" option
        ];

        const { selected_task_id } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selected_task_id',
                message: `What task for ${chalk.bold.yellow(selected_role)} would you like to perform?`,
                choices: taskChoices,
                pageSize: 15,
            }
        ]);

        if (selected_task_id === 'back') {
            continue; // Go back to the start of the while loop
        }
        
        taskTemplate = TASK_LIBRARY.find((t) => t.id === selected_task_id);
        if (!taskTemplate) {
            logger.error('Selected task not found in the library.');
            return;
        }

        const inputs: Record<string, string> = {};
        if (taskTemplate.inputs.length > 0) {
            logger.info(`Please provide the following inputs for the "${taskTemplate.title}" task:`);
            for (const input of taskTemplate.inputs) {
                const { value } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'value',
                        message: `${input.message}:`,
                    },
                ]);
                inputs[input.name] = value;
            }
        }
        userTask = taskTemplate.prompt(inputs);
        requiredTools = taskTemplate.requiredTools;
    }

    if (userTask === null) {
        // This should not happen, but it's a good safeguard
        logger.info('No task selected. Exiting.');
        return;
    }

    const spinner = ora('Initializing agent...').start();

    const onUpdate = (update: AgentUpdate) => {
        spinner.stop();
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
        spinner.stop();
        const { answer } = await inquirer.prompt([{ type: 'input', name: 'answer', message: question }]);
        spinner.start('🤔 AI is thinking...');
        return answer;
    };

    try {
        await runAgent(userTask, context, onUpdate, onPrompt, requiredTools, taskTemplate?.id);
    } catch (error) {
        spinner.fail('An unexpected error occurred in the agent.');
        logger.error(error);
    }
}