# Deep Dive 04: GBDT for Reranking

## Why this is high-yield

- Strong tabular performance.
- Captures non-linear interactions without deep architectures.
- Practical latency profile for reranking top-N.

## Typical setup

- Candidate set from retrieval (e.g., top 500).
- GBDT scores each (candidate, job) pair.
- Return top-K by score with optional diversity constraints.

## Feature classes

1. Candidate profile features
2. Job requirement features
3. Cross features (skill intersection, seniority distance)
4. Context features (market, recruiter behavior)

## Objective options

- Pointwise binary objective (simple baseline).
- Pairwise rank objective (improves ordering at top).
- Listwise when infrastructure supports it.

## Metrics

- Primary: NDCG@K, Precision@K.
- Secondary: calibration, slice quality by region/tenure.

## Serving concerns

- Feature freshness and consistency are bigger risk than model compute.
- Keep online feature transformations aligned with training pipeline.

## Failure mode

- Offline improvement, online no gain due to feature skew.
- Mitigation: online/offline feature parity tests + shadow validation.
