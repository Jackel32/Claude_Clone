/**
 * @file src/ai/response.ts
 * @description Handles processing responses from the AI, especially streams.
 */

/**
 * Processes a streaming response from the AI API, prints it to the console,
 * and returns the full concatenated response.
 * @param {ReadableStream<Uint8Array>} stream - The response body stream.
 * @returns {Promise<string>} The full response text.
 */
export async function processStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let accumulatedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    fullResponse += decoder.decode(value, { stream: true });
  }

  try {
    const responseArray = JSON.parse(fullResponse);
    for (const chunk of responseArray) {
      const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        process.stdout.write(text);
        accumulatedText += text;
      }
    }
  } catch (error) {
    console.error('\n\n❌ Failed to parse the complete AI response stream.');
    console.error('Raw Response:', fullResponse);
    throw error;
  }

  process.stdout.write('\n');
  return accumulatedText;
}