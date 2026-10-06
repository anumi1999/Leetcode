# ML Model Deep-Dive Map (Interview-First)

Goal: build depth on the small set of models that dominate ranking/recommendation interviews.

## What to master (priority order)

1. Logistic Regression (strong baseline)
2. Gradient Boosted Trees (XGBoost/LightGBM)
3. Embedding Retrieval (two-tower + ANN)
4. Learning-to-Rank losses (pointwise/pairwise/listwise)
5. Sequential models for intent (session/history signals)
6. Multi-objective ranking (relevance + diversity + fairness)

## For each model, be able to answer

1. Why this model for this stage?
2. What features does it exploit best?
3. Offline metrics that reflect its strengths.
4. Serving latency and scalability implications.
5. Common failure mode and concrete mitigation.

## Study sequence (7-day sprint)

- Day 1: 03_logistic_regression_baseline.md
- Day 2: 04_gbdt_ranking.md
- Day 3: 05_two_tower_retrieval.md
- Day 4: 06_ltr_losses.md
- Day 5: 07_calibration_and_thresholding.md
- Day 6: 08_cold_start_and_exploration.md
- Day 7: 09_fairness_and_guardrails.md + mock

## Interview output format (always)

1. Objective + constraints
2. Data and labels
3. Model and why
4. Evaluation offline + online
5. Serving and rollback plan
6. Risks and mitigations
