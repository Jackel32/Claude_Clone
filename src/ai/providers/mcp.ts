/**
 * @file src/ai/providers/mcp.ts
 * @description MCP (Model Context Protocol) provider.
 */

import { AIProvider } from './interface.js';
import { Logger } from '../../types.js';
import { Client, StdioClientTransport } from '@modelcontextprotocol/sdk';
import { McpConfig } from '../../config/schema.js';

export class McpProvider implements AIProvider {
  private logger: Logger;
  private client: Client;
  private generationModel: string;
  private embeddingModel: string;

  constructor(
    private apiKey: string,
    private mcpConfig: McpConfig,
    logger: Logger,
  ) {
    this.logger = logger;

    if (!mcpConfig.server) {
      throw new Error('MCP server configuration is missing.');
    }

    const transport = new StdioClientTransport({
      command: mcpConfig.server.command,
      args: mcpConfig.server.args,
    });

    this.client = new Client({
      name: 'kinch-code-client',
      version: '1.0.0',
    });

    this.client.connect(transport).catch((err: any) => {
      this.logger.error(`Failed to connect to MCP server: ${err.message}`);
    });

    this.generationModel = mcpConfig.generation || 'default-generation';
    this.embeddingModel = mcpConfig.embedding || 'default-embedding';
  }

  async invoke(prompt: string, stream: boolean): Promise<any> {
    this.logger.info('MCP provider invoke method called');

    try {
      const { name, args } = JSON.parse(prompt);
      const result = await this.client.callTool({
        name: name,
        arguments: args,
      });
      return { content: result.content };
    } catch (err: any) {
      this.logger.error(`MCP invoke error: ${err.message}`);
      throw err;
    }
  }

  async embed(text: string, projectRoot: string): Promise<number[]> {
    this.logger.info('MCP provider embed method called');
    try {
      const resource = await this.client.readResource({
        uri: text, // Assuming `text` is the URI of the resource
      });

      // The resource content is expected to be a stringified JSON array of numbers.
      if (resource.contents.length > 0 && resource.contents[0].text) {
        return JSON.parse(resource.contents[0].text);
      }
      return [];
    } catch (err: any) {
      this.logger.error(`MCP embed error: ${err.message}`);
      throw err;
    }
  }
}
