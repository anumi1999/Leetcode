interface LogEntry {
    timestamp: string;
    level: "INFO" | "WARN" | "ERROR";
    service: string;
}

function topErrorServices(logs: LogEntry[], k: number): string[] {
    const countMap = new Map<string, number>();

    for (const log of logs) {
        if (log.level !== "ERROR") continue;
        countMap.set(log.service, (countMap.get(log.service) || 0) + 1);
    }

    const buckets: string[][] = Array.from({ length: logs.length + 1 }, () => []);
    for (const [service, count] of countMap) {
        buckets[count].push(service);
    }

    const ans: string[] = [];
    for (let i = buckets.length - 1; i >= 0 && ans.length < k; i--) {
        for (const service of buckets[i]) {
            if (ans.length >= k) break;
            ans.push(service);
        }
    }

    return ans;
}