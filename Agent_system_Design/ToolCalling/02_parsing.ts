/**
 * ============================================================
 *  02 — Parsing LLM Tool Call Response
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  The LLM's response is a chat message that MAY contain:
 *    - text (natural language, for the user)
 *    - tool_calls[] (structured requests to invoke tools)
 *    - both, or neither (a "stop" turn)
 *
 *  Providers differ:
 *
 *  ┌────────────┬────────────────────────────────────────────┐
 *  │ OpenAI     │ message.tool_calls: [{id, type, function:  │
 *  │            │   {name, arguments: <string JSON>}}]       │
 *  ├────────────┼────────────────────────────────────────────┤
 *  │ Anthropic  │ content: [{type:"tool_use", id, name,      │
 *  │            │   input: <object>}, {type:"text", text}]   │
 *  ├────────────┼────────────────────────────────────────────┤
 *  │ Google     │ candidates[0].content.parts[]              │
 *  │            │   .functionCall.{name, args:<object>}      │
 *  └────────────┴────────────────────────────────────────────┘
 *
 *  Key gotcha (OpenAI): `arguments` is a STRING containing JSON, not
 *  a parsed object. This is because arguments arrive as an incremental
 *  stream of tokens — the server just concatenates them.
 *
 *  DESIGN
 *  ------
 *  Introduce a canonical internal shape `ParsedToolCall`, and write
 *  a per-provider adapter. The rest of the system only knows the
 *  canonical shape. This is the classic Anti-Corruption Layer pattern.
 */

// ------------------------------------------------------------
// Canonical shape used by our agent
// ------------------------------------------------------------

export interface ParsedToolCall {
    /** Unique id assigned by the provider — echoed back in tool result. */
    id: string;
    name: string;
    args: Record<string, unknown>;
}

export interface ParsedAssistantMessage {
    text: string;              // may be ""
    toolCalls: ParsedToolCall[];
    /**
     * Why did the model stop generating?
     *   - "stop":        natural end, no more work needed
     *   - "tool_calls":  waiting for tool results
     *   - "length":      hit max_tokens (bad — retry with more budget)
     *   - "content_filter": safety refused
     */
    finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "unknown";
}

// ------------------------------------------------------------
// Provider-specific raw shapes (only the fields we care about)
// ------------------------------------------------------------

export interface OpenAIRawMessage {
    role: "assistant";
    content: string | null;
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
    }>;
}
export interface OpenAIRawChoice {
    message: OpenAIRawMessage;
    finish_reason: string;
}
export interface OpenAIRawResponse {
    choices: OpenAIRawChoice[];
}

export interface AnthropicRawResponse {
    stop_reason: string;
    content: Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    >;
}

// ------------------------------------------------------------
// Adapters
// ------------------------------------------------------------

import { safeParseJson } from "./03_malformed_json";

export function parseOpenAI(raw: OpenAIRawResponse): ParsedAssistantMessage {
    const choice = raw.choices?.[0];
    if (!choice) {
        // Defensive: never trust upstream. Return a well-typed empty msg.
        return { text: "", toolCalls: [], finishReason: "unknown" };
    }

    const msg = choice.message;
    const toolCalls: ParsedToolCall[] = (msg.tool_calls ?? []).map((tc) => {
        // `arguments` is a JSON string — parse defensively.
        const parsed = safeParseJson(tc.function.arguments);
        return {
            id: tc.id,
            name: tc.function.name,
            // If parsing fails, args is `{}` and 03_malformed_json.ts explains
            // how we recover. We keep going so the caller can decide policy.
            args: (parsed.ok ? parsed.value : {}) as Record<string, unknown>,
        };
    });

    return {
        text: msg.content ?? "",
        toolCalls,
        finishReason: normalizeFinishReason(choice.finish_reason),
    };
}

export function parseAnthropic(raw: AnthropicRawResponse): ParsedAssistantMessage {
    let text = "";
    const toolCalls: ParsedToolCall[] = [];

    for (const block of raw.content ?? []) {
        if (block.type === "text") {
            text += block.text;
        } else if (block.type === "tool_use") {
            // Anthropic already parses input into an object — nice.
            toolCalls.push({ id: block.id, name: block.name, args: block.input });
        }
    }

    return {
        text,
        toolCalls,
        finishReason: normalizeFinishReason(raw.stop_reason),
    };
}

function normalizeFinishReason(r: string): ParsedAssistantMessage["finishReason"] {
    switch (r) {
        case "stop":
        case "end_turn":
            return "stop";
        case "tool_calls":
        case "tool_use":
            return "tool_calls";
        case "length":
        case "max_tokens":
            return "length";
        case "content_filter":
        case "safety":
            return "content_filter";
        default:
            return "unknown";
    }
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const openaiRaw: OpenAIRawResponse = {
        choices: [
            {
                finish_reason: "tool_calls",
                message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                        {
                            id: "call_1",
                            type: "function",
                            function: {
                                name: "get_weather",
                                arguments: '{"city":"Seattle","unit":"celsius"}',
                            },
                        },
                        {
                            id: "call_2",
                            type: "function",
                            function: {
                                name: "search_web",
                                arguments: '{"query":"latest ai news","top_k":3}',
                            },
                        },
                    ],
                },
            },
        ],
    };

    const anthropicRaw: AnthropicRawResponse = {
        stop_reason: "tool_use",
        content: [
            { type: "text", text: "Let me check both for you." },
            {
                type: "tool_use",
                id: "toolu_1",
                name: "get_weather",
                input: { city: "Seattle" },
            },
        ],
    };

    console.log("OpenAI   →", parseOpenAI(openaiRaw));
    console.log("Anthropic→", parseAnthropic(anthropicRaw));
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: What about streaming?  `arguments` may arrive in fragments.
 *     A: Accumulate fragments per `tool_calls[i].id`. Only parse
 *        when `finish_reason` fires. Do NOT try to parse mid-stream —
 *        JSON is only valid at boundaries.  You *can* use a streaming
 *        JSON parser (e.g. clarinet) if you want to render partial UI.
 *
 *  Q: Parallel tool calls in one message?
 *     A: Absolutely. Modern models emit N `tool_calls` in a single turn.
 *        That's why 04_parallel_execution.ts exists.
 *
 *  Q: What if `name` refers to a tool we never registered?
 *     A: Registry returns "unknown_tool" error, we feed *that* back
 *        as the tool result. The model self-corrects on the next turn.
 *        Never crash — this is a common hallucination.
 *
 *  Q: Why keep the `id`?
 *     A: OpenAI's `tool` role message MUST reference the exact
 *        `tool_call_id` in the follow-up turn, otherwise the API 400s.
 *        Anthropic is the same with `tool_use_id`.
 */
