# Mock Interview 01 (Timed 35 min)

## Prompt
You are designing an AI talent platform feature that recommends top candidates for each open role.
The platform has sparse explicit feedback and delayed outcomes. Build the end-to-end ML strategy.

## Candidate instructions

- Spend 3 min clarifying assumptions.
- Spend 12 min on modeling/design.
- Spend 8 min on evaluation and experimentation.
- Spend 8 min on deployment/monitoring/failure handling.
- Keep 4 min for follow-ups.

## Scoring rubric (0-5 each)

1. Problem framing and metric alignment.
2. Data/label design under bias and delay.
3. Model architecture and trade-offs.
4. Evaluation rigor and segmentation.
5. Production execution and rollback readiness.

## Hard follow-up questions

1. Your offline NDCG improved, but recruiter satisfaction dropped. Diagnose quickly.
2. How would you debias labels from exposure effects?
3. How do you handle new candidates with little profile data?
4. What is your rollback trigger in the first 24 hours of launch?
5. What fairness checks do you enforce before full rollout?

## Self-review checklist

- Did you define one clear north-star metric?
- Did you cover latency budget and serving architecture?
- Did you separate retrieval and ranking responsibilities?
- Did you include calibration and drift monitoring?
- Did you explain one concrete failure mode and mitigation?
