async function retry<T>(fn: () => Promise<T>, attempts: number, baseDelayMs: number): Promise<T> {
    let lastError: unknown;
    let wait = baseDelayMs;

    for (let i = 0; i < attempts; i++) {
        try {
            const ans = await fn();
            return ans;
        } catch (err) {
            lastError = err;
            if (i < attempts - 1) {
                await delay(wait, "");
                wait = wait * 2;
            }
        }
    }
    throw lastError;  
}