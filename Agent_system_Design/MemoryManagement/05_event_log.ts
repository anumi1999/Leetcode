/**
 * ============================================================
 *  05 — Event Log (event sourcing + optimistic concurrency)
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  With just checkpoints (04), your only recovery is "load last save."
 *  For debugging, replay, audit, and multi-writer safety you want:
 *
 *      state = reduce(events)
 *
 *  Every mutation is an EVENT appended to an immutable log. State is
 *  a fold over that log. Benefits:
 *
 *    - Perfect audit trail. Every change has an event with who/when/why.
 *    - Deterministic replay. Reprocess events → identical state.
 *    - Time travel. Reduce up to event N to see state at that moment.
 *    - Concurrency. Two writers append events; a monotonic revision
 *      catches conflicts.
 *
 *  This is what LangGraph, Temporal, and every serious workflow engine
 *  do under the hood. It's also standard system-design interview fare.
 *
 *  DESIGN
 *  ------
 *  Events are a tagged union. A pure `reduce` builds `AgentState` from
 *  them. The `EventLog` class enforces monotonicity and gives us an
 *  append primitive with optimistic concurrency.
 */

import type { Message, ToolCall } from "./01_message_history";
import { newId } from "./01_message_history";

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------

interface EventBase {
    id: string;
    /** Monotonic; assigned by the log at append time. */
    revision: number;
    at: number; // epoch ms
    /** Idempotency key. Repeated appends with the same key are no-ops. */
    idempotencyKey?: string;
}

export type Event =
    | ({ type: "UserMessageReceived"; content: string } & EventBase)
    | ({ type: "AssistantMessageEmitted"; content: string; toolCalls: ToolCall[];
        finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "unknown";
      } & EventBase)
    | ({ type: "ToolCallStarted"; toolCallId: string; name: string;
         args: Record<string, unknown>;
      } & EventBase)
    | ({ type: "ToolCallCompleted"; toolCallId: string; ok: boolean;
         output: string; error?: string;
      } & EventBase)
    | ({ type: "SummaryInserted"; summaryText: string; foldedMessageIds: string[] } & EventBase)
    | ({ type: "MetaUpdated"; patch: Record<string, unknown> } & EventBase);

// ------------------------------------------------------------
// State + reducer
// ------------------------------------------------------------

export interface AgentState {
    revision: number;
    messages: Message[];
    /** tool_call_id → { started, completed? } — for orphan detection. */
    toolCalls: Record<string, { started: boolean; completed: boolean }>;
    meta: Record<string, unknown>;
}

export const initialState: AgentState = {
    revision: 0,
    messages: [],
    toolCalls: {},
    meta: {},
};

/**
 * Pure reducer. Given (state, event) return newState.
 * NEVER mutates the input state — always return a new object.
 * NEVER performs IO — replay must be free of side effects.
 */
export function reduce(state: AgentState, ev: Event): AgentState {
    switch (ev.type) {
        case "UserMessageReceived":
            return {
                ...state,
                revision: ev.revision,
                messages: [...state.messages, {
                    id: ev.id, role: "user", createdAt: ev.at, content: ev.content,
                }],
            };

        case "AssistantMessageEmitted":
            return {
                ...state,
                revision: ev.revision,
                messages: [...state.messages, {
                    id: ev.id, role: "assistant", createdAt: ev.at,
                    content: ev.content, toolCalls: ev.toolCalls,
                    finishReason: ev.finishReason,
                }],
                toolCalls: {
                    ...state.toolCalls,
                    ...Object.fromEntries(
                        ev.toolCalls.map((tc) => [tc.id, { started: false, completed: false }]),
                    ),
                },
            };

        case "ToolCallStarted":
            return {
                ...state,
                revision: ev.revision,
                toolCalls: {
                    ...state.toolCalls,
                    [ev.toolCallId]: {
                        started: true,
                        completed: state.toolCalls[ev.toolCallId]?.completed ?? false,
                    },
                },
            };

        case "ToolCallCompleted":
            return {
                ...state,
                revision: ev.revision,
                messages: [...state.messages, {
                    id: ev.id, role: "tool", createdAt: ev.at,
                    toolCallId: ev.toolCallId, name: lookupToolName(state, ev.toolCallId),
                    content: ev.output, ok: ev.ok,
                }],
                toolCalls: {
                    ...state.toolCalls,
                    [ev.toolCallId]: { started: true, completed: true },
                },
            };

        case "SummaryInserted": {
            const folded = new Set(ev.foldedMessageIds);
            const kept = state.messages.filter((m) => !folded.has(m.id));
            const summary: Message = {
                id: ev.id, role: "system", createdAt: ev.at, content: ev.summaryText,
            };
            return { ...state, revision: ev.revision, messages: [summary, ...kept] };
        }

        case "MetaUpdated":
            return {
                ...state,
                revision: ev.revision,
                meta: { ...state.meta, ...ev.patch },
            };
    }
}

function lookupToolName(state: AgentState, toolCallId: string): string {
    for (let i = state.messages.length - 1; i >= 0; i--) {
        const m = state.messages[i];
        if (m.role === "assistant") {
            const tc = m.toolCalls.find((t) => t.id === toolCallId);
            if (tc) return tc.name;
        }
    }
    return "unknown";
}

