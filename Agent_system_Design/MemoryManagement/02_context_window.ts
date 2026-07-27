/**
 * ============================================================
 *  02 — Context Window Management
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  LLMs have a hard token cap. Every message you send counts toward it:
 *    - system prompt
 *    - all prior user/assistant/tool messages
 *    - tool schemas (yes, they cost tokens every turn)
 *    - the *reserved* space for the model's output (`max_tokens`)
 *
 *      total_used = tokens(messages) + tokens(tool_schemas)
 *      budget     = model_max - max_output_tokens
 *      must hold: total_used <= budget
 *
 *  If you overflow: some providers 400, others silently truncate the
 *  *front* of your messages — which will drop your system prompt and
 *  break the agent's behavior in weird ways. Manage this yourself.
 *
 *  TRUNCATION STRATEGIES
 *  ---------------------
 *  (a) Drop-oldest sliding window
 *      Keep system + last N messages. Simple, deterministic.
 *      Failure mode: drops tool_call/tool_result pairs mid-conversation.
 *
 *  (b) Keep system + tail, drop middle
 *      Keep the first message (system) and the last K messages.
 *      Failure mode: same as (a), plus the "middle" often contains the
 *      user's earlier constraints.
 *
 *  (c) Keep system + summary + tail
 *      Summarize the dropped middle into one synthetic message.
 *      Lossy but preserves gist. Requires an extra LLM call.
 *      → see 03_summarization.ts
 *
 *  (d) Semantic recall (retrieval)
 *      Drop the middle to cold storage, retrieve relevant messages by
 *      embedding-similarity on demand. Best-quality, most complex.
 *      → part of MemoryManagement/, not this file.
 *
 *  This file implements (a) and (b), plus the primitives (c) and (d)
 *  need: `countTokens`, `budget`, and pair-aware trimming.
 */

import type { Message } from "./01_message_history";

// ------------------------------------------------------------
// Token counting
// ------------------------------------------------------------
// Real production code uses `tiktoken` (OpenAI) or the provider's
// tokenizer. We use a documented heuristic: ~4 chars/token for English.
// You'd inject the real tokenizer via a strategy param in prod.

export type TokenCounter = (text: string) => number;

/** Cheap ~4-chars-per-token heuristic. Good enough for design/testing. */
export const approxTokens: TokenCounter = (text) => Math.ceil(text.length / 4);

/**
 * Provider-agnostic overhead per message.
 * OpenAI documents ~4 tokens/message + name field costs. Anthropic
 * differs. We use a constant here; wire the real numbers per provider.
 */
const PER_MESSAGE_OVERHEAD = 4;

export function tokensOfMessage(msg: Message, count: TokenCounter): number {
    let n = PER_MESSAGE_OVERHEAD + count(msg.role);
    switch (msg.role) {
        case "system":
        case "user":
            n += count(msg.content);
            break;
        case "assistant":
            n += count(msg.content);
            for (const tc of msg.toolCalls) {
                n += count(tc.name) + count(JSON.stringify(tc.args));
            }
            break;
        case "tool":
            n += count(msg.name) + count(msg.content);
            break;
    }
    return n;
}

export function tokensOfMessages(msgs: readonly Message[], count: TokenCounter): number {
    let n = 0;
    for (const m of msgs) n += tokensOfMessage(m, count);
    return n;
}

// ------------------------------------------------------------
// Budget model
// ------------------------------------------------------------

export interface Budget {
    /** Hard model limit, e.g. 128_000. */
    modelMaxTokens: number;
    /** Tokens reserved for the model's *reply* (max_tokens param). */
    reservedForOutput: number;
    /** Tokens spent every turn on tool schemas we send. */
    toolSchemaTokens: number;
    /** Safety margin (rounding, tokenizer drift). Default 5%. */
    safetyMarginTokens?: number;
}

export function usableBudget(b: Budget): number {
    const margin = b.safetyMarginTokens ?? Math.ceil(b.modelMaxTokens * 0.05);
    return b.modelMaxTokens - b.reservedForOutput - b.toolSchemaTokens - margin;
}

// ------------------------------------------------------------
// Truncation strategies
// ------------------------------------------------------------

export interface TrimOptions {
    budget: Budget;
    count: TokenCounter;
    /** Never drop the leading system message(s). Default: true. */
    pinSystem?: boolean;
    /** Never drop the last K messages. Default: 4. */
    pinTail?: number;
}

/**
 * Drop-oldest strategy.
 *
 * Invariant: the returned array is a suffix of `msgs`, optionally with
 * pinned system messages prepended.
 *
 * PAIR AWARENESS
 * --------------
 * If we drop an assistant message that had tool_calls, we MUST also drop
 * all tool messages referencing those calls — otherwise the provider will
 * 400 with "tool_result without tool_call". We handle this explicitly.
 */
