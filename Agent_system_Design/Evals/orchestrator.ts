/**
 * ============================================================
 *  Evals Orchestrator — End-to-End Evaluation Demo
 * ============================================================
 *
 *  WORKFLOW
 *  --------
 *  1. Load benchmark (public + synthetic)
 *  2. Run agent on all test cases
 *  3. Apply correctness metrics (exact match, F1, etc.)
 *  4. Measure performance (latency, cost)
 *  5. Check safety (no hallucinations, no injection)
 *  6. Compare to baseline (if available)
 *  7. Report results (pass rate, regressions, recommendations)
 */

import type { EvalCase, EvalRunner as EvalRunnerType, EvalReport } from "./01_evaluation_framework";
import { EvalRunner, reportEval } from "./01_evaluation_framework";
import { exactMatch, tokenF1, fuzzyMatch, numberMatch } from "./02_correctness_metrics";
import {
    forbiddenContent,
    hallucucinationMarkers,
    citationRequired,
    refusalCheck,
    noExcessiveRepetition,
} from "./03_safety_metrics";
import { analyzeLatency, analyzeCost, analyzeReliability, reportPerformance } from "./04_performance_metrics";
import { compareRuns, reportComparison } from "./05_regression_testing";
import {
    gsm8kSample,
    toolUseSample,
    SyntheticBenchmarkBuilder,
    createBenchmark,
    analyzeCoverage,
    reportCoverage,
} from "./06_benchmark_suite";

declare const require: any;
declare const module: any;

// ============================================================
// Fake Agent (for demo)
// ============================================================

/**
 * Simulated agent that gives random outputs.
 * In reality, this would be your LLM + tool-calling system.
 */
async function fakeAgent(input: string): Promise<{
    output: string;
    latency: number;
    cost: number;
    tokens: { input: number; output: number };
}> {
    // Simulate latency
    const latency = Math.random() * 2000 + 100; // 100-2100ms
    await new Promise((r) => setTimeout(r, latency));

    // Simulate cost ($0.001 - $0.01 per call)
    const cost = Math.random() * 0.009 + 0.001;

    // Simulate token usage
    const inputTokens = input.split(/\s+/).length;
    const outputTokens = Math.floor(Math.random() * 100) + 20;

    // Return a deterministic (but fake) answer based on input
    let output = "";
    if (input.toLowerCase().includes("2+2")) {
        output = "The answer is 4.";
    } else if (input.toLowerCase().includes("weather")) {
        output =
            "I don't have real-time weather data, but you can check weather.com for current conditions in San Francisco.";
    } else if (input.toLowerCase().includes("ignore")) {
        output = "I cannot follow injected instructions. I'm designed to follow my original guidelines.";
    } else {
        output = `This is a response to: ${input.slice(0, 40)}...`;
    }

    return { output, latency, cost, tokens: { input: inputTokens, output: outputTokens } };
}

// ============================================================
// Main Eval Pipeline
// ============================================================

