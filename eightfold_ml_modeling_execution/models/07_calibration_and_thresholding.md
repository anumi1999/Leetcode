# Deep Dive 07: Calibration and Thresholding

## Why this matters

- Ranking scores are often used for downstream decisions.
- If scores are miscalibrated, thresholds and business policies break.

## Practical calibration

1. Reliability diagrams by segment.
2. ECE/Brier score tracking.
3. Post-hoc calibration (Platt/isotonic) if needed.

## Threshold policy examples

- Trigger recruiter recommendation only when score > T.
- Different T by job family/market if calibrated separately.

## Failure mode

- Same threshold across segments causes uneven quality.
- Mitigation: segment-aware calibration and policy testing.
