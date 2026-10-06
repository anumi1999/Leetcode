/**
 * ============================================================
 *  01 — Evaluation Framework
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  You've built an agent. How do you know it's working?
 *  - Did it answer correctly?
 *  - Was it safe (no hallucinations)?
 *  - Did it run fast enough?
 *  - Is it better than the previous version?
 *
 *  An eval framework orchestrates:
 *  1. Running agent on a test set
 *  2. Comparing output to ground truth (via metrics)
 *  3. Aggregating results
 *  4. Regression detection (old vs new version)
 *  5. Reporting (pass/fail, dashboards)
 *
 *  WHY NOT UNIT TESTS?
 *  -------------------
 *  LLM agents are non-deterministic. A unit test that checks
 *  for one exact output fails 40% of the time. Instead:
 *  - Run 10+ examples per behavior
 *  - Measure pass rate (% correct)
 *  - Watch for degradation vs baseline
 *  - CI runs evals nightly (not per commit)
 */

// ============================================================
// Core Types
// ============================================================

/** A single test case */
export interface EvalCase {
    id: string;
    input: string;
    /** Ground truth output or expected behavior */
    expected: string | string[];
    /** Metadata for filtering (e.g., difficulty, category) */
    metadata?: Record<string, string | number | boolean>;
}

/** The agent ran and produced output */
export interface EvalResult {
    caseId: string;
    output: string;
    /** Time to run in ms */
    latency: number;
    /** Cost in dollars (if metered) */
    cost?: number;
    /** Any error or exception */
    error?: Error;
    tokens?: {
        input: number;
        output: number;
    };
}

/** A metric judges correctness (and may give a score) */
export interface Metric {
    name: string;
    /**
     * judge(result, testCase) returns:
     *   - true/false (pass/fail)
     *   OR
     *   - 0.0–1.0 (confidence or partial credit)
     */
    judge(result: EvalResult, testCase: EvalCase): boolean | number;
}

/** Aggregated stats for one metric across all test cases */
export interface MetricStats {
    name: string;
    passRate: number; // 0–1
    passCount: number;
    failCount: number;
    avgScore?: number; // if metric returns numbers
    cases: Array<{
        caseId: string;
        passed: boolean;
        score?: number;
        error?: string;
    }>;
}

/** Summary of an eval run */
export interface EvalReport {
    runId: string;
    timestamp: Date;
    testCases: number;
    metrics: MetricStats[];
    avgLatency: number; // ms
    avgCost?: number; // $
    totalTokens?: { input: number; output: number };
    passed: boolean; // passRate > threshold
}

// ============================================================
// Eval Runner
// ============================================================

export interface EvalRunnerOpts {
    testCases: EvalCase[];
    agent: (input: string) => Promise<{ output: string; latency: number; cost?: number; tokens?: { input: number; output: number } }>;
    metrics: Metric[];
    passThreshold?: number; // default 0.8
    timeout?: number; // ms per case, default 30000
}

export class EvalRunner {
    private opts: EvalRunnerOpts;

    constructor(opts: EvalRunnerOpts) {
        this.opts = opts;
    }

