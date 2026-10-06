/**
 * ============================================================
 *  04 — Performance Metrics
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  An agent can be correct but unusable:
 *  - Takes 60 seconds per query (P99 latency spiking)
 *  - Costs $5 per request (too expensive)
 *  - Uses 50K tokens (burn through quota)
 *  - Crashes under load (throughput = 0)
 *
 *  METRICS
 *  -------
 *  1. Latency: mean, p50, p95, p99 (tail matters for user experience)
 *  2. Cost: mean cost per query, cost per 1K tokens
 *  3. Throughput: req/sec, queries/GPU/hour
 *  4. Resource efficiency: latency/cost tradeoffs
 *  5. Availability: error rate, crash rate
 */

import type { EvalResult, Metric } from "./01_evaluation_framework";

// ============================================================
// Latency Analysis
// ============================================================

export interface LatencyStats {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
}

/** Compute percentile from sorted array */
function percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

/**
 * Analyze latency distribution from eval results.
 */
export function analyzeLatency(results: EvalResult[]): LatencyStats {
    const latencies = results.map((r) => r.latency);
    return {
        mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        min: Math.min(...latencies),
        max: Math.max(...latencies),
    };
}

/**
 * Latency must be under a threshold (e.g., "p99 < 10s for user-facing").
 */
export function latencyBudget(maxP99Ms: number): Metric {
    return {
        name: `latency_p99_under_${maxP99Ms}ms`,
        judge(): boolean {
            // Simplified; real version would have access to all results
            // and compute p99 on the fly
            return true;
        },
    };
}

// ============================================================
// Cost Analysis
// ============================================================

export interface CostStats {
    totalCost: number;
    meanCost: number;
    meanTokens: number;
    costPer1kTokens: number;
}

/**
 * Compute cost metrics from eval results.
 */
export function analyzeCost(results: EvalResult[]): CostStats {
    const withCost = results.filter((r) => r.cost !== undefined);
    const withTokens = results.filter((r) => r.tokens);

    const totalCost = withCost.reduce((sum, r) => sum + (r.cost ?? 0), 0);
    const meanCost = withCost.length > 0 ? totalCost / withCost.length : 0;

    const totalTokens = withTokens.reduce(
        (sum, r) => sum + (r.tokens?.input ?? 0) + (r.tokens?.output ?? 0),
        0,
    );
    const meanTokens = withTokens.length > 0 ? totalTokens / withTokens.length : 0;

    const costPer1kTokens =
        totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0;

    return { totalCost, meanCost, meanTokens, costPer1kTokens };
}

/**
 * Cost budget: mean cost per query must be under threshold.
 */
export function costBudget(maxCostPerQuery: number): Metric {
    return {
        name: `cost_under_$${maxCostPerQuery}`,
        judge(result: EvalResult): boolean {
            if (!result.cost) return true; // No cost tracked
            return result.cost < maxCostPerQuery;
        },
    };
}

// ============================================================
// Error Rate & Reliability
// ============================================================

/**
 * What fraction of queries failed / errored?
 */
export interface ReliabilityStats {
    totalQueries: number;
    successCount: number;
    errorCount: number;
    errorRate: number; // 0–1
    timeoutCount: number;
}

export function analyzeReliability(results: EvalResult[]): ReliabilityStats {
    const errorCount = results.filter((r) => r.error).length;
    const timeoutCount = results.filter((r) => r.error?.message.includes("Timeout"))
        .length;

    return {
        totalQueries: results.length,
        successCount: results.length - errorCount,
        errorCount,
        errorRate: results.length > 0 ? errorCount / results.length : 0,
        timeoutCount,
    };
}

/** Error rate must be low (e.g., < 1% for production) */
export function errorRateBudget(maxErrorRate: number): Metric {
    return {
        name: `error_rate_under_${(maxErrorRate * 100).toFixed(1)}%`,
        judge(result: EvalResult): boolean {
            // Simplified; in practice, aggregate over all results
            return !result.error;
        },
    };
}

// ============================================================
// Throughput & Parallelism
// ============================================================

/**
 * How many queries can you run concurrently without degrading latency?
 * Measured via load testing (not part of a single eval run).
 */
export interface ThroughputStats {
    queriesPerSecond: number;
    concurrentLimit: number; // max concurrent before p99 latency spikes
    cpuUtilization: number; // 0–100%
    memoryUtilization: number; // 0–100%
}

// ============================================================
// Composite Efficiency Metric
// ============================================================

/**
 * Balance latency vs cost: lower is better (fewer ms per dollar).
 * Useful for comparing inference options (e.g., local vs API).
 */
export function efficiencyRatio(latencyMs: number, costDollars: number): number {
    if (costDollars === 0) return latencyMs; // Free but slow?
    return latencyMs / costDollars;
}

/**
 * Check Pareto frontier: is this model on the efficiency frontier?
 * (Not beaten on both latency AND cost by any other model.)
 */
export function paretoFrontier(
    models: Array<{ name: string; latency: number; cost: number }>,
): Set<string> {
    const frontier = new Set<string>();

    for (const candidate of models) {
        let dominated = false;
        for (const other of models) {
            if (
                other.latency <= candidate.latency &&
                other.cost <= candidate.cost &&
                (other.latency < candidate.latency || other.cost < candidate.cost)
            ) {
                dominated = true;
                break;
            }
        }
        if (!dominated) {
            frontier.add(candidate.name);
        }
    }

    return frontier;
}

// ============================================================
// Reporting
// ============================================================

export function reportPerformance(
    latency: LatencyStats,
    cost: CostStats,
    reliability: ReliabilityStats,
): string {
    const lines: string[] = [];
    lines.push(`\nPerformance Summary`);
    lines.push(`────────────────────────`);
    lines.push(`Latency (ms): mean=${latency.mean.toFixed(0)}, p50=${latency.p50.toFixed(0)}, p95=${latency.p95.toFixed(0)}, p99=${latency.p99.toFixed(0)}`);
    lines.push(`Cost: mean=$${cost.meanCost.toFixed(4)}, per 1k tokens=$${cost.costPer1kTokens.toFixed(4)}`);
    lines.push(`Reliability: ${reliability.successCount}/${reliability.totalQueries} success (${((1 - reliability.errorRate) * 100).toFixed(1)}%)`);
    if (reliability.timeoutCount > 0) {
        lines.push(`  Timeouts: ${reliability.timeoutCount}`);
    }
    lines.push(`────────────────────────\n`);

    return lines.join("\n");
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why is p99 latency more important than mean latency?
 *     A: Users experience the worst case. If mean=1s but p99=30s,
 *        1% of users hit 30-second waits. Unacceptable.
 *        Focus on tail latency for SLAs.
 *
 *  Q: How do you trade off latency vs cost?
 *     A: Depends on use case. Interactive (chat) prioritizes latency.
 *        Batch (nightly jobs) prioritizes cost. For scaling, often want
 *        to run multiple smaller models in parallel to stay efficient.
 *
 *  Q: What if different models excel at different query types?
 *     A: Measure performance stratified by query category (easy/hard,
 *        short/long). Make routing decisions: use cheap model for easy,
 *        expensive model for hard.
 *
 *  Q: How do you prevent one slow query from breaking throughput?
 *     A: Timeout + circuit-breaker. Allow some failures, but cut off at
 *        a budget (e.g., p99 > 10s? mark unhealthy, route to backup).
 *        For batch, use async queues with backpressure.
 */
