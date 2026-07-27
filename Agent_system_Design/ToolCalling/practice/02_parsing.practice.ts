/**
 * ============================================================
 *  PRACTICE — 02 Parsing LLM Tool Call Response
 * ============================================================
 *
 *  Rules:
 *    - Do NOT import from ../02_parsing.ts. Rebuild.
 *    - You MAY reuse a real JSON.parse (no repair needed here;
 *      the repair layer is exercise 03).
 *    - Run with:  bun 02_parsing.practice.ts
 * ============================================================
 */

// ------------------------------------------------------------
// TASK 1 — Canonical shape
// ------------------------------------------------------------
// interface ParsedToolCall  { id: string; name: string; args: Record<string, unknown> }
// interface ParsedAssistantMessage {
//     text: string;
//     toolCalls: ParsedToolCall[];
//     finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "unknown";
// }
//
// The rest of your agent should NEVER import a provider's raw type.
// That's the Anti-Corruption Layer.

// TODO: define the two interfaces


// ------------------------------------------------------------
// TASK 2 — parseOpenAI(raw): ParsedAssistantMessage
// ------------------------------------------------------------
// Raw shape (only fields we care about):
//   {
//     choices: [{
//       finish_reason: string,
//       message: {
//         role: "assistant",
//         content: string | null,
//         tool_calls?: [{
//           id: string,
//           type: "function",
//           function: { name: string, arguments: string /* JSON string! */ }
//         }]
//       }
//     }]
//   }
//
// Requirements:
//   - `arguments` is a JSON STRING → JSON.parse it (wrap in try/catch;
//      on failure set args = {} and continue — don't throw).
//   - Handle missing tool_calls (undefined).
//   - Handle content === null (return "").
//   - Handle choices[] empty → return an "unknown" finishReason message.

// TODO: implement parseOpenAI


// ------------------------------------------------------------
// TASK 3 — parseAnthropic(raw): ParsedAssistantMessage
// ------------------------------------------------------------
// Raw shape:
//   {
//     stop_reason: string,
//     content: Array<
//       | { type: "text", text: string }
//       | { type: "tool_use", id: string, name: string, input: object }
//     >
//   }
//
// Requirements:
//   - Concatenate all text blocks (in order) into `text`.
//   - Each tool_use block → one ParsedToolCall (input is already parsed).

// TODO: implement parseAnthropic


// ------------------------------------------------------------
// TASK 4 — normalizeFinishReason
// ------------------------------------------------------------
// Map provider-native reasons → canonical set.
//   OpenAI:    stop, tool_calls, length, content_filter
//   Anthropic: end_turn, tool_use, max_tokens, safety
// Anything else → "unknown".

// TODO: implement


// ------------------------------------------------------------
// TASK 5 — Fixtures + self-test
// ------------------------------------------------------------

const openaiParallel = {
    choices: [{
        finish_reason: "tool_calls",
        message: {
            role: "assistant" as const,
            content: null,
            tool_calls: [
                { id: "c1", type: "function" as const, function: { name: "get_weather", arguments: '{"city":"Seattle"}' } },
                { id: "c2", type: "function" as const, function: { name: "search_web",  arguments: '{"query":"news","top_k":3}' } },
            ],
        },
    }],
};

const openaiTextOnly = {
    choices: [{
        finish_reason: "stop",
        message: { role: "assistant" as const, content: "Hello!", tool_calls: [] },
    }],
};

const openaiBadArgs = {
    choices: [{
        finish_reason: "tool_calls",
        message: {
            role: "assistant" as const,
            content: null,
            tool_calls: [
                { id: "c1", type: "function" as const, function: { name: "get_weather", arguments: '{not json' } },
            ],
        },
    }],
};

const anthropicMixed = {
    stop_reason: "tool_use",
    content: [
        { type: "text" as const, text: "Let me check. " },
        { type: "tool_use" as const, id: "t1", name: "get_weather", input: { city: "SF" } },
        { type: "text" as const, text: "One sec." },
    ],
};

const anthropicEndTurn = {
    stop_reason: "end_turn",
    content: [{ type: "text" as const, text: "Done." }],
};

function assertEq(label: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(ok ? "PASS" : "FAIL", label);
    if (!ok) console.log("  expected:", expected, "\n  actual:  ", actual);
}

function runSelfTests() {
    // @ts-expect-error until implemented
    const a = parseOpenAI(openaiParallel);
    assertEq("openai: 2 tool calls", a.toolCalls.length, 2);
    assertEq("openai: finishReason", a.finishReason, "tool_calls");
    assertEq("openai: args parsed", a.toolCalls[0].args, { city: "Seattle" });

    // @ts-expect-error
    const b = parseOpenAI(openaiTextOnly);
    assertEq("openai: text only", b.text, "Hello!");
    assertEq("openai: stop", b.finishReason, "stop");

    // @ts-expect-error
    const c = parseOpenAI(openaiBadArgs);
    assertEq("openai: bad args → {}", c.toolCalls[0].args, {});

    // @ts-expect-error
    const d = parseAnthropic(anthropicMixed);
    assertEq("anthropic: mixed text", d.text, "Let me check. One sec.");
    assertEq("anthropic: tool call", d.toolCalls[0], { id: "t1", name: "get_weather", args: { city: "SF" } });
    assertEq("anthropic: tool_use → tool_calls", d.finishReason, "tool_calls");

    // @ts-expect-error
    const e = parseAnthropic(anthropicEndTurn);
    assertEq("anthropic: end_turn → stop", e.finishReason, "stop");
}


// ------------------------------------------------------------
// TASK 6 — Streaming accumulator (interview stretch)
// ------------------------------------------------------------
// Real OpenAI streams `tool_calls` in deltas like:
//   {index:0, id:"c1", function:{name:"get_weather", arguments:"{\"ci"}}
//   {index:0,                                        arguments:"ty\":\""}}
//   {index:0,                                        arguments:"Seattle\"}"}}
//
// Implement:
//   class ToolCallStreamAccumulator {
//     push(delta: {index:number; id?:string; function?:{name?:string; arguments?:string}}): void;
//     finalize(): ParsedToolCall[];   // parses args once at the end
//   }
//
// Constraints:
//   - Never JSON.parse mid-stream.
//   - Preserve order by `index`.
//   - `id` and `name` may arrive on the first delta only.


// ------------------------------------------------------------
// TASK 7 — Google Gemini adapter (interview stretch)
// ------------------------------------------------------------
// Raw shape (simplified):
//   {
//     candidates: [{
//       finishReason: "STOP" | "MAX_TOKENS" | ...,
//       content: {
//         parts: Array<
//           | { text: string }
//           | { functionCall: { name: string, args: object } }
//         >
//       }
//     }]
//   }
//
// Gemini has no per-call id. Fabricate one: `call_${index}`.
// Implement parseGemini(raw) with the same canonical output.


if (require.main === module) {
    runSelfTests();
}


/**
 * SELF-REVIEW CHECKLIST
 * ---------------------
 *  [ ] Never threw on missing/null fields.
 *  [ ] `arguments` string parse errors did NOT crash the parser.
 *  [ ] finishReason normalization covers both providers.
 *  [ ] No leaking of provider-specific types outside the adapter.
 *  [ ] Anthropic text concatenation preserves order.
 *  [ ] Kept the tool_call `id` — it's needed for the follow-up turn.
 */
