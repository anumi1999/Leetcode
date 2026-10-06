# Deep Dive 05: Two-Tower Retrieval + ANN

## What problem it solves

- Full pairwise scoring across all jobs/candidates is impossible at scale.
- Two-tower retrieves a high-recall shortlist quickly.

## Architecture

1. Candidate tower embeds candidate profile to vector.
2. Job tower embeds job posting to vector.
3. Similarity (dot/cosine) used for nearest-neighbor retrieval.
4. ANN index serves top-N quickly.

## Training signals

- Positive pairs: accepted outreach, interview, hire.
- Negatives: hard negatives from exposed-but-ignored results.

## Key trade-offs

- Better retrieval recall vs stricter latency budget.
- Embedding quality vs index update cadence.
- Hard negatives improve quality but can destabilize training if mislabeled.

## Metrics

- Recall@N for downstream candidate set quality.
- Latency p95/p99 for retrieval service.
- End-to-end impact through reranker outcomes.

## Failure mode

- Retrieval recall drops silently after taxonomy/profile schema changes.
- Mitigation: canary index rebuild + backtest recall by segment.
