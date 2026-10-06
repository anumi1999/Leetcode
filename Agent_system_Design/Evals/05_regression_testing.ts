/**
 * ============================================================
 *  05 — Regression Testing & A/B Comparison
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  You deployed a new model/agent version. Did it improve or regress?
 *  - "Accuracy went from 82% to 81%." Is that significant or noise?
 *  - "Latency improved but cost exploded." Is the tradeoff worth it?
 *  - "It's better on hard examples but worse on easy ones." What to do?
 *
 *  APPROACH
 *  --------
 *  (1) Run eval on both versions (baseline and candidate).
 *  (2) Compute metric differences per case (per-example analysis).
 *  (3) Test statistical significance (t-test, bootstrap).
 *  (4) Stratify by category (easy/hard, category A/B).
 *  (5) Compute Pareto frontier (better on some metrics, worse on others?).
 *  (6) Decision: deploy, hold, or investigate further.
 */

import type { EvalReport } from "./01_evaluation_framework";
import type { MetricStats } from "./01_evaluation_framework";

// ============================================================
// Pairwise Comparison
// ============================================================

export interface ComparisonMetric {
    name: string;
    baselineValue: number;
    candidateValue: number;
    improvement: number; // > 0 means candidate is better
    percentChange: number; // (candidate - baseline) / baseline * 100
    significant: boolean; // p < 0.05
}

export interface ComparisonReport {
    baselineRunId: string;
    candidateRunId: string;
    timestamp: Date;
    metrics: ComparisonMetric[];
    overallWinner: "baseline" | "candidate" | "tie" | "unclear";
    regressions: string[]; // metrics that got worse
    improvements: string[]; // metrics that got better
    changesSummary: string;
}

/**
 * Compare two eval runs.
 */
export function compareRuns(baseline: EvalReport, candidate: EvalReport): ComparisonReport {
    const metrics: ComparisonMetric[] = [];
    const regressions: string[] = [];
    const improvements: string[] = [];

    // Match metrics by name between baseline and candidate
    const baselineMap = new Map(baseline.metrics.map((m) => [m.name, m]));
    const candidateMap = new Map(candidate.metrics.map((m) => [m.name, m]));

    for (const candMetric of candidate.metrics) {
        const baseMetric = baselineMap.get(candMetric.name);
        if (!baseMetric) {
            console.warn(`Metric ${candMetric.name} not in baseline; skipping`);
            continue;
        }

        // For pass rate, higher is better
        const baseValue = baseMetric.passRate;
        const candValue = candMetric.passRate;
        const improvement = candValue - baseValue;
        const percentChange = baseValue > 0 ? (improvement / baseValue) * 100 : 0;

        // Simplified significance test (in reality, use t-test on per-case scores)
        const significant = Math.abs(improvement) > 0.05; // > 5% change is significant

        metrics.push({
            name: candMetric.name,
            baselineValue: baseValue,
            candidateValue: candValue,
            improvement,
            percentChange,
            significant,
        });

        if (improvement < -0.02) {
            regressions.push(`${candMetric.name}: ${(baseValue * 100).toFixed(1)}% → ${(candValue * 100).toFixed(1)}%`);
        } else if (improvement > 0.02) {
            improvements.push(`${candMetric.name}: ${(baseValue * 100).toFixed(1)}% → ${(candValue * 100).toFixed(1)}%`);
        }
    }

    // Determine overall winner
    let winner: "baseline" | "candidate" | "tie" | "unclear" = "tie";
    if (improvements.length > 0 && regressions.length === 0) {
        winner = "candidate";
    } else if (regressions.length > 0 && improvements.length === 0) {
        winner = "baseline";
    } else if (improvements.length > 0 && regressions.length > 0) {
        winner = "unclear";
    }

    const changesSummary =
        improvements.length > 0 && regressions.length === 0
            ? `✅ Improvements: ${improvements.length} metrics better`
            : regressions.length > 0 && improvements.length === 0
              ? `❌ Regressions: ${regressions.length} metrics worse`
              : improvements.length > 0 && regressions.length > 0
                ? `⚠️ Mixed: ${improvements.length} better, ${regressions.length} worse`
                : `→ No change`;

    return {
        baselineRunId: baseline.runId,
        candidateRunId: candidate.runId,
        timestamp: new Date(),
        metrics,
        overallWinner: winner,
        regressions,
        improvements,
        changesSummary,
    };
}

