/**
 * ============================================================
 *  06 — Agent Control State (Finite State Machine)
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  "Agent state" is overloaded:
 *
 *    (a) MEMORY state — what does the agent KNOW?
 *        messages, summaries, scratchpad, retrieved docs.
 *        Covered in 01–05.
 *
 *    (b) CONTROL state — WHERE is the agent in its workflow?
 *        idle / planning / calling_llm / waiting_for_tools /
 *        applying_results / done / errored / stopped.
 *
 *  This file is (b). If (b) is not modeled explicitly, you end
 *  up with implicit control state hidden in a bunch of booleans
 *  ("isLoading", "hasError", "isRunning"), each of which can be
 *  set independently → 2^N impossible states, and the classic
 *  "spinner spins forever" bug.
 *
 *  Making it an explicit FSM buys you:
 *    - Illegal transitions become COMPILE errors, not prod bugs.
 *    - Every state has a checkpoint shape → crash-safe resume.
 *    - Retry / cancellation / timeout semantics live in ONE table.
 *    - Auditing "how did we get here?" is a linear replay.
 *
 *  KEY DECISIONS
 *  -------------
 *  - We use a TRANSITION TABLE (event → nextState) rather than a
 *    switch on the current state. It's declarative, so it's easy
 *    to inspect, diagram, and diff in code review.
 *  - Every transition is atomic: `{fromState, event} → nextState`.
 *    We never mutate the current state in-place.
 *  - State carries data (a "context") — so this is technically a
 *    STATECHART / xstate-style machine, not a pure Mealy FSM.
 *  - We separate WHAT (transition table) from HOW (effects like
 *    "actually call the LLM"). Effects run OUTSIDE the reducer so
 *    the reducer stays pure → easy to unit-test and replay.
 *
 *  Cross-references:
 *    04_checkpointing.ts uses `AgentControlState` as the durable snapshot.
 *    05_event_log.ts     records every AgentEvent → replay reconstructs state.
 */

// ------------------------------------------------------------
// STATES — a discriminated union. `status` is the discriminator.
// ------------------------------------------------------------

export type AgentControlState =
    | { status: "idle" }
    | { status: "planning";           since: number; attempt: number }
    | { status: "calling_llm";        since: number; attempt: number }
    | { status: "waiting_for_tools";  since: number; pendingToolCallIds: string[] }
    | { status: "applying_results";   since: number; results: number /* count */ }
    | { status: "done";               reason: "stop" | "cancelled" }
    | { status: "errored";            error: { kind: string; message: string }; retriesLeft: number }
    | { status: "stopped";            reason: "user_cancelled" | "deadline_exceeded" | "budget_exceeded" };

/**
 * Extra invariants that live ALONGSIDE the state — think of it
 * as the machine's "context" (xstate) or "extended state" (UML).
 *
 * These fields exist in EVERY state and are updated atomically
 * with each transition.
 */
export interface AgentContext {
    runId: string;
    /** Monotonically-increasing; every transition bumps this. Used for optimistic locking (see 05). */
    revision: number;
    /** Wall-clock deadline. If Date.now() > deadline, we force stop. */
    deadline: number;
    /** Token/cost budget in whatever unit you meter. */
    tokensUsedSoFar: number;
    tokenBudget: number;
    /** How many LLM turns have we done? Cap to avoid infinite loops. */
    turnsUsed: number;
    turnBudget: number;
}

export interface AgentRun {
    context: AgentContext;
    control: AgentControlState;
}

// ------------------------------------------------------------
// EVENTS — every input to the machine. Nothing else changes state.
// ------------------------------------------------------------

export type AgentEvent =
    | { type: "USER_MESSAGE";       at: number }
    | { type: "PLAN_READY";         at: number }
    | { type: "LLM_STARTED";        at: number }
    | { type: "LLM_RETURNED_TEXT";  at: number; tokens: number }
    | { type: "LLM_RETURNED_TOOLS"; at: number; tokens: number; toolCallIds: string[] }
    | { type: "TOOL_RESULT";        at: number; toolCallId: string }
    | { type: "LLM_ERROR";          at: number; error: { kind: string; message: string } }
    | { type: "TOOL_ERROR";         at: number; toolCallId: string; error: { kind: string; message: string } }
    | { type: "CANCEL";             at: number; reason: "user_cancelled" }
    | { type: "TICK";               at: number };   // wall-clock check: deadline / budget

