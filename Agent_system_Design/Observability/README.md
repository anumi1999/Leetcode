# Observability — Deep Dive

If you cannot answer *"what happened during this agent turn?"* in seconds,
you cannot debug prod. Observability is the difference between "the model
went crazy sometimes" and "here's the exact span where it went off the rails."

---

## The three pillars

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  TRACES         one story, causally linked                     │
│                 "this turn: LLM → 3 tool calls → LLM → done"   │
│                 → 01_traces.ts                                 │
│                                                                │
│  METRICS        many stories summed                            │
│                 "p99 tool latency for get_weather = 320ms"     │
│                 → 02_metrics.ts                                │
│                                                                │
│  LOGS           point-in-time facts                            │
│                 "tool_call_id=call_7 rejected: invalid_args"   │
│                 → 03_logs.ts                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

They are complementary, not interchangeable:

- **Traces** answer: *what happened in this one request?*
- **Metrics** answer: *is the fleet healthy?* (SLOs, alerts, dashboards)
- **Logs** answer: *what were the details at this exact moment?*

If any of the three is missing, a real incident will burn hours you don't have.

---

## Correlation — the glue

Every log line and every metric point should carry:

- `trace_id` — the request as a whole
- `span_id` — the specific unit of work
- `run_id` — the agent run (multiple LLM turns)

Without these, you cannot go from a spiky p99 in a dashboard to the trace
that caused it. This module makes correlation a first-class concern.

---

## Mental model

```
HTTP request arrives
   │
   ▼
tracer.startSpan("agent.run") ──────────────┐
   │                                        │
   ├─ span("llm.call")  ── record.tokens ──▶│  parent trace
   │                                        │
   ├─ span("tools.batch")                   │
   │      ├─ span("tool.get_weather")       │
   │      └─ span("tool.search_web")        │
   │                                        │
   └─ span("llm.call")  ── record.finish ──▶│
                                            │
                              tracer.end ───┘
                                       │
                       exporter ──▶ Jaeger / Tempo / Honeycomb
                                       │
              metrics ──▶ Prometheus / DataDog
                                       │
              structured logs ──▶ ElasticSearch / Loki
```

## File map

| # | File                                       | Concept                                       |
|---|--------------------------------------------|-----------------------------------------------|
| 1 | [01_traces.ts](01_traces.ts)               | Span model, parent/child, tracer API          |
| 2 | [02_metrics.ts](02_metrics.ts)             | Counter / gauge / histogram; what to measure  |
| 3 | [03_logs.ts](03_logs.ts)                   | Structured logs, correlation, sampling, redact |
| 4 | [04_context_propagation.ts](04_context_propagation.ts) | `AsyncLocalStorage` — the only correct way in Node |
| 5 | [05_middleware.ts](05_middleware.ts)       | Wire it into the ToolCalling registry         |
| 6 | [orchestrator.ts](orchestrator.ts)         | End-to-end demo emitting all three            |

## How to run

```bash
cd Agent_system_Design/Observability
bun 01_traces.ts
bun 02_metrics.ts
bun 03_logs.ts
bun 04_context_propagation.ts
bun 05_middleware.ts
bun orchestrator.ts
```

---

## Interview-oriented themes

- **The three pillars.** Not just "we have logging". Know what each is *for*.
- **Sampling strategy.** Head sampling (decide at trace start) vs. tail
  sampling (decide after seeing the full trace — expensive but keeps errors).
- **Cardinality discipline.** `tool_name` is a good label; `user_id` is a
  cardinality bomb that will OOM your metrics backend.
- **PII discipline.** Prompts and tool args often contain user data. Redact
  at the boundary; never trust an ad-hoc regex on a string log.
- **Cost.** At 10k QPS with 20 spans/request, you emit 200k spans/sec.
  That's ~$X/day at any SaaS vendor. Sampling is not optional.
- **Correlation.** Log lines without `trace_id` are almost useless during
  incident response.
- **Async correctness.** Trace context that "works" in tests but breaks
  under parallel `await` is a classic bug — it's why `AsyncLocalStorage`
  exists (04).
