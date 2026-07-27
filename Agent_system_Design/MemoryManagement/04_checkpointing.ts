/**
 * ============================================================
 *  04 — Checkpointing (serialize / resume / schema versioning)
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Agents run for seconds to hours. If the process crashes, the user's
 *  Node goes OOM, or you deploy a new build, you want:
 *    - the transcript preserved
 *    - the in-flight tool call recorded ("we called X, no result yet")
 *    - the ability to resume from that exact point
 *
 *  Requirements:
 *    1. Every state transition writes a checkpoint (or an event; see 05).
 *    2. Checkpoints are self-describing — schema version + payload.
 *    3. Migrations exist for every prior version. Never silently misread.
 *    4. Idempotent — writing the same checkpoint twice is a no-op.
 *    5. Small — you'll checkpoint on the hot path.
 *
 *  STORAGE OPTIONS (out of scope for this file, but know them)
 *    - Redis:       fast, ephemeral, TTL. Good for turn state.
 *    - Postgres:    durable, transactional. Good for session state.
 *    - S3/blob:     cheap, cold. Good for archive.
 *    - Event log:   Kafka/Kinesis; enables 05_event_log.ts replay.
 *
 *  DESIGN
 *  ------
 *  A checkpoint is `{ version, savedAt, sessionId, cursor, messages }`.
 *  We provide `serialize` / `deserialize` with a migration chain.
 */

import type { Message } from "./01_message_history";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export const CHECKPOINT_VERSION = 3;

export interface Checkpoint {
    /** Bump when the shape changes; register a migration below. */
    version: number;
    /** Epoch ms. */
    savedAt: number;
    sessionId: string;
    /** Monotonic revision — increments on every write. See 05_event_log. */
    cursor: number;
    /** The transcript at this point. */
    messages: Message[];
    /** Free-form key/value for app state (plan step, mode, etc.). */
    meta: Record<string, unknown>;
}

// ------------------------------------------------------------
// Migrations
// ------------------------------------------------------------
// One function per version that upgrades v(N-1) → vN.
// Callers can safely load ANY old checkpoint by chaining these.

type Migration = (input: any) => any;

const migrations: Record<number, Migration> = {
    // v1 → v2: introduced `cursor` (default 0 for legacy sessions).
    2: (v1) => ({ ...v1, version: 2, cursor: 0 }),

    // v2 → v3: introduced `meta` (was implicit at top level).
    3: (v2) => {
        const { version: _v, savedAt, sessionId, cursor, messages, ...rest } = v2;
        return { version: 3, savedAt, sessionId, cursor, messages, meta: rest };
    },
};

function migrate(payload: any): Checkpoint {
    let cur = payload.version ?? 1;
    while (cur < CHECKPOINT_VERSION) {
        const next = cur + 1;
        const step = migrations[next];
        if (!step) throw new Error(`no migration from v${cur} to v${next}`);
        payload = step(payload);
        cur = next;
    }
    // Defensive: reject anything newer than we understand.
    if (payload.version > CHECKPOINT_VERSION) {
        throw new Error(
            `checkpoint version ${payload.version} newer than supported ${CHECKPOINT_VERSION}. ` +
            `Upgrade the runtime.`,
        );
    }
    return payload as Checkpoint;
}

// ------------------------------------------------------------
// Serialize / deserialize
// ------------------------------------------------------------

export function serialize(cp: Checkpoint): string {
    if (cp.version !== CHECKPOINT_VERSION) {
        throw new Error(`refusing to serialize old version ${cp.version}`);
    }
    // Deterministic key order — helps content-hash-based dedupe / caching.
    return JSON.stringify(cp, ["version", "savedAt", "sessionId", "cursor", "meta", "messages"]);
}

export function deserialize(raw: string): Checkpoint {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`checkpoint parse failed: ${(e as Error).message}`);
    }
    if (typeof parsed !== "object" || parsed === null) {
        throw new Error("checkpoint payload is not an object");
    }
    return migrate(parsed);
}

// ------------------------------------------------------------
// Storage interface
// ------------------------------------------------------------
// Swap the impl. In-memory is enough for tests; prod uses Redis / SQL.

export interface CheckpointStore {
    load(sessionId: string): Promise<Checkpoint | null>;
    /**
     * Save with optimistic concurrency:
     *   - If `expectedCursor` is provided, save only if the store's current
     *     cursor equals it. Otherwise the write is rejected (concurrent
     *     writer). Callers must reload and retry.
     */
    save(cp: Checkpoint, expectedCursor?: number): Promise<void>;
}

export class InMemoryCheckpointStore implements CheckpointStore {
    private data = new Map<string, string>();
    private cursors = new Map<string, number>();

    async load(sessionId: string): Promise<Checkpoint | null> {
        const raw = this.data.get(sessionId);
        return raw ? deserialize(raw) : null;
    }

