# ML Execution Checklist (Interview-Ready)

## 1. Problem + KPI contract

- Product KPI (business): define one north-star + 2 guardrails.
- ML KPI (proxy): pick offline metrics aligned to product KPI.
- Decision threshold policy and fallback behavior.

## 2. Data contract

- Define entity IDs, schema, event-time, late-arrival handling.
- Add data quality checks: nulls, ranges, category drift.
- Label generation pipeline with leakage checks.

## 3. Baseline and iteration plan

- Start with interpretable baseline.
- Define ablation plan by feature family.
- Keep a simple champion/challenger framework.

## 4. Evaluation design

- Temporal split over random split for non-stationary domains.
- Segment metrics by region, seniority, and data-density buckets.
- Error analysis slices before launch.

## 5. Deployment

- Shadow mode first.
- Canary with strict rollback thresholds.
- Fail-open/fail-closed behavior documented.

## 6. Monitoring

- Real-time: latency, error rate, throughput.
- ML: feature drift, score drift, calibration drift.
- Outcome lag metrics tracked with delay-aware dashboards.

## 7. Feedback loop

- Capture outcomes for retraining.
- Human-in-the-loop corrections where available.
- Retrain cadence + trigger policy (time + drift + quality).

## 8. Post-launch

- Run experiment readout with confidence intervals.
- Decide: rollout, iterate, or rollback.
- Write incident + learning note if mismatch observed.
