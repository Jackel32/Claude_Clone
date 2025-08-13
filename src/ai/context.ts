import { promises as fs } from 'fs';
import { AgentCallback } from '../core/agent-core.js';

export async function gatherFileContext(filePaths: string[], onUpdate: AgentCallback, totalFiles: number): Promise<string> {
  let contextString = '';

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    onUpdate({ type: 'action', content: `Reading ${i + 1}/${totalFiles}: ${filePath}` });
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      contextString += `<file path="${filePath}">\n${content}\n</file>\n\n`;
    } catch (error) {
      contextString += `<file path="${filePath}">\n--- Error reading file ---\n</file>\n\n`;
    }
  }

  return contextString.trim();
}