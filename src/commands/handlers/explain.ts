/**
 * @file Handler for the `explain` command.
 */
import { AIClient, constructPrompt, gatherFileContext, processStream } from '../../ai';

interface ExplainCommandOptions {
  files: string[];
  profile?: string;
}

/**
 * Handles the logic for the 'explain' command.
 * It reads specified files, constructs a prompt, sends it to the AI,
 * and streams the response.
 * @param options - The command options, including file paths and profile name.
 */
export async function handleExplainCommand(options: ExplainCommandOptions): Promise<void> {
  if (!options.files || options.files.length === 0) {
    console.error('Error: You must specify at least one file to explain.');
    process.exit(1);
  }

  console.log(`Gathering context from ${options.files.length} file(s)...`);
  const fileContext = await gatherFileContext(options.files);

  const userQuery = `Please explain the following code. Focus on the overall architecture, the purpose of each file, and how they interact.`;
  const prompt = constructPrompt(userQuery, fileContext);

  console.log('Connecting to AI backend...');
  const client = new AIClient(options.profile);
  
  try {
    await client.initialize();
    const response = await client.getCompletion(prompt, true);
    await processStream(response);
  } catch (error: any) {
    console.error(`\nError during AI interaction: ${error.message}`);
    process.exit(1);
  }
}