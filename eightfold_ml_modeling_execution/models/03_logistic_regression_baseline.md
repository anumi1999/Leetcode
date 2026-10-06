# Deep Dive 03: Logistic Regression Baseline

## Why interviewers like this

- Fast, stable, interpretable baseline.
- Excellent sanity-check before complex models.
- Often wins when data is noisy or sparse.

## Use in talent matching

- Predict probability of recruiter action for (candidate, job).
- Features: skill overlap counts, experience gap, location match flags, recency, activity features.

## Strengths

1. Robust with sparse one-hot and hashed features.
2. Calibrated-ish probabilities (better than many rankers out of box).
3. Easy debugging and feature importance sign checks.

## Weaknesses

1. Linear interactions unless manually engineered.
2. Can underfit semantic matching.
3. Needs heavy feature engineering for non-linear patterns.

## What to say in interview

- "I start with LR as a reliability anchor and calibration reference."
- "If LR underfits on high-intent segments, I move to GBDT/deep reranker."

## Execution checklist

1. Regularization tuning (L1/L2).
2. Class imbalance handling (weights/negative sampling).
3. Probability calibration check (ECE/Brier).
4. Segment-level error analysis.

## Failure mode

- Good global AUC, poor top-K quality.
- Mitigation: switch objective to ranking-friendly training and compare NDCG@K.
