/**
 * ============================================================
 *  03 — Handling Malformed JSON from the LLM
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Even with "structured outputs" enabled, models still produce
 *  broken JSON at some non-zero rate. Common failures:
 *
 *    1. Trailing commas:            {"a":1,}
 *    2. Single quotes:              {'a':1}
 *    3. Unquoted keys:              {a:1}
 *    4. Wrapped in markdown fence:  ```json\n{...}\n```
 *    5. Preamble text:              Sure! Here's the JSON: {...}
 *    6. Truncation:                 {"a": 1, "b": [  ← hit max_tokens
 *    7. Comments:                   {"a":1 /* note *​/}
 *    8. NaN / Infinity:             {"x": NaN}
 *    9. Duplicate keys:             {"a":1,"a":2}
 *   10. Unescaped newlines in string
 *
 *  POLICY OPTIONS
 *  --------------
 *  a) Strict: reject and re-prompt the model with the error text.
 *     Best for correctness-critical tools (payments, DB writes).
 *
 *  b) Best-effort repair: fix common issues, log, continue.
 *     Best for read-only tools where a retry costs more than
 *     accepting a slightly munged input.
 *
 *  c) Ask the model to repair: send back an "invalid JSON, fix it"
 *     message. Costs a round-trip but is 100% policy-safe.
 *
 *  We implement (a) and (b) — you compose them.
 */

export type ParseResult<T> =
    | { ok: true; value: T; repaired: boolean }
    | { ok: false; error: string; raw: string };

// ------------------------------------------------------------
// Layer 1 — plain JSON.parse with informative error
// ------------------------------------------------------------

export function safeParseJson(input: string): ParseResult<unknown> {
    try {
        return { ok: true, value: JSON.parse(input), repaired: false };
    } catch (e) {
        // Attempt repair before giving up
        const repaired = tryRepair(input);
        if (repaired !== null) {
            try {
                return { ok: true, value: JSON.parse(repaired), repaired: true };
            } catch {
                /* fall through */
            }
        }
        return {
            ok: false,
            error: (e as Error).message,
            raw: input,
        };
    }
}

// ------------------------------------------------------------
// Layer 2 — Repair heuristics.
// Return null if we can't confidently repair (don't guess wildly).
// ------------------------------------------------------------

export function tryRepair(input: string): string | null {
    let s = input;

    // (4) Strip markdown code fences: ```json ... ```  or  ``` ... ```
    const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) s = fenceMatch[1];

    // (5) Strip preamble/postamble by locking to the outermost braces.
    s = extractOutermostJson(s) ?? s;

    // (7) Strip // and /* */ comments (but keep them inside strings intact).
    s = stripJsonComments(s);

    // (1) Remove trailing commas before ] or }
    s = s.replace(/,(\s*[}\]])/g, "$1");

    // (8) Replace bare NaN / Infinity with null (they're not valid JSON).
    s = s.replace(/\b(NaN|-?Infinity)\b/g, "null");

    // (6) Truncated JSON — try to close open brackets. This is heuristic
    // and CAN produce wrong shapes; caller is warned via `repaired: true`.
    s = closeUnbalancedBrackets(s);

    return s === input ? null : s;
}

/** Find the first '{' or '[' and return the balanced substring to its match. */
function extractOutermostJson(s: string): string | null {
    const start = s.search(/[{\[]/);
    if (start < 0) return null;
    const open = s[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (inString) {
            if (escape) escape = false;
            else if (c === "\\") escape = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') { inString = true; continue; }
        if (c === open) depth++;
        else if (c === close) {
            depth--;
            if (depth === 0) return s.slice(start, i + 1);
        }
    }
    return null;
}

/** Remove // line comments and /* block comments *\/ but not inside strings. */
function stripJsonComments(s: string): string {
    let out = "";
    let i = 0;
    let inString = false;
    let escape = false;
    while (i < s.length) {
        const c = s[i];
        if (inString) {
            out += c;
            if (escape) escape = false;
            else if (c === "\\") escape = true;
            else if (c === '"') inString = false;
            i++;
            continue;
        }
        if (c === '"') { inString = true; out += c; i++; continue; }
        if (c === "/" && s[i + 1] === "/") {
            while (i < s.length && s[i] !== "\n") i++;
            continue;
        }
        if (c === "/" && s[i + 1] === "*") {
            i += 2;
            while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
            i += 2;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/** If a JSON string is truncated, append the missing closers. */
function closeUnbalancedBrackets(s: string): string {
    const stack: string[] = [];
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inString) {
            if (escape) escape = false;
            else if (c === "\\") escape = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') { inString = true; continue; }
        if (c === "{") stack.push("}");
        else if (c === "[") stack.push("]");
        else if (c === "}" || c === "]") stack.pop();
    }
    // Also close an unterminated string
    let suffix = "";
    if (inString) suffix += '"';
    while (stack.length) suffix += stack.pop();
    return s + suffix;
}

// ------------------------------------------------------------
// Layer 3 — Ask the model to fix it.
// The caller composes this: it's a policy, not a util.
// ------------------------------------------------------------

export function buildRepairPrompt(rawArgs: string, error: string): string {
    // Sent as a `tool` role result on OpenAI, or a `tool_result` block on Anthropic.
    return (
        `Your previous tool_call arguments could not be parsed as JSON.\n` +
        `Parser error: ${error}\n` +
        `Raw arguments:\n${rawArgs}\n\n` +
        `Re-emit the tool call with valid JSON matching the schema exactly. ` +
        `Do NOT wrap in markdown. Do NOT include commentary.`
    );
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const cases = [
        '{"a":1,"b":2}',                              // clean
        '{"a":1,}',                                    // trailing comma
        '```json\n{"a":1}\n```',                       // fenced
        'Sure! Here is the JSON: {"a":1}',             // preamble
        '{"a":1, "b": [1,2,',                          // truncated
        '{"a":NaN}',                                   // NaN
        '{"a":1 /* comment */, "b":2}',                // comment
        "not even json at all",                        // total garbage
    ];

    for (const c of cases) {
        console.log("in :", c);
        console.log("out:", safeParseJson(c));
        console.log("---");
    }
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: When would you refuse to repair?
 *     A: Anytime the tool has side effects. A repaired
 *        `{ amount: 100 }` might actually be `{ amount: 1000 }`
 *        if truncation dropped a digit. Reject and re-prompt.
 *
 *  Q: How do you avoid unbounded retry loops?
 *     A: Cap retries (e.g. 2) per tool call. After that, surface
 *        the failure to the user or fall back to a text-only reply.
 *
 *  Q: Should you use a real streaming JSON parser?
 *     A: Only if you need to *render* partial output (e.g. UI shows
 *        the tool call progressively). For execution, wait for the
 *        stream to finish — a partially-arrived arg list is meaningless.
 *
 *  Q: Duplicate keys? JSON.parse silently keeps the last one.
 *     A: Yes, and that's actually the spec (RFC 8259 §4). If you care,
 *        use a reviver or a strict parser like `secure-json-parse`.
 */
