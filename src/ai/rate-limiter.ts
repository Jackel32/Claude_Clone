/**
 * @file src/ai/rate-limiter.ts
 * @description A sophisticated rate limiter that handles RPM and TPM with intelligent waiting.
 */

// A simple approximation: 1 token ~ 4 characters
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export class RateLimiter {
    private rpm: number;
    private tpm: number;
    private requestTimestamps: number[] = [];
    private tokenTimestamps: { timestamp: number, count: number }[] = [];

    constructor(requestsPerMinute: number, tokensPerMinute: number) {
        this.rpm = requestsPerMinute;
        this.tpm = tokensPerMinute;
    }

    async acquire(prompt: string): Promise<void> {
        const requiredTokens = estimateTokens(prompt);

        while (true) {
            const now = Date.now();
            const oneMinuteAgo = now - 60000;

            // Prune old timestamps
            this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
            this.tokenTimestamps = this.tokenTimestamps.filter(entry => entry.timestamp > oneMinuteAgo);

            const currentRpm = this.requestTimestamps.length;
            const currentTpm = this.tokenTimestamps.reduce((sum, entry) => sum + entry.count, 0);

            const rpmOk = currentRpm < this.rpm;
            const tpmOk = (currentTpm + requiredTokens) <= this.tpm;

            if (rpmOk && tpmOk) {
                this.requestTimestamps.push(now);
                this.tokenTimestamps.push({ timestamp: now, count: requiredTokens });
                return; // Permission granted
            }

            // Calculate how long to wait
            let rpmWait = 0;
            if (!rpmOk) {
                rpmWait = this.requestTimestamps[0] - oneMinuteAgo;
            }
            
            let tpmWait = 0;
            if (!tpmOk) {
                // Find how far back we need to go to free up enough tokens
                let tokensToFree = (currentTpm + requiredTokens) - this.tpm;
                let freedTokens = 0;
                for (const entry of this.tokenTimestamps) {
                    freedTokens += entry.count;
                    if (freedTokens >= tokensToFree) {
                        tpmWait = entry.timestamp - oneMinuteAgo;
                        break;
                    }
                }
            }

            const waitTime = Math.max(rpmWait, tpmWait);
            await new Promise(resolve => setTimeout(resolve, waitTime + 100)); // +100ms buffer
        }
    }
}