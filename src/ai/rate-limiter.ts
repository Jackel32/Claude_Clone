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
    // We will now have three separate, independent limiters.
    private rpmLimiter: Bottleneck;
    private tpmLimiter: Bottleneck;
    private rpdLimiter: Bottleneck;

    constructor(requestsPerMinute: number, tokensPerMinute: number, requestsPerDay: number, logger: Logger) {
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

        // This new limiter handles the daily request quota.
        this.rpdLimiter = new Bottleneck({
            reservoir: requestsPerDay,
            reservoirRefreshAmount: requestsPerDay,
            reservoirRefreshInterval: 24 * 60 * 60 * 1000, // 24 hours
        });

        // Attach debug event listeners
        this.rpdLimiter.on('debug', (msg, data) => logger.debug(`RPD Limiter: ${msg}`));
        this.rpmLimiter.on('debug', (msg, data) => logger.debug(`RPM Limiter: ${msg}`));
        this.tpmLimiter.on('debug', (msg, data) => logger.debug(`TPM Limiter: ${msg}`));
    }

    /**
     * Schedules a function to be executed when all rate limits (RPD, RPM, TPM) allow.
     * @param func The async function to execute (e.g., an API call).
     * @param prompt The prompt string to estimate token weight.
     * @returns The result of the executed function.
     */
    schedule<T>(func: () => Promise<T>, prompt: string): Promise<T> {
        const tokens = estimateTokens(prompt);
        
        // This is the new, correct nested scheduling pattern for all three limits.
        return this.rpdLimiter.schedule({ weight: 1 }, () => {
            return this.tpmLimiter.schedule({ weight: tokens }, () => {
                return this.rpmLimiter.schedule({ weight: 1 }, func);
            });
        });
    }
}