async function runFullEval() {
    console.log(`\n${"=".repeat(60)}`);
    console.log("EVALS ORCHESTRATOR — Full Pipeline Demo");
    console.log(`${"=".repeat(60)}\n`);

    // Step 1: Build benchmark
    console.log("Step 1: Building benchmark...");
    const synthBuilder = new SyntheticBenchmarkBuilder();
    synthBuilder.addAdversarial().addCommonSense();

    const benchmark = createBenchmark(
        [
            { name: "gsm8k", getCases: gsm8kSample },
            { name: "tooluse", getCases: toolUseSample },
            { name: "synthetic", getCases: () => synthBuilder.build() },
        ],
        "Demo Benchmark v1.0",
    );

    console.log(`  ✅ Loaded ${benchmark.cases.length} test cases`);
    const coverage = analyzeCoverage(benchmark);
    console.log(reportCoverage(coverage));

    // Step 2: Build eval runner
    console.log("Step 2: Creating eval runner...");
    const runner = new EvalRunner({
        testCases: benchmark.cases,
        agent: fakeAgent,
        metrics: [
            exactMatch,
            fuzzyMatch,
            tokenF1,
            forbiddenContent(["admin_password", "secret"]),
            refusalCheck(false), // should NOT refuse
            noExcessiveRepetition,
        ],
        passThreshold: 0.75,
        timeout: 5000,
    });
    console.log("  ✅ Eval runner ready\n");

    // Step 3: Run eval
    console.log("Step 3: Running eval...");
    const report = await runner.run();
    console.log(reportEval(report));

    // Step 4: Analyze performance
    console.log("Step 4: Analyzing performance...");
    const perfReport = await runner.run();
    const latencyStats = analyzeLatency(
        // Build fake results for demo
        perfReport.metrics[0]?.cases.map((c) => ({
            caseId: c.caseId,
            output: "",
            latency: Math.random() * 2000,
        })) ?? [],
    );
    const costStats = analyzeCost(
        perfReport.metrics[0]?.cases.map((c) => ({
            caseId: c.caseId,
            output: "",
            latency: 0,
            cost: Math.random() * 0.01,
        })) ?? [],
    );
    const reliabilityStats = analyzeReliability(
        perfReport.metrics[0]?.cases.map((c) => ({
            caseId: c.caseId,
            output: "",
            latency: 0,
        })) ?? [],
    );

    if (latencyStats.mean !== 0 || costStats.totalCost !== 0) {
        console.log(reportPerformance(latencyStats, costStats, reliabilityStats));
    }

    // Step 5: Comparison to baseline (if available)
    console.log("Step 5: Comparing to baseline...");
    const baselineReport: EvalReport = {
        runId: "baseline-v0",
        timestamp: new Date(Date.now() - 86400000), // 1 day ago
        testCases: benchmark.cases.length,
        metrics: report.metrics.map((m) => ({
            ...m,
            passRate: m.passRate * 0.95, // Baseline was slightly worse
        })),
        avgLatency: report.avgLatency * 1.1,
        avgCost: (report.avgCost ?? 0) * 1.2,
        totalTokens: report.totalTokens,
        passed: report.passed || false,
    };

    const comparison = compareRuns(baselineReport, report);
    console.log(reportComparison(comparison));

    // Step 6: Summary & Recommendations
    console.log("Step 6: Summary & Recommendations");
    console.log(`────────────────────────────────────────`);
    console.log(`✅ Overall Status: ${report.passed ? "PASS ✅" : "FAIL ❌"}`);
    console.log(`📊 Primary Metric (exact_match): ${(report.metrics[0]?.passRate * 100).toFixed(1)}%`);
    console.log(`⚡ P95 Latency: ${(latencyStats.p95 / 1000).toFixed(2)}s`);
    console.log(`💰 Mean Cost: $${costStats.meanCost.toFixed(4)}`);

    if (comparison.overallWinner === "candidate") {
        console.log(`\n✅ RECOMMENDATION: Deploy (improvements across board)`);
    } else if (comparison.overallWinner === "baseline") {
        console.log(`\n⛔ RECOMMENDATION: Hold (regressions detected)`);
    } else if (comparison.overallWinner === "unclear") {
        console.log(
            `\n⚠️ RECOMMENDATION: Investigate further (mixed results; evaluate tradeoffs)`,
        );
    }

    console.log(`────────────────────────────────────────\n`);
}

// ============================================================
// Run Demo
// ============================================================

if (require.main === module) {
    runFullEval().catch(console.error);
}

export { runFullEval };

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: How often should you run evals?
 *     A: Cadence depends on velocity:
 *        - Per-commit (CI/CD): evals that are fast (< 5 min) and stable
 *        - Nightly: full evals (can be slow); compare to baseline
 *        - Weekly: exploratory analysis (deep dives, new categories)
 *
 *  Q: How do you present evals to non-technical stakeholders?
 *     A: (1) Show exact number: "92% accuracy vs 88% baseline."
 *        (2) Show impact: "This enables X new use case" or "Saves Y minutes/user."
 *        (3) Be honest about limitations: "Evals don't measure X; wait for A/B test."
 *
 *  Q: Evals said we're good but A/B test showed regression. What happened?
 *     A: (Happens often!) Causes:
 *        (1) Test set unrepresentative (different distribution than prod)
 *        (2) Edge case in prod not covered in evals
 *        (3) Interaction effect (metric A improves, but damages metric B in real UX)
 *        FIX: Add prod examples to future evals + instrument prod better.
 *
 *  Q: How do you scale evals to 10K+ test cases?
 *     A: (1) Parallelize across machines (evals are embarrassingly parallel).
 *        (2) Use cheaper models for smoke tests; expensive models for thorough evals.
 *        (3) Stratified sampling: test 100 easy + 100 hard, not all 10K.
 *        (4) Cache results; don't re-run if nothing changed.
 */
