/**
 * @file Handles processing responses from the AI, especially streams.
 */

/**
 * Processes a streaming API response and prints the content to the console.
 * This function is a placeholder and needs to be adapted to the specific
 * streaming format of your AI backend (e.g., Server-Sent Events).
 *
 * @param response - The fetch `Response` object containing the stream.
 */
export async function processStream(response: Response): Promise<void> {
    if (!response.body) {
        console.error('Response body is null. Cannot process stream.');
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    console.log("\n--- AI Response ---");
    while (!done) {
        try {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                // This part is highly dependent on your API's streaming format.
                // For many APIs (like Anthropic's), data comes in chunks like "data: {...}\n\n".
                // We'll just print the raw chunk for this example.
                // A real implementation would parse the JSON from each `data:` line.
                process.stdout.write(chunk);
            }
        } catch (error) {
            console.error('\nError while reading stream:', error);
            done = true;
        }
    }
    console.log("\n--- End of Response ---\n");
}