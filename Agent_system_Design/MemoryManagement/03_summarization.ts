/**
 * ============================================================
 *  03 — Rolling Summary Compaction
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Drop-oldest (02) loses information. For long-running agents (coding
 *  sessions, research tasks) that loss is fatal — the model forgets
 *  what the user asked for 30 turns ago.
 *
 *  Rolling summary: periodically summarize the OLD portion of the
 *  transcript into one synthetic system message, then discard the
 *  originals. The model sees:
 *
 *      [pinned system prompt]
 *      [SUMMARY of turns 1..N-K]      ← synthetic, updated over time
 *      [turns N-K+1 .. N]             ← verbatim recent
 *
 *  WHY IT'S HARD
 *  -------------
 *  1. Summaries are LOSSY. Numbers, IDs, names get dropped. If the
 *     agent needs an exact string from turn 5, you can't summarize it out.
 *     Fix: extract "facts" (structured key/value) alongside the prose.
 *  2. Summaries drift. Each new summary is a summary-of-a-summary-of-…
 *     Model degradation compounds. Fix: cap generations; occasionally
 *     rebuild from raw archive if you keep one.
 *  3. Tool calls straddle the boundary. If turn 10 was a tool_call and
 *     turn 11 was its result, they must be summarized together or the
 *     summary makes no sense.
 *  4. Cost. Each summary is an extra LLM call. Trigger conservatively.
 *
 *  DESIGN
 *  ------
 *  A `Summarizer` interface accepts a chunk of messages and returns a
 *  string summary. In tests we use a deterministic stub; in prod you
 *  inject a real LLM call.
 */

import type { Message } from "./01_message_history";
import { newId } from "./01_message_history";
import {
    approxTokens,
    tokensOfMessages,
    TokenCounter,
    Budget,
    usableBudget,
} from "./02_context_window";

// ------------------------------------------------------------
// Summarizer contract
// ------------------------------------------------------------

export interface Summarizer {
    /**
     * Turn a slab of messages into ONE synthetic system message.
     * MUST be deterministic given the input (for replay). Cache aggressively.
     */
    summarize(messages: readonly Message[], signal?: AbortSignal): Promise<string>;
}

/** Trivial stub used in tests. Real impl calls the LLM. */
export const stubSummarizer: Summarizer = {
    async summarize(messages) {
        const bullets = messages.map((m) => {
            switch (m.role) {
                case "user":      return `- user asked: ${truncate(m.content, 80)}`;
                case "assistant": return `- assistant replied: ${truncate(m.content, 80)}`;
                case "tool":      return `- tool ${m.name} → ${m.ok ? "ok" : "err"}`;
                case "system":    return `- system: ${truncate(m.content, 80)}`;
            }
        });
        return `SUMMARY of ${messages.length} earlier messages:\n${bullets.join("\n")}`;
    },
};

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// ------------------------------------------------------------
// Boundary-safe chunking
// ------------------------------------------------------------
// We must NOT split an assistant message from its tool results, or a
// user message that immediately precedes a still-relevant reply.
// Rule: chunk endpoints must be at a "safe boundary".
//
// A safe boundary is BETWEEN messages msg[i-1] and msg[i] such that:
//   - msg[i-1] is not an assistant with tool_calls whose results appear later
//   - msg[i] is not a tool message (it would orphan without its assistant)

function isSafeBoundary(prev: Message | undefined, next: Message | undefined): boolean {
    if (!prev || !next) return true;
    if (prev.role === "assistant" && prev.toolCalls.length > 0) return false;
    if (next.role === "tool") return false;
    return true;
}

/** Find the largest prefix [0..i) of `msgs` such that i is a safe boundary. */
function largestSafePrefix(msgs: readonly Message[], maxLen: number): number {
    let i = Math.min(maxLen, msgs.length);
    while (i > 0 && !isSafeBoundary(msgs[i - 1], msgs[i])) i--;
    return i;
}

// ------------------------------------------------------------
// The compactor
// ------------------------------------------------------------

export interface CompactOptions {
    budget: Budget;
    count?: TokenCounter;
    /** Number of recent messages to preserve verbatim. Default 8. */
    keepRecent?: number;
    /** Only trigger if we exceed this fraction of usableBudget. Default 0.9. */
    triggerFraction?: number;
    /** Injected summarizer — swap for a real LLM in prod. */
    summarizer?: Summarizer;
    signal?: AbortSignal;
}

export interface CompactResult {
    messages: Message[];
    /** How many raw messages got folded into the summary this pass. */
    compactedCount: number;
    /** True iff a compaction actually happened. */
    changed: boolean;
}

