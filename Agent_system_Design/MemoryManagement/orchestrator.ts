/**
 * ============================================================
 *  Orchestrator — end-to-end state management
 * ============================================================
 *
 *  Ties every concept in this module together:
 *    1. Append events (05)
 *    2. Derive message log (01) via reducer
 *    3. Enforce context budget (02)
 *    4. Compact when near limit (03)
 *    5. Checkpoint after every state transition (04)
 *    6. Detect + recover orphaned tool calls on resume
 *
 *  No LLM/network dependency — the "assistant" is stubbed. Focus is on
 *  the state-management control flow, not the reasoning.
 *
 *      bun orchestrator.ts
 */

import { EventLog, reduce, initialState, AgentState } from "./05_event_log";
import { approxTokens, tokensOfMessages, Budget, usableBudget } from "./02_context_window";
import { compact, stubSummarizer } from "./03_summarization";
import {
    InMemoryCheckpointStore,
    Checkpoint,
    CHECKPOINT_VERSION,
    findOrphanedToolCalls,
} from "./04_checkpointing";

// ------------------------------------------------------------
// Fake LLM — deterministic 3-turn dialog
// ------------------------------------------------------------

let turn = 0;
async function fakeAssistant(state: AgentState) {
    turn++;
    if (turn === 1) {
        return {
            content: "",
            toolCalls: [{ id: "c1", name: "get_weather", args: { city: "SF" } }],
            finishReason: "tool_calls" as const,
        };
    }
    if (turn === 2) {
        return {
            content: "",
            toolCalls: [{ id: "c2", name: "search_web", args: { query: "SF events" } }],
            finishReason: "tool_calls" as const,
        };
    }
    return {
        content: "It's 19°C in SF and here are the top events this weekend.",
        toolCalls: [],
        finishReason: "stop" as const,
    };
}

async function fakeTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === "get_weather") return JSON.stringify({ tempC: 19, sky: "cloudy" });
    if (name === "search_web") return JSON.stringify([{ title: "Event 1" }, { title: "Event 2" }]);
    return JSON.stringify({});
}

// ------------------------------------------------------------
// Session loop
// ------------------------------------------------------------

const BUDGET: Budget = {
    modelMaxTokens: 4_000,
    reservedForOutput: 500,
    toolSchemaTokens: 200,
};

async function runSession(sessionId: string, userPrompt: string) {
    const store = new InMemoryCheckpointStore();
    const existing = await store.load(sessionId);

    const log = new EventLog();
    if (existing) {
        // Resume: replay events would live here. For the demo we start fresh
        // but demonstrate the orphan-detection API.
        const orphans = findOrphanedToolCalls(existing);
        if (orphans.length) {
            console.log("resuming with orphaned tools:", orphans);
        }
    }

    // Bootstrap the conversation.
    log.append({ type: "UserMessageReceived", content: userPrompt });
    await checkpoint(store, sessionId, log);

    for (let step = 0; step < 6; step++) {
        // 1. Compact if we're pushing the budget.
        await maybeCompact(log);

        // 2. Ask the "LLM" what to do next.
        const state = log.state();
        const reply = await fakeAssistant(state);
        log.append({
            type: "AssistantMessageEmitted",
            content: reply.content,
            toolCalls: reply.toolCalls,
            finishReason: reply.finishReason,
        });
        await checkpoint(store, sessionId, log);

        if (reply.finishReason === "stop") {
            console.log("\nFINAL:", reply.content);
            return;
        }

        // 3. Run tools. Each start/complete is its own event so a crash in
        //    the middle leaves an inspectable half-state.
        for (const tc of reply.toolCalls) {
            log.append({
                type: "ToolCallStarted",
                toolCallId: tc.id,
                name: tc.name,
                args: tc.args,
            });
            await checkpoint(store, sessionId, log);

            const out = await fakeTool(tc.name, tc.args);

            log.append({
                type: "ToolCallCompleted",
                toolCallId: tc.id,
                ok: true,
                output: out,
                // Idempotency key: retrying this exact completion is a no-op.
                idempotencyKey: `complete:${tc.id}`,
            });
            await checkpoint(store, sessionId, log);
        }
    }
    throw new Error("agent exceeded step budget");
}

async function maybeCompact(log: EventLog): Promise<void> {
    const state = log.state();
    const tokens = tokensOfMessages(state.messages, approxTokens);
    if (tokens < usableBudget(BUDGET) * 0.9) return;

    const res = await compact(state.messages, {
        budget: BUDGET,
        keepRecent: 6,
        summarizer: stubSummarizer,
    });
    if (!res.changed) return;

    // Record the compaction as an event so replay reproduces it.
    const foldedIds = state.messages
        .filter((m) => !res.messages.some((r) => r.id === m.id))
        .map((m) => m.id);
    log.append({
        type: "SummaryInserted",
        summaryText: res.messages.find((m) => m.role === "system" && m.id.startsWith("sum_"))?.content ?? "",
        foldedMessageIds: foldedIds,
    });
}

async function checkpoint(
    store: InMemoryCheckpointStore,
    sessionId: string,
    log: EventLog,
): Promise<void> {
    const s = log.state();
    const cp: Checkpoint = {
        version: CHECKPOINT_VERSION,
        savedAt: Date.now(),
        sessionId,
        cursor: s.revision,
        messages: s.messages,
        meta: s.meta,
    };
    // NB: passing expectedCursor would guard against concurrent writers.
    await store.save(cp);
}

// ------------------------------------------------------------
// Run it
// ------------------------------------------------------------

if (require.main === module) {
    runSession("sess_demo", "What's the weather in SF and what's happening this weekend?")
        .catch((e) => {
            console.error("session failed:", e);
            process.exitCode = 1;
        });
}

/**
 * READING GUIDE
 * -------------
 *  Read the files in this order:
 *    01_message_history.ts  — the transcript
 *    02_context_window.ts   — budget + truncation
 *    03_summarization.ts    — lossy compaction
 *    04_checkpointing.ts    — persistence + resume
 *    05_event_log.ts        — event sourcing + concurrency
 *    orchestrator.ts (this) — how they compose
 *
 *  Interview themes to rehearse aloud:
 *    - Why events over checkpoints alone?
 *    - Why is the reducer required to be pure?
 *    - What breaks if summarization splits a tool_call/tool_result pair?
 *    - What breaks if we resume with an orphaned tool_call?
 *    - How do you scale from 1 to 10M sessions?
 */
