/**
 * ============================================================
 *  01 — Message History (the transcript)
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Every agent turn is a function of the messages so far.
 *  We need a data structure that is:
 *
 *    1. Append-only  — once a message is written, it never mutates.
 *       (Retroactively editing a past turn wrecks reproducibility.)
 *    2. Ordered       — messages have a total order the LLM can consume.
 *    3. Linked        — every tool_result references its tool_call by id.
 *                       OpenAI/Anthropic APIs reject unlinked results.
 *    4. Addressable   — each message has a stable id we can reference
 *                       later (checkpointing, resume, undo).
 *    5. Serializable  — must round-trip through JSON to disk / KV / Redis.
 *
 *  KEY DECISIONS
 *  -------------
 *  - Messages are typed by `role` (system | user | assistant | tool).
 *  - Tool messages carry `toolCallId` matching an earlier assistant
 *    tool_call. Enforce this at APPEND time — cheap, catches bugs early.
 *  - We store the raw `toolCalls[]` on assistant messages (the model
 *    emitted them). This is what we resend to the provider on the next
 *    turn — providers require the tool_calls array be echoed back.
 */

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  /** Parsed args — we've already handled the JSON-string layer. */
  args: Record<string, unknown>;
}

interface BaseMessage {
  id: string; // internal id, distinct from tool_call.id
  role: Role;
  createdAt: number; // epoch ms; used for TTL, tracing
}

export interface SystemMessage extends BaseMessage {
  role: "system";
  content: string;
}

export interface UserMessage extends BaseMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  /** Text may be empty when the turn is purely tool_calls. */
  content: string;
  /** Emitted by the LLM in this turn; must be echoed to future turns. */
  toolCalls: ToolCall[];
  /** From the provider — helps decide when to stop looping. */
  finishReason: "stop" | "tool_calls" | "length" | "content_filter" | "unknown";
}

export interface ToolMessage extends BaseMessage {
  role: "tool";
  /** Must match an earlier assistant.toolCalls[i].id. */
  toolCallId: string;
  /** The tool's name is denormalized in for logs / debugging. */
  name: string;
  /** Serialized output (LLMs consume strings). */
  content: string;
  /** Set false if the tool errored — helps the model decide to retry. */
  ok: boolean;
}

export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

// ------------------------------------------------------------
// MessageLog — the append-only transcript
// ------------------------------------------------------------

export class MessageLog {
  private messages: Message[] = [];
  /** Fast lookup: which tool_call_ids are still awaiting a result? */
  private pendingToolCalls = new Map<
    string,
    { assistantMsgId: string; name: string }
  >();

  /** How many messages so far. */
  size(): number {
    return this.messages.length;
  }

  /** Snapshot — returns a defensive copy so callers can't mutate history. */
  snapshot(): readonly Message[] {
    return this.messages.slice();
  }

