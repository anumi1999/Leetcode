# Deep Dive 06: Learning-to-Rank Losses

## Three families

1. Pointwise: predict relevance independently.
2. Pairwise: optimize relative ordering between item pairs.
3. Listwise: optimize full list quality directly.

## Interview framing

- Pointwise is easiest to deploy and debug.
- Pairwise often improves top-of-list ordering.
- Listwise can best align with NDCG but is heavier operationally.

## When to pick what

- Start pointwise if labels/noise are messy.
- Move to pairwise when top-K precision is weak.
- Use listwise when infra and data volume support stable training.

## Evaluation links

- Pairwise/listwise improvements should show up in NDCG@K and MRR.
- Validate by user segment to avoid hidden regressions.

## Failure mode

- Loss improves but business KPI does not.
- Mitigation: audit metric mismatch and objective alignment.