// ------------------------------------------------------------
// TRANSITION TABLE
// ------------------------------------------------------------
// Read as: "in state X, given event Y, go to state Z (and maybe update context)".
// A missing (state, event) pair is an INVALID transition — the reducer throws.
// Encoding illegal transitions as errors is the whole point of an FSM.

type Reducer = (run: AgentRun, ev: AgentEvent) => AgentRun;

const MAX_RETRIES = 2;

function bumpRevision(ctx: AgentContext): AgentContext {
    return { ...ctx, revision: ctx.revision + 1 };
}

/**
 * A universal guard applied BEFORE every state-specific transition.
 * These are the things that can force `stopped` from any state.
 */
function universalGuards(run: AgentRun, ev: AgentEvent): AgentRun | null {
    // 1. Hard cancel — always allowed, always terminal.
    if (ev.type === "CANCEL") {
        return {
            context: bumpRevision(run.context),
            control: { status: "stopped", reason: "user_cancelled" },
        };
    }
    // 2. Deadline exceeded (checked on any TICK or state-changing event).
    if (ev.at > run.context.deadline) {
        return {
            context: bumpRevision(run.context),
            control: { status: "stopped", reason: "deadline_exceeded" },
        };
    }
    // 3. Budget exceeded.
    if (
        run.context.tokensUsedSoFar > run.context.tokenBudget ||
        run.context.turnsUsed       > run.context.turnBudget
    ) {
        return {
            context: bumpRevision(run.context),
            control: { status: "stopped", reason: "budget_exceeded" },
        };
    }
    return null;
}

const reducer: Reducer = (run, ev) => {
    // Universal guards get first pick.
    const forced = universalGuards(run, ev);
    if (forced) return forced;

    // Terminal states swallow everything else.
    if (
        run.control.status === "done" ||
        run.control.status === "stopped"
    ) {
        return run; // no-op; already terminal
    }

    const s = run.control;
    const ctx = run.context;

    switch (s.status) {
        // ── idle ────────────────────────────────────────────────
        case "idle":
            if (ev.type === "USER_MESSAGE") {
                return {
                    context: bumpRevision(ctx),
                    control: { status: "planning", since: ev.at, attempt: 0 },
                };
            }
            break;

        // ── planning ────────────────────────────────────────────
        case "planning":
            if (ev.type === "PLAN_READY") {
                return {
                    context: bumpRevision(ctx),
                    control: { status: "calling_llm", since: ev.at, attempt: 0 },
                };
            }
            break;

        // ── calling_llm ─────────────────────────────────────────
        case "calling_llm": {
            if (ev.type === "LLM_STARTED") return run;   // no-op observer event

            if (ev.type === "LLM_RETURNED_TEXT") {
                return {
                    context: bumpRevision({
                        ...ctx,
                        tokensUsedSoFar: ctx.tokensUsedSoFar + ev.tokens,
                        turnsUsed: ctx.turnsUsed + 1,
                    }),
                    control: { status: "done", reason: "stop" },
                };
            }
            if (ev.type === "LLM_RETURNED_TOOLS") {
                if (ev.toolCallIds.length === 0) {
                    // Contract violation: LLM said "tool_calls" but sent none.
                    return {
                        context: bumpRevision(ctx),
                        control: {
                            status: "errored",
                            error: { kind: "llm_contract", message: "empty tool_calls" },
                            retriesLeft: 0,
                        },
                    };
                }
                return {
                    context: bumpRevision({
                        ...ctx,
                        tokensUsedSoFar: ctx.tokensUsedSoFar + ev.tokens,
                        turnsUsed: ctx.turnsUsed + 1,
                    }),
                    control: {
                        status: "waiting_for_tools",
                        since: ev.at,
                        pendingToolCallIds: [...ev.toolCallIds],
                    },
                };
            }
            if (ev.type === "LLM_ERROR") {
                return {
                    context: bumpRevision(ctx),
                    control: {
                        status: "errored",
                        error: ev.error,
                        retriesLeft: MAX_RETRIES - s.attempt,
                    },
                };
            }
            break;
        }

        // ── waiting_for_tools ───────────────────────────────────
        case "waiting_for_tools": {
            if (ev.type === "TOOL_RESULT" || ev.type === "TOOL_ERROR") {
                const remaining = s.pendingToolCallIds.filter((id) => id !== ev.toolCallId);
                if (remaining.length > 0) {
                    // Still waiting on siblings; stay in same status but with fewer pending ids.
                    return {
                        context: bumpRevision(ctx),
                        control: { ...s, pendingToolCallIds: remaining },
                    };
                }
                // All results in → advance.
                return {
                    context: bumpRevision(ctx),
                    control: { status: "applying_results", since: ev.at, results: s.pendingToolCallIds.length },
                };
            }
            break;
        }

        // ── applying_results ────────────────────────────────────
        case "applying_results":
            if (ev.type === "LLM_STARTED" || ev.type === "USER_MESSAGE") {
                // After results are folded into history, go back for another LLM turn.
                return {
                    context: bumpRevision(ctx),
                    control: { status: "calling_llm", since: ev.at, attempt: 0 },
                };
            }
            break;

        // ── errored ────────────────────────────────────────────
        case "errored":
            if (ev.type === "LLM_STARTED" && s.retriesLeft > 0) {
                return {
                    context: bumpRevision(ctx),
                    control: {
                        status: "calling_llm",
                        since: ev.at,
                        attempt: MAX_RETRIES - s.retriesLeft + 1,
                    },
                };
            }
            if (ev.type === "TICK" && s.retriesLeft <= 0) {
                return {
                    context: bumpRevision(ctx),
                    control: { status: "stopped", reason: "budget_exceeded" }, // retries exhausted
                };
            }
            break;
    }

    // Reject unknown transitions loudly. In prod you'd log + return `run`.
    throw new IllegalTransitionError(s.status, ev.type);
};

