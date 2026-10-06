## Evals — Evaluation Framework for AI Agents

### Overview

A comprehensive system for **testing, measuring, and comparing** AI agents and LLM systems. Evals answer the question: *"Is my agent working? Is it better than the baseline? Am I ready to deploy?"*

### Module Structure

#### **01_evaluation_framework.ts** — Core Types & Runner
- **Types**: `EvalCase`, `EvalResult`, `Metric`, `MetricStats`, `EvalReport`
- **EvalRunner**: Run agent on test set, compute metrics, aggregate results
- **Reporting**: Structured results output (pass rate, latency, cost)

**Key Insight**: Evals are not binary (pass/fail) — they're continuous scores over a population of test cases.

---

#### **02_correctness_metrics.ts** — Judging Accuracy

How to know if an answer is "correct"? We provide multiple judges:

- **Exact Match**: Strict string equality (case-insensitive)
- **Fuzzy Match**: Levenshtein distance-based similarity (0–1)
- **Token F1**: Bag-of-words precision/recall (word overlap)
- **Number Match**: Extract last number; check tolerance (±1%)
- **Composite**: Combine multiple judges for robust scoring

**When to use each**:
- **Exact match**: Math problems, factual Q&A
- **Token F1**: Summarization, free-form text
- **Fuzzy match**: Typo-tolerant tasks
- **Number match**: Physics, finance problems

---

#### **03_safety_metrics.ts** — Hallucination & Risk Detection

Correctness ≠ Safety. An agent can answer accurately but unsafely (hallucinate facts, fall for prompt injection, refuse legitimate requests).

- **Forbidden Content**: Block known-bad phrases
- **Hallucination Markers**: Detect groundless claims ("I don't have access to...")
- **Citation Check**: Require sources for factual claims
- **Refusal Analysis**: Did agent refuse when it shouldn't? (or refuse when it should?)
- **Prompt Injection Resistance**: Does the agent leak "secrets" when prompted?
- **Output Sanity**: Length bounds, no excessive repetition
- **Safety Composite**: All checks must pass

**Interview Gotcha**: "Evals showed 95% accuracy, but in prod users find 10% are hallucinations." Solution: Add hallucination detection to your eval suite.

---

#### **04_performance_metrics.ts** — Latency, Cost, Throughput

Beyond correctness, measure resource utilization:

- **Latency Stats**: mean, p50, p95, p99 (tail latency matters!)
- **Cost Analysis**: per-query cost, cost per 1K tokens
- **Reliability**: error rate, timeout count
- **Efficiency Ratio**: latency-to-cost tradeoff
- **Pareto Frontier**: Which models are on the efficiency frontier?

**Reporting**:
```
Latency: mean=340ms, p95=1.2s, p99=3.5s
Cost: mean=$0.004, per 1k tokens=$0.12
Reliability: 987/1000 success (98.7%)
```

---

#### **05_regression_testing.ts** — A/B Comparison & Significance

Deployed a new agent version. Is it better or worse?

- **Pairwise Comparison**: Compare baseline vs. candidate on all metrics
- **Per-Example Analysis**: Which test cases got better/worse?
- **Statistical Significance**: Bootstrap CI; is improvement real or noise?
- **Stratified Analysis**: Compare by category (easy/hard), domain, etc.
- **Decision Logic**: Identify regressions, improvements, unclear cases

**Flow**:
1. Run eval on v0 (baseline)
2. Run eval on v1 (candidate)
3. Compare → flag regressions/improvements
4. Stratify to find problem areas
5. Decide: deploy, hold, or investigate

---

#### **06_benchmark_suite.ts** — Test Data Construction

Your eval is only as good as your test data.

- **Public Benchmarks**: GSM8K (math), HotpotQA (multi-hop), tool-calling tests
- **Synthetic Adversarial**: Prompt injection, ambiguous language, edge cases
- **Stratification**: By difficulty, category, source
- **Coverage Analysis**: Do we have enough examples of each category?
- **Versioning**: v1.0 stable, v2.0 adds new categories

**Best Practices**:
- Mix public + proprietary + synthetic
- Stratify by difficulty to find failure modes
- Version test sets (reproducibility)
- Separate train/val/test strictly
- Track coverage gaps

---

#### **orchestrator.ts** — End-to-End Demo

Full pipeline in one place:
1. Build benchmark (public + synthetic)
2. Run agent on all test cases
3. Apply correctness + safety metrics
4. Analyze performance (latency, cost)
5. Compare to baseline
6. Generate final report & recommendation

