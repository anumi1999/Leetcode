# Mock Interview 02: Modeling + Execution Deep Dive (45 min)

## Prompt
Design and operationalize a candidate-job ranking system for a global talent platform.
Traffic is high, feedback is delayed, and fairness constraints are mandatory.

## Structure

- 5 min: clarify assumptions and KPIs
- 15 min: model architecture (retrieval + reranker)
- 10 min: offline/online evaluation plan
- 10 min: deployment, monitoring, rollback
- 5 min: hard follow-ups

## Hard follow-ups

1. Offline NDCG improved but acceptance rate dropped. Diagnose in order.
2. ANN recall dropped after profile schema update. Incident response?
3. New market launches with sparse labels. Cold-start strategy?
4. Fairness parity worsened after model refresh. What do you do now?
5. Recruiter complaints: same candidates keep repeating. Fix design.

## Scoring rubric

1. Objective and KPI alignment
2. Data/label reliability under delay and bias
3. Model trade-off clarity
4. Evaluation and experimentation quality
5. Execution realism (latency/freshness/rollback)
6. Fairness and risk controls
