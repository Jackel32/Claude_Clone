import { AIProvider } from './interface.js';

export class AnthropicProvider implements AIProvider {
  constructor(apiKey: string, model: string, temperature: number = 0.7) {
    // Constructor logic for Anthropic
  }
  async invoke(prompt: string, stream: boolean): Promise<any> {
    throw new Error('Anthropic provider not yet implemented.');
  }
  async embed(text: string): Promise<number[]> {
    throw new Error('Anthropic provider not yet implemented.');
  }
}