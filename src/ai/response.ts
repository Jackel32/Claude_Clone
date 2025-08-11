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

  // 1. Read the entire stream into a single string.
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    fullResponse += decoder.decode(value, { stream: true });
  }

  // 2. Attempt to parse the string as a JSON array.
  // The Gemini API returns a stream that, when concatenated, forms a JSON array.
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
    // Fallback for cases where the stream might not be perfect JSON
    // or for other providers that don't stream JSON.
    process.stdout.write(fullResponse);
    accumulatedText = fullResponse;
    // Log a warning that parsing failed, so we know there might be an issue.
    console.warn("\n[Warning: Could not parse AI response as JSON. Displaying raw stream.]");
  }

  process.stdout.write('\n'); // Ensure a final newline for clean terminal output
  return accumulatedText;
}