# Deep Dive 08: Cold Start and Exploration

## Cold start types

1. New candidate with sparse profile.
2. New job with sparse interaction history.
3. New recruiter behavior pattern.

## Mitigation patterns

- Content-based priors from skills/title taxonomy.
- Popularity and recency priors as fallback.
- Exploration bandit layer for controlled discovery.

## Interview-friendly policy

- Exploit high-confidence matches.
- Reserve small traffic slice for exploration.
- Track regret and safety guardrails.

## Failure mode

- Feedback loops suppress novel candidates.
- Mitigation: diversity constraints + exploration budget.