export async function compact(
    msgs: readonly Message[],
    opts: CompactOptions,
): Promise<CompactResult> {
    const {
        budget,
        count = approxTokens,
        keepRecent = 8,
        triggerFraction = 0.9,
        summarizer = stubSummarizer,
        signal,
    } = opts;

    const limit = usableBudget(budget);
    const currentTokens = tokensOfMessages(msgs, count);
    if (currentTokens <= limit * triggerFraction) {
        return { messages: msgs.slice(), compactedCount: 0, changed: false };
    }

    // Identify pinned system prefix (never compacted) and the recent tail.
    const systemPrefix: Message[] = [];
    let i = 0;
    while (i < msgs.length && msgs[i].role === "system") systemPrefix.push(msgs[i++]);

    const recentStart = Math.max(i, msgs.length - keepRecent);
    const tail = msgs.slice(recentStart);
    const middle = msgs.slice(i, recentStart);

    if (middle.length === 0) {
        // Nothing to compact — recent tail alone exceeds budget. Caller
        // must either raise budget or drop-oldest inside the tail.
        return { messages: msgs.slice(), compactedCount: 0, changed: false };
    }

    // Snap the compaction range to a safe boundary so we don't orphan tools.
    const safeLen = largestSafePrefix(middle, middle.length);
    if (safeLen === 0) {
        return { messages: msgs.slice(), compactedCount: 0, changed: false };
    }
    const toCompact = middle.slice(0, safeLen);
    const leftovers = middle.slice(safeLen);

    const summaryText = await summarizer.summarize(toCompact, signal);
    const summaryMsg: Message = {
        id: newId("sum"),
        role: "system",
        createdAt: Date.now(),
        content: summaryText,
    };

    return {
        messages: [...systemPrefix, summaryMsg, ...leftovers, ...tail],
        compactedCount: toCompact.length,
        changed: true,
    };
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const now = Date.now();
    const filler = (i: number): Message => ({
        id: newId(),
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        createdAt: now + i,
        content: `Long message ${i} `.repeat(100),
        ...(i % 2 === 1 ? { toolCalls: [], finishReason: "stop" as const } : {}),
    }) as Message;

    const msgs: Message[] = [
        { id: newId(), role: "system", createdAt: now, content: "System prompt." },
        ...Array.from({ length: 30 }, (_, i) => filler(i)),
    ];

    const budget: Budget = {
        modelMaxTokens: 3_000,
        reservedForOutput: 300,
        toolSchemaTokens: 100,
    };

    (async () => {
        const before = tokensOfMessages(msgs, approxTokens);
        const res = await compact(msgs, { budget });
        const after = tokensOfMessages(res.messages, approxTokens);
        console.log(`before: ${msgs.length} msgs, ${before} tokens`);
        console.log(`compacted: ${res.compactedCount}`);
        console.log(`after:  ${res.messages.length} msgs, ${after} tokens`);
        console.log("summary head:", res.messages[1].content.slice(0, 200));
    })();
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: When would you NOT summarize?
 *     A: When exactness matters — legal, medical, financial exchanges;
 *        code editing sessions where the LLM must refer to prior diffs
 *        by exact hash; anything with tool_call ids the model needs to
 *        keep referencing. In those cases, use retrieval (drop to cold
 *        storage + recall on demand) instead.
 *
 *  Q: Trigger fraction — why not just compact whenever we're over?
 *     A: Hysteresis. If you compact at 100% and the next turn adds one
 *        message pushing you back over, you compact again. Every summary
 *        is an LLM call. 90% trigger + keepRecent=8 gives you headroom.
 *
 *  Q: What breaks if you summarize inside a tool_call/tool_result pair?
 *     A: The provider rejects the payload: an assistant message with
 *        tool_calls MUST be followed by a tool message per call_id. If
 *        the tool result is compacted away but the assistant survived,
 *        the request is malformed. `isSafeBoundary` prevents this.
 *
 *  Q: Determinism during replay?
 *     A: Summarizer output is nondeterministic (LLM temperature). Cache
 *        by hash(input_messages). On replay, look up the cache before
 *        calling the model. This makes checkpoints reproducible.
 *
 *  Q: Adversarial input? A user pastes 100k tokens in one message.
 *     A: keepRecent still pins that message; it won't get summarized.
 *        Guard at the input boundary: cap per-turn user tokens, or route
 *        oversized inputs to a "please summarize your question" prompt.
 */