    /**
     * Run agent on all test cases, compute metrics, return report.
     */
    async run(): Promise<EvalReport> {
        const runId = `eval-${Date.now()}`;
        const results: EvalResult[] = [];

        // Run agent on each test case
        for (const testCase of this.opts.testCases) {
            let result: EvalResult;
            try {
                const start = Date.now();
                const agentRun = await Promise.race([
                    this.opts.agent(testCase.input),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Timeout")),
                            this.opts.timeout ?? 30000,
                        ),
                    ),
                ]);
                const latency = Date.now() - start;

                result = {
                    caseId: testCase.id,
                    output: (agentRun as any).output,
                    latency,
                    cost: (agentRun as any).cost,
                    tokens: (agentRun as any).tokens,
                };
            } catch (e) {
                result = {
                    caseId: testCase.id,
                    output: "",
                    latency: this.opts.timeout ?? 30000,
                    error: e as Error,
                };
            }
            results.push(result);
        }

        // Compute metrics
        const metricStats: MetricStats[] = [];
        for (const metric of this.opts.metrics) {
            const cases: MetricStats["cases"] = [];
            let passCount = 0;
            let scoreSum = 0;

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const testCase = this.opts.testCases[i];

                let passed = false;
                let score: number | undefined;
                let error: string | undefined;

                try {
                    const judgment = metric.judge(result, testCase);
                    if (typeof judgment === "boolean") {
                        passed = judgment;
                        score = passed ? 1 : 0;
                    } else {
                        score = judgment;
                        passed = score > 0.5;
                    }
                } catch (e) {
                    error = (e as Error).message;
                    passed = false;
                    score = 0;
                }

                if (passed) passCount++;
                if (score !== undefined) scoreSum += score;
                cases.push({ caseId: result.caseId, passed, score, error });
            }

            metricStats.push({
                name: metric.name,
                passRate: passCount / results.length,
                passCount,
                failCount: results.length - passCount,
                avgScore: results.length > 0 ? scoreSum / results.length : undefined,
                cases,
            });
        }

        // Aggregate latency/cost
        const nonErrorResults = results.filter((r) => !r.error);
        const avgLatency =
            nonErrorResults.length > 0
                ? nonErrorResults.reduce((sum, r) => sum + r.latency, 0) / nonErrorResults.length
                : 0;
        const avgCost =
            nonErrorResults.length > 0 && nonErrorResults.every((r) => r.cost !== undefined)
                ? nonErrorResults.reduce((sum, r) => sum + (r.cost ?? 0), 0) / nonErrorResults.length
                : undefined;

        const totalTokens =
            nonErrorResults.length > 0 && nonErrorResults.every((r) => r.tokens)
                ? nonErrorResults.reduce(
                      (sum, r) => ({
                          input: sum.input + (r.tokens?.input ?? 0),
                          output: sum.output + (r.tokens?.output ?? 0),
                      }),
                      { input: 0, output: 0 },
                  )
                : undefined;

        // Determine pass/fail
        const threshold = this.opts.passThreshold ?? 0.8;
        const passed =
            metricStats.length > 0 && metricStats.every((m) => m.passRate >= threshold);

        return {
            runId,
            timestamp: new Date(),
            testCases: this.opts.testCases.length,
            metrics: metricStats,
            avgLatency,
            avgCost,
            totalTokens,
            passed,
        };
    }
}

// ============================================================
// Reporting
// ============================================================

export function reportEval(report: EvalReport): string {
    const lines: string[] = [];
    lines.push(`\n════════════════════════════════════════`);
    lines.push(`EvalReport: ${report.runId}`);
    lines.push(`Time: ${report.timestamp.toISOString()}`);
    lines.push(`Tests: ${report.testCases}`);
    lines.push(`Status: ${report.passed ? "✅ PASS" : "❌ FAIL"}`);
    lines.push(`────────────────────────────────────────`);

    for (const metric of report.metrics) {
        const pct = (metric.passRate * 100).toFixed(1);
        const statusIcon = metric.passRate >= 0.8 ? "✅" : "⚠️";
        lines.push(`${statusIcon} ${metric.name}: ${pct}% (${metric.passCount}/${metric.passCount + metric.failCount})`);
        if (metric.avgScore !== undefined) {
            lines.push(`   Avg Score: ${metric.avgScore.toFixed(3)}`);
        }
    }

    lines.push(`────────────────────────────────────────`);
    lines.push(`Latency: ${report.avgLatency.toFixed(0)}ms`);
    if (report.avgCost) lines.push(`Cost: $${report.avgCost.toFixed(4)}`);
    if (report.totalTokens) {
        lines.push(
            `Tokens: ${report.totalTokens.input} input + ${report.totalTokens.output} output`,
        );
    }
    lines.push(`════════════════════════════════════════\n`);

    return lines.join("\n");
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: How do you prevent flaky evals (nondeterministic failures)?
 *     A: (1) Run each case k times, report pass rate, not binary pass/fail.
 *        (2) Increase timeout for slower models.
 *        (3) Use multiple judges (semantic similarity, codex-based, human).
 *        (4) Track which cases are flaky (high variance) and investigate.
 *
 *  Q: What if ground truth is subjective (e.g., "is this response friendly")?
 *     A: Use multiple human raters + agreement score. Or use a reference LLM
 *        as judge (Claude, GPT-4) with rubric. Validate against human raters
 *        to check judge quality.
 *
 *  Q: How do you catch regressions early?
 *     A: (1) Store baseline metrics (upstream main branch).
 *        (2) Each PR/eval run compares metrics vs baseline (e.g., passRate
 *        drop > 5% → fail CI).
 *        (3) Per-metric + per-category (e.g., easy vs hard).
 *
 *  Q: Eval on public benchmark vs proprietary data?
 *     A: Both. Public (GSM8K, HotpotQA) is reproducible, comparable.
 *        Proprietary is realistic, company-confidential. Desirable: mix.
 *        Report both separately.
 */