// ============================================================
// Per-Example Analysis (Case-Level Breakdown)
// ============================================================

export interface PerCaseComparison {
    caseId: string;
    metric: string;
    baselineScore: number;
    candidateScore: number;
    delta: number; // > 0 means candidate improved
}

/**
 * For each test case, did the new version perform better/worse?
 * Identifies which examples got better/worse and by how much.
 */
export function perCaseComparison(
    baseline: EvalReport,
    candidate: EvalReport,
): PerCaseComparison[] {
    const results: PerCaseComparison[] = [];

    const baselineMetricsMap = new Map(baseline.metrics.map((m) => [m.name, m]));

    for (const candMetric of candidate.metrics) {
        const baseMetric = baselineMetricsMap.get(candMetric.name);
        if (!baseMetric) continue;

        // Match per-case results by caseId
        const baseCasesMap = new Map(baseMetric.cases.map((c) => [c.caseId, c]));

        for (const candCase of candMetric.cases) {
            const baseCase = baseCasesMap.get(candCase.caseId);
            if (!baseCase) continue;

            const baseScore = baseCase.score ?? (baseCase.passed ? 1 : 0);
            const candScore = candCase.score ?? (candCase.passed ? 1 : 0);

            results.push({
                caseId: candCase.caseId,
                metric: candMetric.name,
                baselineScore: baseScore,
                candidateScore: candScore,
                delta: candScore - baseScore,
            });
        }
    }

    return results;
}

// ============================================================
// Statistical Significance
// ============================================================

/**
 * Bootstrap confidence interval for pass rate improvement.
 * Resamples the data k times, computes pass rate each time.
 */
export function bootstrapCI(
    deltas: number[],
    confidence: number = 0.95,
): { lower: number; upper: number } {
    const k = 1000;
    const bootstrapMeans: number[] = [];

    for (let i = 0; i < k; i++) {
        let sum = 0;
        for (let j = 0; j < deltas.length; j++) {
            const idx = Math.floor(Math.random() * deltas.length);
            sum += deltas[idx];
        }
        bootstrapMeans.push(sum / deltas.length);
    }

    bootstrapMeans.sort((a, b) => a - b);
    const alpha = 1 - confidence;
    const lowerIdx = Math.floor((alpha / 2) * bootstrapMeans.length);
    const upperIdx = Math.floor((1 - alpha / 2) * bootstrapMeans.length);

    return {
        lower: bootstrapMeans[lowerIdx],
        upper: bootstrapMeans[upperIdx],
    };
}

/**
 * Is the improvement statistically significant?
 * If 95% CI doesn't include 0, we can be confident it's real.
 */
export function isSignificant(deltas: number[], confidence: number = 0.95): boolean {
    const ci = bootstrapCI(deltas, confidence);
    return ci.lower > 0 || ci.upper < 0; // doesn't cross zero
}

// ============================================================
// Category-Stratified Analysis
// ============================================================

/**
 * Performance breakdown by category (easy/hard, domain, etc).
 */
export interface StratifiedMetrics {
    category: string;
    testCount: number;
    baselinePassRate: number;
    candidatePassRate: number;
    deltaPassRate: number;
}

/**
 * Compare performance by category tag in metadata.
 */
