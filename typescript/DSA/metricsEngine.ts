export class LogMetricsEngine{
    private errorTimestamps: number[] = [];
    private readonly WINDOW_MS = 300000;

    public onLogError(timestamp: number): void{
        this.errorTimestamps.push(timestamp);
        this.evictExpiredTimestamp(Date.now());
    }

    public getErrorCountInLast5Minutes(): number{
        const now = Date.now();
        this.evictExpiredTimestamp(now);
        return this.errorTimestamps.length;
    }

    private evictExpiredTimestamp(now: number): void{
        const expirationBoundary: number = now - this.WINDOW_MS;
        while( this.errorTimestamps.length > 0 && this.errorTimestamps[0] < expirationBoundary ){
            this.errorTimestamps.shift();
        }
    }
}