/**
 * ============================================================
 *  02 — Correctness Metrics
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  How do you know if the agent's answer is "correct"?
 *  - Exact match? Too strict (minor wording differences fail)
 *  - Substring? Too loose (embedding the answer in gibberish passes)
 *  - Token F1? Okay, but ignores word order
 *  - Semantic similarity? Good, but requires embedding model
 *
 *  STRATEGY
 *  --------
 *  Combine multiple judges:
 *  1. Exact match (strict)
 *  2. Fuzzy match (allows minor rewording)
 *  3. Token F1 (bag-of-words precision + recall)
 *  4. Semantic (cosine distance in embedding space)
 *
 *  Each judge returns a score 0–1. Aggregate to final verdict.
 */

import type { EvalCase, EvalResult, Metric } from "./01_evaluation_framework";

// ============================================================
// Simple String Judges
// ============================================================

/** Perfect string match, case-insensitive and whitespace-normalized */
export const exactMatch: Metric = {
    name: "exact_match",
    judge(result: EvalResult, testCase: EvalCase): boolean {
        const expected = Array.isArray(testCase.expected)
            ? testCase.expected
            : [testCase.expected];
        const actual = result.output.trim().toLowerCase();
        return expected.some((e) => e.trim().toLowerCase() === actual);
    },
};

/** The expected string appears anywhere in the output */
export const containsMatch: Metric = {
    name: "contains",
    judge(result: EvalResult, testCase: EvalCase): boolean {
        const expected = Array.isArray(testCase.expected)
            ? testCase.expected
            : [testCase.expected];
        const actual = result.output.toLowerCase();
        return expected.some((e) => actual.includes(e.toLowerCase()));
    },
};

// ============================================================
// Fuzzy Matching (Levenshtein distance)
// ============================================================

/** Edit distance between two strings */
function levenshtein(a: string, b: string): number {
    const memo: Map<string, number> = new Map();

    function dp(i: number, j: number): number {
        if (i === 0) return j;
        if (j === 0) return i;

        const key = `${i},${j}`;
        if (memo.has(key)) return memo.get(key)!;

        const cost =
            a[i - 1] === b[j - 1]
                ? dp(i - 1, j - 1)
                : 1 + Math.min(dp(i - 1, j), dp(i, j - 1), dp(i - 1, j - 1));

        memo.set(key, cost);
        return cost;
    }

    return dp(a.length, b.length);
}

/** Fuzzy match: 1.0 if identical, 0.0 if completely different, 0–1 for partial */
export const fuzzyMatch: Metric = {
    name: "fuzzy_match",
    judge(result: EvalResult, testCase: EvalCase): number {
        const expected = Array.isArray(testCase.expected)
            ? testCase.expected
            : [testCase.expected];
        const actual = result.output.trim().toLowerCase();

        let maxSimilarity = 0;
        for (const exp of expected) {
            const e = exp.trim().toLowerCase();
            const dist = levenshtein(actual, e);
            const maxLen = Math.max(actual.length, e.length);
            const similarity = 1 - dist / maxLen;
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        return maxSimilarity;
    },
};

// ============================================================
// Token-Level F1 (Precision + Recall)
// ============================================================

/** Split text into tokens (words, preserving order) */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "") // remove punctuation
        .split(/\s+/)
        .filter((t) => t.length > 0);
}

/** F1 score based on word overlap */
export const tokenF1: Metric = {
    name: "token_f1",
    judge(result: EvalResult, testCase: EvalCase): number {
        const expected = Array.isArray(testCase.expected)
            ? testCase.expected
            : [testCase.expected];
        const actualTokens = new Set(tokenize(result.output));

        let maxF1 = 0;
        for (const exp of expected) {
            const expTokens = new Set(tokenize(exp));

            // Precision: what fraction of actual tokens are in expected?
            const precision =
                actualTokens.size > 0
                    ? Array.from(actualTokens).filter((t) => expTokens.has(t)).length /
                      actualTokens.size
                    : 0;

            // Recall: what fraction of expected tokens are in actual?
            const recall =
                expTokens.size > 0
                    ? Array.from(expTokens).filter((t) => actualTokens.has(t)).length /
                      expTokens.size
                    : 0;

            // F1 = 2 * (P * R) / (P + R)
            const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
            maxF1 = Math.max(maxF1, f1);
        }

        return maxF1;
    },
};

// ============================================================
// Number Extraction (for math/QA problems)
// ============================================================

/** For math problems: extract final numeric answer and check tolerance */
export const numberMatch: Metric = {
    name: "number_match",
    judge(result: EvalResult, testCase: EvalCase): boolean {
        const expected = Array.isArray(testCase.expected)
            ? testCase.expected
            : [testCase.expected];

        // Extract last number from output
        const numberRegex = /-?\d+\.?\d*/g;
        const actualNumbers = result.output.match(numberRegex);
        if (!actualNumbers || actualNumbers.length === 0) return false;

        const actualNum = parseFloat(actualNumbers[actualNumbers.length - 1]);

        // Check against any expected number (within 1% tolerance)
        for (const exp of expected) {
            const expNumbers = exp.match(numberRegex);
            if (expNumbers) {
                for (const expNum of expNumbers) {
                    const expectedVal = parseFloat(expNum);
                    if (Math.abs(actualNum - expectedVal) / Math.max(Math.abs(expectedVal), 1) <
                        0.01
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    },
};

// ============================================================
// Composite Judge
// ============================================================

/**
 * Combine multiple judges into one.
 * Returns 1 if all judges pass, else average of scores.
 */
export function compositeJudge(judges: Metric[]): Metric {
    return {
        name: `composite(${judges.map((j) => j.name).join("+")})`,
        judge(result: EvalResult, testCase: EvalCase): number {
            let scoreSum = 0;
            for (const judge of judges) {
                const score = judge.judge(result, testCase);
                scoreSum += typeof score === "boolean" ? (score ? 1 : 0) : score;
            }
            return scoreSum / judges.length;
        },
    };
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: What if the expected answer is a list (e.g., multiple valid solutions)?
 *     A: Store as array in testCase.expected. Judge tries each; passes if
 *        ANY match. Handles problems with multiple valid outputs (e.g., sorting).
 *
 *  Q: How do you judge "write Python code that solves X"?
 *     A: Can't just match text (spacing, variable names differ). Options:
 *        (1) Execute both versions and compare outputs on test cases.
 *        (2) Compare AST (abstract syntax tree) after parsing.
 *        (3) Use LLM-based judge (prompt Claude: "Is this correct? Yes/No").
 *
 *  Q: Token F1 ignores order. Isn't that bad for code/prose?
 *     A: Yes. For BLEU score (machine translation), also track 2-gram/3-gram
 *        overlap. For code, execute and compare. For prose, use embedding
 *        distance (semantic similarity).
 *
 *  Q: How do you handle timeouts / partial answers?
 *     A: (1) Partial credit (if output contains first step, score 0.5).
 *        (2) Timeout treated as failure (F1 = 0).
 *        (3) Separate metric for latency (pass only if < threshold).
 */
