# Practice — Tool Calling Mechanics

Rebuild each concept from a blank sheet. Do not import from the reference
files in the parent directory until you finish (or get stuck for ~10 min).

## How to use

1. Open the `.practice.ts` file for the topic you just studied.
2. Delete/replace the `TODO` blocks with your implementation.
3. Run it. The bottom of each file has a self-test harness.

```bash
cd Agent_system_Design/ToolCalling/practice
bun 01_schema.practice.ts
bun 02_parsing.practice.ts
```

## Files

| File                                                     | Rebuilds                     |
| -------------------------------------------------------- | ---------------------------- |
| [01_schema.practice.ts](01_schema.practice.ts)           | JSON Schema types + validator |
| [02_parsing.practice.ts](02_parsing.practice.ts)         | OpenAI + Anthropic adapters   |

## Rules of engagement

- **No copy-paste** from `../01_schema.ts` or `../02_parsing.ts`.
- **Time yourself**: interview loops give 25–35 min for problems this size.
- **Speak your reasoning out loud** as you code. Practice narration, not just typing.
- After you pass the self-tests, re-open the reference file and diff. Note:
  what edge cases did you miss? What did they name differently and why?

## Suggested extension order (after you pass the basics)

1. `01` Task 5 — `oneOf` (union types).
2. `02` Task 6 — streaming accumulator.
3. `02` Task 7 — Gemini adapter.
4. `01` Task 7 — coercion + schema description generator.

## Interview drill — verbal

Answer each in ≤30 seconds without notes:

- Why JSON Schema instead of TypeScript types?
- Why is OpenAI's `arguments` field a string, not an object?
- What does `additionalProperties: false` protect against?
- Why must the adapter be an anti-corruption layer, not a passthrough?
- What does `finish_reason: "length"` mean and how do you react?
- Why preserve `tool_call_id` in the parsed shape?