    async save(cp: Checkpoint, expectedCursor?: number): Promise<void> {
        if (expectedCursor !== undefined) {
            const cur = this.cursors.get(cp.sessionId) ?? 0;
            if (cur !== expectedCursor) {
                throw new StaleCheckpointError(
                    `expected cursor ${expectedCursor}, store has ${cur}`,
                );
            }
        }
        this.data.set(cp.sessionId, serialize(cp));
        this.cursors.set(cp.sessionId, cp.cursor);
    }
}

export class StaleCheckpointError extends Error {
    name = "StaleCheckpointError";
}

// ------------------------------------------------------------
// Crash-recovery helper
// ------------------------------------------------------------
// After load, the transcript may contain assistant.toolCalls without
// matching tool results — the process died mid-execution. The caller
// decides policy: re-invoke (idempotent tools only) or synthesize an
// "aborted" tool result and let the model decide.

export function findOrphanedToolCalls(cp: Checkpoint): Array<{
    toolCallId: string;
    name: string;
}> {
    const answered = new Set<string>();
    for (const m of cp.messages) {
        if (m.role === "tool") answered.add(m.toolCallId);
    }
    const orphans: Array<{ toolCallId: string; name: string }> = [];
    for (const m of cp.messages) {
        if (m.role === "assistant") {
            for (const tc of m.toolCalls) {
                if (!answered.has(tc.id)) orphans.push({ toolCallId: tc.id, name: tc.name });
            }
        }
    }
    return orphans;
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const { newId } = require("./01_message_history") as typeof import("./01_message_history");
    const now = Date.now();

    const cp: Checkpoint = {
        version: CHECKPOINT_VERSION,
        savedAt: now,
        sessionId: "sess_demo",
        cursor: 7,
        messages: [
            { id: newId(), role: "system", createdAt: now, content: "sys" },
            { id: newId(), role: "user",   createdAt: now, content: "hi" },
            {
                id: newId(),
                role: "assistant",
                createdAt: now,
                content: "",
                toolCalls: [{ id: "call_A", name: "get_weather", args: { city: "SF" } }],
                finishReason: "tool_calls",
            },
            // Note: no tool result for call_A — this is the orphan case.
        ],
        meta: { plan: "answering-weather", step: 2 },
    };

    const store = new InMemoryCheckpointStore();

    (async () => {
        await store.save(cp, /* expectedCursor */ 0);
        const loaded = await store.load("sess_demo");
        console.log("round-trip ok:", loaded?.cursor === 7);
        console.log("orphaned tools:", findOrphanedToolCalls(loaded!));

        // Optimistic-concurrency demo
        try {
            await store.save({ ...cp, cursor: 8 }, /* expectedCursor */ 5);
        } catch (e) {
            console.log("stale write rejected:", (e as Error).message);
        }

        // Legacy v1 payload → migrated on load
        const legacy = JSON.stringify({
            version: 1,
            savedAt: now,
            sessionId: "sess_old",
            messages: [],
            plan: "old-style",
        });
        const migrated = deserialize(legacy);
        console.log("migrated:", migrated.version, "meta:", migrated.meta);
    })();
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: When do you write a checkpoint — every event, every turn, or on
 *     an interval?
 *     A: After every state transition that a crash could lose. On the
 *        hot path that's usually: (a) after appending user message,
 *        (b) before tool execution starts, (c) after each tool result.
 *        Coalesce writes if they land within 50–100ms.
 *
 *  Q: The runtime is v3 but a customer has a v1 session in DB. What
 *     goes wrong if migrations are missing?
 *     A: `deserialize` throws "no migration from v1 to v2" and the
 *        session is unresumable. Prevention: CI test that every
 *        historical version deserializes cleanly with representative
 *        fixtures. Migrations are code — cover them with tests.
 *
 *  Q: Two workers save the same session concurrently. What happens?
 *     A: Optimistic-concurrency check on `cursor`. Second writer sees
 *        `StaleCheckpointError`, reloads, replays its own event on top
 *        of the fresh state, retries. Alternative: single-writer queue
 *        keyed by sessionId.
 *
 *  Q: You crashed with an unresolved tool_call. Now what?
 *     A: `findOrphanedToolCalls`. Then policy per tool:
 *          - idempotent (read-only, or has idempotency key) → re-invoke.
 *          - non-idempotent → synthesize `{ok: false, error: "aborted"}`
 *            as the tool result; let the model decide to retry.
 *        NEVER silently re-invoke non-idempotent tools — that's the
 *        double-charge bug.
 *
 *  Q: Storage cost — I have 10M sessions × avg 20KB checkpoint.
 *     A: 200GB, fine on Postgres. Hot recent + cold archive is the
 *        pattern: last 7 days in Postgres, older to S3 Glacier or a
 *        columnar warehouse. Sessions rarely resume >7d later; if they
 *        do, you can afford the extra latency to un-archive.
 */
