# Case 01: Job-Candidate Matching System

## Prompt
Design an ML system that matches candidates to jobs and ranks recommendations for recruiters.

## What interviewer is testing

1. Problem framing and objective decomposition.
2. Label quality and delayed feedback handling.
3. Ranking formulation and candidate generation strategy.
4. Trade-offs between relevance, diversity, fairness, and latency.
5. Online experimentation + guardrails.

## Suggested answer structure (8-12 min)

1. Product objective
   - Primary: maximize high-quality recruiter-candidate interactions.
   - Secondary: reduce time-to-fill, increase recruiter productivity.

2. Prediction task definition
   - Pairwise relevance score for (candidate, job) at time t.
   - Decide if one-stage or two-stage ranking.

3. Data + labels
   - Positives: recruiter outreach accepted, interview scheduled, offer accepted.
   - Negatives: skipped candidates, rejected outreach.
   - Address position bias and missing-not-at-random exposure.

4. Feature strategy
   - Candidate side: skills, seniority, trajectory, recency.
   - Job side: requirements, level, location constraints.
   - Interaction side: semantic similarity, prior employer overlap, intent signals.

5. Modeling approach
   - Stage 1 retrieval: ANN embedding recall.
   - Stage 2 ranking: GBDT or deep ranker with calibrated score.

6. Evaluation
   - Offline: NDCG@K, MAP, Precision@K, calibration error.
   - Online: acceptance rate, interview rate, recruiter action rate.

7. Serving/system constraints
   - Candidate retrieval latency budget, freshness policy, feature store consistency.

8. Risks and mitigations
   - Fairness drift, stale profiles, cold-start for new jobs/candidates.

## Follow-up drill

- If acceptance rate rises but interview rate drops, what failed?
- How do you avoid recommending the same candidate repeatedly?
- How do you design for explainability to recruiters?
