# Modeling Pattern: Two-Stage Ranking Pipeline

## Why two-stage?

- Universe is huge (millions of candidates/jobs).
- Need fast candidate generation first, then precise reranking.

## Stage 1: Retrieval

- Learn dense embeddings for candidates and jobs.
- Use ANN index (HNSW/FAISS/ScaNN) for top-N recall.
- Optimize for recall and latency.

## Stage 2: Reranker

- Use richer cross features and contextual features.
- Models: XGBoost/LightGBM baseline, then deep ranker.
- Optimize NDCG-weighted loss or pairwise/listwise ranking objective.

## Typical feature buckets

1. Query/job features
2. Candidate features
3. Interaction features
4. Context features (region, seasonality, recruiter segment)

## Metric stack

- Retrieval: recall@N, latency p95.
- Reranker: NDCG@K, MRR, calibration (ECE/Brier).
- End-to-end: action rate and interview conversion.

## Interview pitfalls

- Ignoring exposure bias.
- No strategy for cold start.
- No feature freshness plan.
- No rollback criteria for deployment.
