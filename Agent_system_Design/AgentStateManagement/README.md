# Agent State Management — Deep Dive

The runtime state of an agent turn is one of the highest-signal interview
topics. Get it wrong and you get: context poisoning, unbounded token
growth, duplicate tool executions, and unresumable workflows.

---

## Layers of state

```
┌────────────────────────────────────────────────────────────┐
│  Long-term memory   (durable, cross-session, vector store) │  ← see MemoryManagement/
├────────────────────────────────────────────────────────────┤
│  Session state      (this conversation, persisted, days)   │
├────────────────────────────────────────────────────────────┤
│  Turn state         (this LLM turn, in-flight tool calls)  │
├────────────────────────────────────────────────────────────┤
│  Request state      (one HTTP call to the model, ms)       │
└────────────────────────────────────────────────────────────┘
```

This module focuses on **session + turn** state — the transient log of
messages, tool calls, and plan progress. Long-term memory (vector recall,
user profile) is a different problem covered in the sibling folder.

---

## Mental model of one agent step

```
UserMessage arrives
   │
   ▼
Append to MessageLog        ← 01_message_history.ts
   │
   ▼
Trim to fit context window  ← 02_context_window.ts
   │           │
   │           └─▶ if oversized, compact via rolling summary
   │                        ← 03_summarization.ts
   ▼
Call LLM
   │
   ▼
Assistant emits tool_calls[]  → append events to log
   │                                 ← 05_event_log.ts
   ▼
Execute tools (see ToolCalling/)
   │
   ▼
Append tool_result events + bump revision
   │
   ▼
Checkpoint after every state transition ← 04_checkpointing.ts
   │
   ▼
Loop until finish_reason === "stop"
```

## File map

| # | File                                                     | Concept                                          |
|---|----------------------------------------------------------|--------------------------------------------------|
| 1 | [01_message_history.ts](01_message_history.ts)           | Append-only transcript + tool call linkage       |
| 2 | [02_context_window.ts](02_context_window.ts)             | Token budget + truncation strategies             |
| 3 | [03_summarization.ts](03_summarization.ts)               | Rolling summary compaction                       |
| 4 | [04_checkpointing.ts](04_checkpointing.ts)               | Serialize / resume / schema versioning           |
| 5 | [05_event_log.ts](05_event_log.ts)                       | Event sourcing + optimistic concurrency          |
| 6 | [orchestrator.ts](orchestrator.ts)                       | End-to-end loop                                  |

---

## Interview-oriented themes

- **Determinism of replay.** If you can rebuild state from an event log,
  you can debug prod incidents by replaying. If you can't, you're stuck.
- **Idempotency of writes.** A retried tool call must not double-append.
  Use `tool_call_id` as the idempotency key.
- **Ordering guarantees.** Tool results MUST reference their originating
  tool call by id. OpenAI/Anthropic 400 otherwise.
- **Context poisoning.** Garbage-in-context is the #1 source of "the model
  went crazy after 20 turns." Truncation policy matters.
- **Blast radius.** A crash mid-tool-execution leaves the state in a
  "tool called, no result" gap. Design for that gap explicitly.
- **Versioning.** State schema evolves. Old sessions must migrate forward
  or be marked incompatible — never silently misread.
- **Concurrency.** If two parallel tool results race to update the log,
  which wins? Revision numbers + optimistic locking, or a single writer.
- **Storage cost.** Full transcripts of 1M sessions × 10k tokens each is
  a real bill. Rolling summaries + cold-storage for archived turns.

## How to run

```bash
cd Agent_system_Design/AgentStateManagement
bun 01_message_history.ts
bun 02_context_window.ts
bun 03_summarization.ts
bun 04_checkpointing.ts
bun 05_event_log.ts
bun orchestrator.ts
```

Each file's demo (`if (require.main === module)`) is standalone.
Interview follow-ups live at the bottom of each file.