// ------------------------------------------------------------
// EventLog — append with optimistic concurrency
// ------------------------------------------------------------

export class ConcurrencyError extends Error {
    name = "ConcurrencyError";
}

export class EventLog {
    private events: Event[] = [];
    private idempotencyIndex = new Map<string, number>(); // key → revision

    revision(): number {
        return this.events.length;
    }

    /**
     * Append an event.
     * @param partial event without `revision` / `id` / `at` — we assign them.
     * @param expectedRevision if set, must equal the current revision. This
     *   is optimistic concurrency: two writers that both read rev=5 will
     *   race; one wins and moves to 6, the other throws ConcurrencyError.
     */
    append(
        partial: Omit<Event, "revision" | "id" | "at">,
        expectedRevision?: number,
    ): Event {
        if (expectedRevision !== undefined && expectedRevision !== this.revision()) {
            throw new ConcurrencyError(
                `expected revision ${expectedRevision}, current ${this.revision()}`,
            );
        }

        if (partial.idempotencyKey) {
            const prev = this.idempotencyIndex.get(partial.idempotencyKey);
            if (prev !== undefined) {
                // Return the previously written event; caller sees "same
                // logical write" without duplicating state.
                return this.events[prev - 1]; // revision is 1-based
            }
        }

        const ev = {
            ...partial,
            revision: this.revision() + 1,
            id: newId("ev"),
            at: Date.now(),
        } as Event;
        this.events.push(ev);
        if (ev.idempotencyKey) this.idempotencyIndex.set(ev.idempotencyKey, ev.revision);
        return ev;
    }

    /** Full replay — build state from scratch. */
    state(): AgentState {
        return this.events.reduce(reduce, initialState);
    }

    /** State at a specific revision — time travel. */
    stateAt(rev: number): AgentState {
        return this.events.slice(0, rev).reduce(reduce, initialState);
    }

    snapshot(): readonly Event[] {
        return this.events.slice();
    }
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const log = new EventLog();

    log.append({ type: "UserMessageReceived", content: "Weather in SF?" });
    log.append({
        type: "AssistantMessageEmitted",
        content: "",
        toolCalls: [{ id: "c1", name: "get_weather", args: { city: "SF" } }],
        finishReason: "tool_calls",
    });
    log.append({ type: "ToolCallStarted", toolCallId: "c1", name: "get_weather", args: { city: "SF" } });

    // Idempotent completion — try to append the same result twice.
    log.append({
        type: "ToolCallCompleted",
        toolCallId: "c1",
        ok: true,
        output: JSON.stringify({ tempC: 19 }),
        idempotencyKey: "complete:c1",
    });
    log.append({
        type: "ToolCallCompleted",
        toolCallId: "c1",
        ok: true,
        output: JSON.stringify({ tempC: 19 }),
        idempotencyKey: "complete:c1", // dedupe — no new event
    });

    console.log("events:", log.revision());        // 4, not 5
    console.log("state:", log.state().messages.length, "messages");
    console.log("time travel @rev=2:", log.stateAt(2).messages.map((m) => m.role));

    // Concurrency guard
    try {
        log.append({ type: "MetaUpdated", patch: { step: 1 } }, /* expectedRevision */ 99);
    } catch (e) {
        console.log("stale writer rejected:", (e as Error).message);
    }
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why an event log if I already have checkpoints?
 *     A: Checkpoints are DESTINATIONS; events are the JOURNEY. With just
 *        checkpoints you lose "who changed what, when, why." Debugging
 *        prod incidents becomes bisect-by-snapshot. Events give you a
 *        full audit trail and replayability for free.
 *
 *  Q: Storage — events grow forever?
 *     A: Yes. Standard pattern: periodic SNAPSHOT (=checkpoint) at rev N.
 *        Prune events before N to cold storage. On load: apply snapshot
 *        + replay events since N. Best of both worlds.
 *
 *  Q: Two workers race. Both read rev=5, both try to write rev=6.
 *     A: The first `append({...}, 5)` succeeds and log is now rev=6.
 *        The second `append({...}, 5)` throws ConcurrencyError. Worker
 *        retries: reads rev=6, re-applies its intent as if it saw the
 *        winner's event, appends as rev=7. If the intent is idempotent,
 *        use `idempotencyKey` and skip the retry loop.
 *
 *  Q: What if the reducer changes shape? Old events must still reduce.
 *     A: Reducers are code; events are data. Never change past events.
 *        If a new field is required, add a new event type or introduce
 *        a "V2" variant. The reducer must handle both. This is exactly
 *        what schema migrations look like in event-sourced systems.
 *
 *  Q: What's the failure mode I should NOT ignore?
 *     A: Non-deterministic reducers. If your reducer calls Date.now(),
 *        Math.random(), or reads external state, replay produces
 *        different results than the original run. Reducer MUST be a
 *        pure function of (state, event). Any nondeterminism belongs
 *        in the event's fields (e.g. record the `at` timestamp when the
 *        event is created, not when it's replayed).
 */
