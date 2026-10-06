# Eightfold ML Modeling + Execution Prep

Focus: model choice, offline/online evaluation, productionization, and execution trade-offs.

## Folder map

- `cases/`
  - End-to-end ML case studies with constraints and expected interview structure.
- `models/`
  - Modeling patterns: retrieval/ranking/classification/recommendation/time-series.
- `execution/`
  - MLOps execution checklists: data contracts, training loops, deployment, monitoring.
- `mock_interviews/`
  - Timed prompts + scoring rubrics for self-practice.

## Study flow (recommended)

1. Start with `cases/01_job_matching_system.md`
2. Then `models/01_ranking_pipeline.md`
3. Then `execution/01_ml_execution_checklist.md`
4. Finally do a timed run from `mock_interviews/01_eightfold_prompt.md`

## Interview lens (Eightfold-style)

- Product goal clarity before model choice.
- Strong framing of objective function and constraints.
- Data and labeling strategy under real-world noise.
- Offline metrics and why they correlate (or do not) with online impact.
- System design for low-latency inference and safe rollout.
- Monitoring and feedback loop after deployment.