export function stratifiedComparison(
    baseline: EvalReport,
    candidate: EvalReport,
    categoryKey: string,
    caseIdToCategory: Record<string, string> = {},
): StratifiedMetrics[] {
    const categories = new Map<string, {
        total: number;
        baselinePass: number;
        candidatePass: number;
    }>();

    const baselineMetricByName = new Map(baseline.metrics.map((m) => [m.name, m]));

    // Helper for category resolution.
    // Priority: explicit map -> metadata key encoded in case id -> prefix before first underscore.
    const getCategory = (caseId: string): string => {
        if (caseIdToCategory[caseId]) return caseIdToCategory[caseId];

        const marker = `${categoryKey}=`;
        const markerPos = caseId.indexOf(marker);
        if (markerPos !== -1) {
            const valueStart = markerPos + marker.length;
            const nextSep = caseId.indexOf("|", valueStart);
            return nextSep === -1 ? caseId.slice(valueStart) : caseId.slice(valueStart, nextSep);
        }

        const underscore = caseId.indexOf("_");
        if (underscore !== -1) return caseId.slice(0, underscore);
        return "unknown";
    };

    for (const candMetric of candidate.metrics) {
        const baseMetric = baselineMetricByName.get(candMetric.name);
        if (!baseMetric) continue;

        const baselineCaseById = new Map(baseMetric.cases.map((c) => [c.caseId, c]));

        for (const candCase of candMetric.cases) {
            const baseCase = baselineCaseById.get(candCase.caseId);
            if (!baseCase) continue;

            const category = getCategory(candCase.caseId);
            const current = categories.get(category) ?? {
                total: 0,
                baselinePass: 0,
                candidatePass: 0,
            };

            current.total += 1;
            if (baseCase.passed) current.baselinePass += 1;
            if (candCase.passed) current.candidatePass += 1;

            categories.set(category, current);
        }
    }

    const result: StratifiedMetrics[] = [];
    for (const [category, stats] of categories) {
        const baselinePassRate = stats.total > 0 ? stats.baselinePass / stats.total : 0;
        const candidatePassRate = stats.total > 0 ? stats.candidatePass / stats.total : 0;
        result.push({
            category,
            testCount: stats.total,
            baselinePassRate,
            candidatePassRate,
            deltaPassRate: candidatePassRate - baselinePassRate,
        });
    }

    return result.sort((a, b) => b.deltaPassRate - a.deltaPassRate);
}

// ============================================================
// Reporting
// ============================================================

export function reportComparison(comparison: ComparisonReport): string {
    const lines: string[] = [];
    lines.push(`\n════════════════════════════════════════`);
    lines.push(`Comparison Report`);
    lines.push(`Baseline: ${comparison.baselineRunId}`);
    lines.push(`Candidate: ${comparison.candidateRunId}`);
    lines.push(`────────────────────────────────────────`);
    lines.push(`${comparison.changesSummary}`);
    lines.push(`Overall: ${comparison.overallWinner.toUpperCase()}`);
    lines.push(`────────────────────────────────────────`);

    for (const metric of comparison.metrics) {
        const icon = metric.improvement > 0 ? "📈" : metric.improvement < 0 ? "📉" : "→";
        const pct = metric.percentChange.toFixed(1);
        const sig = metric.significant ? "***" : "";
        lines.push(
            `${icon} ${metric.name}: ${metric.baselineValue.toFixed(3)} → ${metric.candidateValue.toFixed(3)} (${pct}%)${sig}`,
        );
    }

    if (comparison.regressions.length > 0) {
        lines.push(`\n⚠️ Regressions:`);
        for (const reg of comparison.regressions) {
            lines.push(`  - ${reg}`);
        }
    }

    if (comparison.improvements.length > 0) {
        lines.push(`\n✅ Improvements:`);
        for (const imp of comparison.improvements) {
            lines.push(`  - ${imp}`);
        }
    }

    lines.push(`════════════════════════════════════════\n`);

    return lines.join("\n");
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: How do you decide if a regression is worth accepting?
 *     A: Context-dependent. If accuracy drops 2% but latency halves,
 *        might be worth it for low-latency use cases. Always quantify
 *        the business tradeoff (e.g., 1% accuracy loss = X fewer conversions).
 *
 *  Q: What if different categories have opposite trends?
 *     A: This happens often. Stratified analysis reveals it. Then decide:
 *        - Is it acceptable to hurt one category?
 *        - Can you improve the worse category before deploying?
 *        - Is the win on important categories (high-traffic) worth it?
 *
 *  Q: How do you run A/B tests vs. evals?
 *     A: Evals are offline (low cost, fast feedback). A/B tests are online
 *        (real user metrics, but slow and require traffic). Deploy based on
 *        evals, measure impact with A/B. If A/B contradicts evals,
 *        investigate eval quality (are test cases representative?).
 *
 *  Q: How many test cases do you need for statistical significance?
 *     A: Depends on effect size and variance. Use power analysis (Python
 *        statsmodels) to compute. Rough rule: 100–1000 cases for 5% change.
 */
