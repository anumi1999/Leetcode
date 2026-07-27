# Tool Calling Mechanics — Deep Dive

This module is a study track for the low-level plumbing that makes an LLM
agent capable of calling tools. Each concept below has its own file with:

1. A problem statement (why do we need this?)
2. A minimal design + runnable TypeScript
3. Trade-offs, edge cases, and interview follow-ups

---

## Mental Model

Every agent loop looks roughly like this:

```
user prompt
   │
   ▼
┌────────────────────────┐
│  LLM (chat completion) │  ← we send tool schemas here
└──────────┬─────────────┘
           │  assistant message
           │  {content?, tool_calls?[]}
           ▼
   ┌─────────────────┐
   │  Parse response │  ← 02_parsing.ts, 03_malformed_json.ts
   └────────┬────────┘
            │  ToolCall[]
            ▼
   ┌───────────────────────┐
   │  Tool Registry lookup │  ← 06_registry.ts
   └────────┬──────────────┘
            │  Handler[]
            ▼
   ┌────────────────────────────────┐
   │  Execute in parallel + timeout │  ← 04_parallel_execution.ts,
   └────────┬───────────────────────┘     05_timeout.ts
            │  ToolResult[]
            ▼
   Feed results back to LLM → loop until it emits `stop`
```

## File Map

| # | File                                                        | Concept                                     |
|---|-------------------------------------------------------------|---------------------------------------------|
| 1 | [01_schema.ts](01_schema.ts)                                | Tool definition schema (JSON Schema)        |
| 2 | [02_parsing.ts](02_parsing.ts)                              | Parsing LLM tool call responses             |
| 3 | [03_malformed_json.ts](03_malformed_json.ts)                | Recovering from bad JSON                    |
| 4 | [04_parallel_execution.ts](04_parallel_execution.ts)        | `Promise.allSettled` fan-out                |
| 5 | [05_timeout.ts](05_timeout.ts)                              | `AbortController` + timeout                 |
| 6 | [06_registry.ts](06_registry.ts)                            | Tool registry pattern                       |
| 7 | [orchestrator.ts](orchestrator.ts)                          | End-to-end agent loop pulling it together   |

## How to run

```bash
# from the repo root
npx tsx Agent_system_Design/ToolCalling/orchestrator.ts
```

No external dependencies — everything uses Node built-ins so it stays focused
on the mechanics.

---

## Interview-oriented themes

- **Determinism vs. flexibility**: strict schemas reduce hallucination but
  hurt UX for open-ended tools. Know when to relax.
- **Failure isolation**: one bad tool shouldn't crash the loop. `allSettled`
  + per-tool timeouts is the standard pattern.
- **Cancellation propagation**: an aborted user request must cancel *all*
  in-flight tools. One `AbortController` at the request scope, children
  linked via `signal`.
- **Backpressure**: what if the model asks for 50 tools at once? Registry
  can enforce concurrency limits, per-tool rate limits, and cost caps.
- **Idempotency**: retries after timeout can double-charge. Tool handlers
  should be idempotent (or the registry needs an idempotency key).
- **Observability**: log every tool call with `{name, args_hash, latency,
  outcome}`. This is how you debug prod agents.
