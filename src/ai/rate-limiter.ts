/**
 * @file src/ai/rate-limiter.ts
 * @description A robust, professional-grade rate limiter using the 'bottleneck' library.
 */
import Bottleneck from 'bottleneck';
import { Logger } from '../types.js';

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
    if (!text) return 1;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export class RateLimiter {
    // We will now have two separate, independent limiters.
    private rpmLimiter: Bottleneck;
    private tpmLimiter: Bottleneck;

    constructor(requestsPerMinute: number, tokensPerMinute: number, logger: Logger) {
        // This limiter only cares about the number of requests per minute.
        this.rpmLimiter = new Bottleneck({
            reservoir: requestsPerMinute,
            reservoirRefreshAmount: requestsPerMinute,
            reservoirRefreshInterval: 60 * 1000,
            maxConcurrent: 5,
        });

        // This limiter only cares about the number of tokens per minute.
        this.tpmLimiter = new Bottleneck({
            reservoir: tokensPerMinute,
            reservoirRefreshAmount: tokensPerMinute,
            reservoirRefreshInterval: 60 * 1000,
        });

        // Attach debug event listeners
        this.rpmLimiter.on('debug', (msg, data) => logger.debug(`RPM Limiter: ${msg}`));
        this.tpmLimiter.on('debug', (msg, data) => logger.debug(`TPM Limiter: ${msg}`));
    }

    /**
     * Schedules a function to be executed when both RPM and TPM rate limits allow.
     * @param func The async function to execute (e.g., an API call).
     * @param prompt The prompt string to estimate token weight.
     * @returns The result of the executed function.
     */
    schedule<T>(func: () => Promise<T>, prompt: string): Promise<T> {
        const tokens = estimateTokens(prompt);
        
        // This is the new, correct nested scheduling pattern.
        return this.tpmLimiter.schedule({ weight: tokens }, () => {
            // Once the token limit has a slot, we then schedule based on the request limit.
            // The request limit always has a weight of 1.
            return this.rpmLimiter.schedule({ weight: 1 }, func);
        });
    }
}