export class IllegalTransitionError extends Error {
    constructor(public state: string, public event: string) {
        super(`illegal transition: state="${state}", event="${event}"`);
        this.name = "IllegalTransitionError";
    }
}

// ------------------------------------------------------------
// PUBLIC API
// ------------------------------------------------------------

export function initialRun(runId: string, opts: {
    deadline: number;
    tokenBudget: number;
    turnBudget: number;
}): AgentRun {
    return {
        context: {
            runId,
            revision: 0,
            deadline: opts.deadline,
            tokensUsedSoFar: 0,
            tokenBudget: opts.tokenBudget,
            turnsUsed: 0,
            turnBudget: opts.turnBudget,
        },
        control: { status: "idle" },
    };
}

/** Apply a single event and return the new run. Pure. */
export function transition(run: AgentRun, ev: AgentEvent): AgentRun {
    return reducer(run, ev);
}

/**
 * REPLAY — rebuild a run by folding events. This is the crash-recovery
 * primitive: your event log is source of truth, state is derived.
 */
export function replay(initial: AgentRun, events: AgentEvent[]): AgentRun {
    return events.reduce(transition, initial);
}

/** True if the run has hit a terminal status. */
export function isTerminal(run: AgentRun): boolean {
    return run.control.status === "done" || run.control.status === "stopped";
}

// ------------------------------------------------------------
// Demo — trace a happy path AND a cancellation path AND a replay.
// ------------------------------------------------------------

