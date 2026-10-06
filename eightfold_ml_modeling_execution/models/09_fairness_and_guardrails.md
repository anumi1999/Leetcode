# Deep Dive 09: Fairness and Guardrails in Talent Matching

## Why interviewer asks this

Talent systems directly affect opportunity distribution.

## What to cover

1. Pre-training checks: representation and label bias.
2. In-training controls: reweighting/constraint options.
3. Post-training evaluation: subgroup metrics and parity gaps.
4. Serving guardrails: monotonic constraints and policy filters.

## Concrete metrics

- Exposure parity by protected/sensitive groups (where legally allowed).
- Outcome parity for key stages (outreach acceptance/interview conversion).
- Error parity (false negative gap).

## Risk examples

- Historical bias encoded in labels.
- Proxy features leaking sensitive attributes.
- Geographic skew from recruiter behavior.

## Mitigation

- Feature audits and removal/regularization of proxy-heavy features.
- Counterfactual or slice stress testing.
- Human review for high-impact decision points.