**Output**:
```
Comparison Report
Baseline: eval-12345
Candidate: eval-12346
────────────
✅ Improvements: 3 metrics better
Overall: CANDIDATE (deploy)
────────────
exact_match: 82% → 86% (📈 +4.8%)
latency_p99: 2.1s → 1.8s (📈 -14.3%)
cost: $0.004 → $0.005 (📉 +25%)
────────────
⚠️ Regressions: cost went up (acceptable tradeoff?)
✅ Improvements: accuracy + speed both up
```

---

### Interview Cheat Sheet

**Q: How do you know if your agent is working?**
A: Run evals on a fixed test set. Measure pass rate (correctness), latency, cost, and safety. Track regressions vs. baseline.

**Q: What's the difference between evals and A/B tests?**
A: Evals are offline (fast, cheap, done before deploy). A/B tests are online (real users, slow, final validation). Deploy based on evals; validate with A/B tests.

**Q: Test set has 1000 cases. Agent passes 850. Good or bad?**
A: Depends on baseline. If it was 800 before, +50 is progress. If it was 900 before, -50 is regression. Always compare to baseline + stratify (maybe the agent got worse on easy cases but better on hard ones).

**Q: How many test cases do you need?**
A: Depends on variance and effect size. Rough rule: 100–1K cases. Use power analysis (statsmodels) to compute.

**Q: Evals pass but users complain. What happened?**
A: Common causes:
- Test set unrepresentative (different distribution than prod)
- Eval missed a critical behavior (hallucinations, latency spikes)
- Interaction effects (metric A improves, but breaks metric B in real UX)
FIX: Add prod examples to evals, instrument prod, iterate.

---

### Study Flow (1 Day Per File)

1. **Day 1**: Read 01_evaluation_framework.ts. Understand EvalRunner, metrics, aggregation.
2. **Day 2**: Read 02_correctness_metrics.ts. Implement fuzzy match; test on your own examples.
3. **Day 3**: Read 03_safety_metrics.ts. Think about what "safe" means for your agent.
4. **Day 4**: Read 04_performance_metrics.ts. Measure latency distribution on your system.
5. **Day 5**: Read 05_regression_testing.ts. Compare two model versions; interpret results.
6. **Day 6**: Read 06_benchmark_suite.ts. Design a test set for your agent.
7. **Day 7**: Run orchestrator.ts. Execute full pipeline end-to-end.

---

### Real-World Patterns

**Pattern 1: Smoke Tests (Fast)**
- Run on 50 examples before deploying
- Must not regress on core metrics
- Takes 2 minutes

**Pattern 2: Nightly Evals (Thorough)**
- Run on 1K examples
- Track all metrics + stratification
- Compare to baseline
- Send report to team

**Pattern 3: A/B Tests (Online)**
- After evals pass, deploy to 10% of users
- Measure real metrics (latency, satisfaction, revenue)
- If A/B disagrees with evals, investigate why

---

### Common Mistakes

❌ **Mistake 1**: Optimizing for evals without A/B testing
- Fix: Always validate evals with real users

❌ **Mistake 2**: Test set contaminated (seen during training)
- Fix: Keep train/val/test strictly separate; check for overlap

❌ **Mistake 3**: Only measuring accuracy; ignoring safety
- Fix: Add safety metrics (hallucination, injection, refusal)

❌ **Mistake 4**: Eval passes but deployment fails (latency, cost)
- Fix: Measure performance (p95 latency, cost per query) in evals

❌ **Mistake 5**: Comparing apples to oranges (different test sets)
- Fix: Version benchmarks; always report which version you used

---

### Next Steps

- **Implement custom metrics**: Add domain-specific scorers (BLEU for translation, ROUGE for summarization)
- **Add LLM-as-judge**: Use Claude/GPT-4 as evaluator for nuanced tasks
- **Integrate with CI/CD**: Auto-run evals on every commit; block deploy if regression
- **Build dashboard**: Track metrics over time; visualize progress
- **Instrument prod**: Capture real user feedback; add to next eval iteration

---

### Further Reading

- [Hugging Face Evaluate](https://huggingface.co/docs/evaluate/) — Standard metrics
- [Reliant Code: Evals at Scale](https://huggingface.co/spaces/reliant-ai/evals-at-scale) — Best practices
- [OpenAI Evals](https://github.com/openai/evals) — Reference implementation
- [Stanford HELM](https://crfm.stanford.edu/helm/) — Comprehensive benchmark