if (require.main === module) {
    const now = Date.now();
    const init = initialRun("run_1", {
        deadline: now + 30_000,
        tokenBudget: 10_000,
        turnBudget: 10,
    });

    // Happy path: user → plan → llm(tools) → tool_result → llm(text) → done
    const happyEvents: AgentEvent[] = [
        { type: "USER_MESSAGE",       at: now },
        { type: "PLAN_READY",         at: now + 5 },
        { type: "LLM_STARTED",        at: now + 10 },
        { type: "LLM_RETURNED_TOOLS", at: now + 200, tokens: 120, toolCallIds: ["c1", "c2"] },
        { type: "TOOL_RESULT",        at: now + 250, toolCallId: "c1" },
        { type: "TOOL_RESULT",        at: now + 260, toolCallId: "c2" },
        { type: "LLM_STARTED",        at: now + 270 },
        { type: "LLM_RETURNED_TEXT",  at: now + 400, tokens: 80 },
    ];

    let run = init;
    for (const ev of happyEvents) {
        run = transition(run, ev);
        console.log(ev.type.padEnd(22), "→", run.control.status, "rev=", run.context.revision);
    }
    console.log("terminal?", isTerminal(run), "\n");

    // Cancel path: mid-tool-wait the user hits stop.
    let cancelRun = init;
    cancelRun = transition(cancelRun, { type: "USER_MESSAGE", at: now });
    cancelRun = transition(cancelRun, { type: "PLAN_READY",   at: now + 1 });
    cancelRun = transition(cancelRun, {
        type: "LLM_RETURNED_TOOLS", at: now + 2, tokens: 50, toolCallIds: ["c1"],
    });
    cancelRun = transition(cancelRun, { type: "CANCEL", at: now + 3, reason: "user_cancelled" });
    console.log("cancel final:", cancelRun.control);

    // Replay: exact same events → exact same final state.
    const replayed = replay(init, happyEvents);
    console.log("replay matches?", JSON.stringify(replayed) === JSON.stringify(run));

    // Illegal transition example (uncomment to see the throw):
    // transition(init, { type: "TOOL_RESULT", at: now, toolCallId: "c1" });
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why an explicit FSM instead of a few booleans?
 *     A: N booleans = 2^N reachable states. Most are "impossible" —
 *        `isLoading=true, hasError=true, isDone=true`. An explicit
 *        discriminated union enumerates ONLY the legal states, and
 *        the type system + reducer refuse the rest. Bugs move from
 *        runtime to compile time.
 *
 *  Q: Where does this state live at runtime?
 *     A: In-memory during a turn, persisted between turns.
 *        Every transition = one row in an append-only event log
 *        (see 05_event_log.ts). Reconstruction = fold(reducer, events).
 *        This gives you crash-safety for free: on process restart,
 *        load the events and rebuild.
 *
 *  Q: What about parallel tool calls — does the FSM handle races?
 *     A: Yes: `waiting_for_tools.pendingToolCallIds` shrinks by id
 *        as results arrive. We only advance when it's empty. The
 *        reducer is single-threaded per run (see optimistic locking
 *        via `context.revision`), so no lost updates.
 *
 *  Q: Crash between LLM_RETURNED_TOOLS and TOOL_RESULT — what recovers?
 *     A: On restart, replay events → land in `waiting_for_tools`
 *        with the pending ids still populated. Two policies:
 *        (a) Re-issue the tool calls (safe iff idempotent).
 *        (b) Ask the model to re-plan given the missing results.
 *        The FSM makes this decision explicit, not implicit.
 *
 *  Q: Why is `revision` on `context` and not per-state?
 *     A: `revision` is optimistic-lock version, not domain state.
 *        Every transition bumps it exactly once. Storage layer
 *        rejects writes where `revision != expected`. This is how
 *        two concurrent writers (e.g. tool result + user cancel)
 *        race-safely without a DB lock.
 *
 *  Q: How do you enforce a global deadline?
 *     A: Universal guard on every event (see `universalGuards`).
 *        Any event past `deadline` forces `stopped`. Same for
 *        token/turn budgets. Centralizing this means you can't
 *        forget to check it in one state.
 *
 *  Q: Effects (calling the LLM, invoking tools) — where do they go?
 *     A: OUTSIDE the reducer. The reducer is pure: (state, event) →
 *        state. An "effects runner" watches for state entry
 *        (`onEnter(calling_llm) → invoke LLM → dispatch LLM_RETURNED_*`).
 *        This lets you replay events without re-running side effects,
 *        which is essential for debugging prod incidents.
 *
 *  Q: Statecharts (xstate) vs. hand-rolled reducer?
 *     A: For a small agent, a switch is fine and diff-friendly.
 *        For nested workflows (sub-agents, parallel branches,
 *        history states, invoke/spawn), xstate pays for itself.
 *        Interview-safe answer: "start with a discriminated union
 *        + reducer; adopt xstate when you have >~15 states or need
 *        hierarchical composition."
 */