export function trimDropOldest(
    msgs: readonly Message[],
    opts: TrimOptions,
): Message[] {
    const { budget, count, pinSystem = true, pinTail = 4 } = opts;
    const limit = usableBudget(budget);

    // Partition: pinned system prefix + middle + pinned tail.
    let head: Message[] = [];
    let rest: Message[] = msgs.slice();

    if (pinSystem) {
        while (rest.length && rest[0].role === "system") head.push(rest.shift()!);
    }
    const tail = rest.splice(Math.max(0, rest.length - pinTail));
    // `rest` is now the droppable middle.

    // Build orphan-safe deletion order: drop from the FRONT of `rest`.
    // Track the set of tool_call_ids that have been "cut" so we can also
    // drop dangling tool results.
    const cutIds = new Set<string>();

    const currentTokens = () => tokensOfMessages([...head, ...rest, ...tail], count);
    while (currentTokens() > limit && rest.length) {
        const dropped = rest.shift()!;
        if (dropped.role === "assistant") {
            for (const tc of dropped.toolCalls) cutIds.add(tc.id);
        }
    }

    // Also drop any tool messages that reference a cut assistant.
    const cleanedTail = tail.filter(
        (m) => m.role !== "tool" || !cutIds.has(m.toolCallId),
    );
    const cleanedRest = rest.filter(
        (m) => m.role !== "tool" || !cutIds.has(m.toolCallId),
    );

    return [...head, ...cleanedRest, ...cleanedTail];
}

/**
 * "Keep system + last K" strategy. Same as drop-oldest but with a hard
 * cap on how much middle we keep. Useful when you want deterministic
 * message count regardless of budget.
 */
export function trimKeepTail(
    msgs: readonly Message[],
    keepTail: number,
    opts: TrimOptions,
): Message[] {
    const capped = [
        ...msgs.filter((m) => m.role === "system"),
        ...msgs.filter((m) => m.role !== "system").slice(-keepTail),
    ];
    return trimDropOldest(capped, opts);
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const { newId } = require("./01_message_history") as typeof import("./01_message_history");
    const now = Date.now();

    const msgs: Message[] = [
        { id: newId(), role: "system", createdAt: now, content: "You are a helpful assistant." },
        ...Array.from({ length: 20 }, (_, i): Message => ({
            id: newId(),
            role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
            createdAt: now + i,
            content: `Filler message ${i} `.repeat(200),
            ...(i % 2 === 1 ? { toolCalls: [], finishReason: "stop" as const } : {}),
        }) as Message),
    ];

    const budget: Budget = {
        modelMaxTokens: 4_000,
        reservedForOutput: 500,
        toolSchemaTokens: 200,
    };

    const before = tokensOfMessages(msgs, approxTokens);
    const trimmed = trimDropOldest(msgs, { budget, count: approxTokens });
    const after = tokensOfMessages(trimmed, approxTokens);

    console.log(`before: ${msgs.length} msgs, ${before} tokens`);
    console.log(`after:  ${trimmed.length} msgs, ${after} tokens`);
    console.log(`usable budget: ${usableBudget(budget)}`);
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why not just use `messages.length` as a proxy?
 *     A: One tool result JSON blob can be 5000 tokens; one user "hi" is 1.
 *        Budget is on TOKENS, not message count. Approximation is fine
 *        for the trim decision, but real production reads the actual
 *        tokenizer output.
 *
 *  Q: The provider silently truncates from the front if I overshoot.
 *     Why manage this myself?
 *     A: Two reasons. (1) Some providers 400 instead of truncating.
 *        (2) Silent front-truncation drops your system prompt without
 *        telling you — worst possible outcome for behavior stability.
 *
 *  Q: What's a "context poisoning" bug?
 *     A: When garbage in the transcript (a bad tool result, hallucinated
 *        JSON, injection from a scraped page) survives many turns and
 *        keeps steering the model. Fix: aggressive summarization + a
 *        `content_score` that trims low-signal messages first.
 *
 *  Q: Tool schemas cost tokens every turn — how do you optimize?
 *     A: (1) Trim descriptions ruthlessly. (2) Send only the RELEVANT
 *        tools for the current turn (a "tool router"). (3) Cache the
 *        schema prefix on the provider side (OpenAI supports prefix
 *        caching; discounts apply).
 *
 *  Q: What if trimming makes the log empty?
 *     A: You've mis-sized. Budget must always fit the system prompt +
 *        the current user turn + reserved output. If not, the model
 *        is too small for your workload. Fail fast at boot with an
 *        assertion; don't discover it in prod.
 */
