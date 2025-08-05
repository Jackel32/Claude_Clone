/**
 * @file src/ai/providers/interface.ts
 * @description Defines the common interface for all AI providers.
 */

export interface AIProvider {
  /**
   * Generates a text response from a prompt.
   * @param prompt The prompt to send to the LLM.
   * @param stream Whether to stream the response.
   * @returns A promise that resolves to the response (stream or JSON).
   */
  invoke(prompt: string, stream: boolean): Promise<any>;

  /**
   * Generates a vector embedding for a given text.
   * @param text The text to embed.
   * @returns A promise that resolves to the vector embedding array.
   */
  embed(text: string, projectRoot: string): Promise<number[]>;
}