  /** The last message (or undefined). Handy for "what was the finish reason". */
  last(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  /** Append a message. Enforces the invariants documented above. */
  append(msg: Message): void {
    this.validate(msg);
    this.messages.push(msg);

    // Update the pending-tool-call index.
    if (msg.role === "assistant") {
      for (const tc of msg.toolCalls) {
        this.pendingToolCalls.set(tc.id, {
          assistantMsgId: msg.id,
          name: tc.name,
        });
      }
    } else if (msg.role === "tool") {
      this.pendingToolCalls.delete(msg.toolCallId);
    }
  }

  /** Tool calls emitted but not yet resolved. Useful for crash recovery. */
  pending(): Array<{ toolCallId: string; name: string }> {
    return Array.from(this.pendingToolCalls, ([toolCallId, v]) => ({
      toolCallId,
      name: v.name,
    }));
  }

  private validate(msg: Message): void {
    if (!msg.id) throw new Error("message.id is required");
    // Enforce non-decreasing timestamps. Not strict ordering — same-ms
    // is fine — but a message that predates the previous one is a bug.
    const prev = this.messages[this.messages.length - 1];
    if (prev && msg.createdAt < prev.createdAt) {
      throw new Error(
        `message ${msg.id} createdAt=${msg.createdAt} predates previous ${prev.createdAt}`,
      );
    }

    if (msg.role === "tool") {
      // Every tool_result MUST link to a pending tool_call. If not, the
      // model likely hallucinated an id, or we're double-appending.
      if (!this.pendingToolCalls.has(msg.toolCallId)) {
        throw new Error(
          `tool message references unknown tool_call_id=${msg.toolCallId}`,
        );
      }
    }

    if (msg.role === "assistant") {
      // Duplicate tool_call ids within one message would 400 on the provider.
      const seen = new Set<string>();
      for (const tc of msg.toolCalls) {
        if (seen.has(tc.id)) {
          throw new Error(`duplicate tool_call.id=${tc.id} in one message`);
        }
        seen.add(tc.id);
      }
    }
  }
}

// ------------------------------------------------------------
// ID generation
// ------------------------------------------------------------
// Message ids must be unique within the session, stable, and comparable
// (rough ordering helps humans skim logs). ULID / UUIDv7 give us all
// three; here we use a tiny time-prefixed counter to stay dep-free.

let counter = 0;
export function newId(prefix = "msg"): string {
  counter = (counter + 1) & 0xffff;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
  const log = new MessageLog();

  log.append({
    id: newId(),
    role: "system",
    createdAt: Date.now(),
    content: "You are a helpful assistant.",
  });

  log.append({
    id: newId(),
    role: "user",
    createdAt: Date.now(),
    content: "What's the weather in SF?",
  });

  const assistantId = newId();
  log.append({
    id: assistantId,
    role: "assistant",
    createdAt: Date.now(),
    content: "",
    toolCalls: [{ id: "call_1", name: "get_weather", args: { city: "SF" } }],
    finishReason: "tool_calls",
  });

  console.log("pending before tool result:", log.pending());

  log.append({
    id: newId(),
    role: "tool",
    createdAt: Date.now(),
    toolCallId: "call_1",
    name: "get_weather",
    content: JSON.stringify({ tempC: 19 }),
    ok: true,
  });

  console.log("pending after:", log.pending());
  console.log("history size:", log.size());

  // Deliberate bug — should throw.
  try {
    log.append({
      id: newId(),
      role: "tool",
      createdAt: Date.now(),
      toolCallId: "call_does_not_exist",
      name: "get_weather",
      content: "{}",
      ok: true,
    });
  } catch (e) {
    console.log("caught bad append:", (e as Error).message);
  }
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why append-only? Can't I just edit the last assistant message?
 *     A: Editing kills replayability. If you're doing event sourcing
 *        (see 05), the log IS the source of truth. Any "edit" is an
 *        Amend event appended on top — the original stays.
 *
 *  Q: Two tools finish out of order. Do I append them in call order or
 *     completion order?
 *     A: Either is legal on the provider side (results are matched by
 *        tool_call_id, not order). But CALL ORDER makes logs and replays
 *        deterministic. Enforce at the batch runner: collect all results,
 *        sort by original invocation index, then append.
 *
 *  Q: The model hallucinates a tool_call_id that never existed. What
 *     does your `validate` do?
 *     A: Throws. The caller (05_event_log or orchestrator) catches it,
 *        does NOT append the phantom result, and either re-prompts the
 *        model or aborts the turn. Silently accepting corrupts the log.
 *
 *  Q: Serialization concerns?
 *     A: `snapshot()` returns Message[] which is pure data — JSON.stringify
 *        works. `pendingToolCalls` is derived — rebuild on load. Never
 *        serialize the Map; that's a code smell (source-of-truth violation).
 *
 *  Q: Concurrency — two workers call `append` at the same time?
 *     A: In Node this file is safe because `append` has no await. If
 *        `validate` becomes async (e.g. remote schema check), you need
 *        a mutex or a single-writer queue. See 06 in the plan.
 */

async function runAgent(
  userMessage: string,
  tools: Record<string, Function>,
  history: Message[],
) {
  const N: number = 10;
  if (history.length < N) {
    history.push({ role: "user", content: userMessage });
  } else {
    let messages = [...history];
    history = [messages[0], messages.slice(-N)];
  }
  let attempt = 5;
  while (true) {
    attempt++;
    try {
      if( attempt > 5 ){
        throw new Error(`infinite loops`);
      }
      const response = await callLLM(history);
      if (response.toolCall) {
        const result = await tools[response.toolCall.name](
          response.toolCall.params,
        );

        history = [
          { role: "tool", content: JSON.stringify(result) },
          history.slice(-N),
        ];
      } else {
        return response.content;
      }
    } catch (error) {
      throw new Error(`${error}`);
    }
  }
}
