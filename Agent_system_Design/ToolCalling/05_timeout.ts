/**
 * ============================================================
 *  05 — Tool Timeouts with AbortController
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  A tool that hangs will hang the whole agent. We need bounded
 *  execution: if a tool exceeds its budget, cancel it and return
 *  a timeout error to the caller.
 *
 *  Naïve approach — `Promise.race([task, timer])`.
 *  Problem: the loser is orphaned. If `task` is an HTTP call, the
 *  socket stays open, and if it eventually succeeds you may cause
 *  a real-world side effect (charge a card, send an email) even
 *  though the agent already told the model "timeout".
 *
 *  CORRECT PATTERN
 *  ---------------
 *  Use an `AbortController` for cooperative cancellation. Any
 *  well-behaved async API (`fetch`, `child_process.spawn`, DB
 *  drivers, `stream.pipeline`) accepts an `AbortSignal` and will
 *  release resources when it aborts.
 *
 *  Even better: LINK signals. If the parent request is cancelled
 *  (user closed the tab), all children abort too — no orphan work.
 *
 *  Node 18+ ships `AbortSignal.timeout(ms)` and `AbortSignal.any([...])`.
 *  We implement equivalents by hand so this stays self-contained and
 *  the mechanics are visible.
 */

/**
 * Run `fn` with a signal that aborts after `timeoutMs` OR when
 * `parentSignal` aborts, whichever comes first.
 *
 *   ┌──────────────┐    ┌──────────────┐
 *   │ timeoutSignal│    │ parentSignal │
 *   └──────┬───────┘    └──────┬───────┘
 *          └────────┬──────────┘
 *                   ▼
 *              linkedSignal  → passed to fn(signal)
 */
export function withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    parentSignal?: AbortSignal,
): Promise<T> {
    const controller = new AbortController();
    const linked = controller.signal;

    // If parent already aborted, we're done before we start.
    if (parentSignal?.aborted) {
        controller.abort(parentSignal.reason);
        return Promise.reject(abortError("aborted by parent"));
    }

    // Propagate parent → linked
    const onParentAbort = () => controller.abort(parentSignal!.reason);
    parentSignal?.addEventListener("abort", onParentAbort, { once: true });

    // Timeout → linked
    const timer = setTimeout(() => {
        controller.abort(abortError(`tool exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    // Don't keep the Node event loop alive just for the timer.
    // (Node-only; harmless no-op in browsers.)
    if (typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as { unref: () => void }).unref();
    }

    // Cleanup on either outcome.
    const cleanup = () => {
        clearTimeout(timer);
        parentSignal?.removeEventListener("abort", onParentAbort);
    };

    return fn(linked).then(
        (v) => { cleanup(); return v; },
        (e) => {
            cleanup();
            // If we aborted, surface a normalized AbortError so callers
            // can distinguish "timeout" from "handler threw".
            if (linked.aborted && !isAbortError(e)) throw abortError(reasonToString(linked.reason));
            throw e;
        },
    );
}

function abortError(message: string): Error {
    // DOMException("...", "AbortError") is the web-standard shape,
    // and Node's fetch throws exactly this. We mirror it.
    if (typeof DOMException !== "undefined") {
        return new DOMException(message, "AbortError");
    }
    const e = new Error(message);
    e.name = "AbortError";
    return e;
}

function isAbortError(e: unknown): boolean {
    return !!e && typeof e === "object" && (e as { name?: string }).name === "AbortError";
}

function reasonToString(r: unknown): string {
    if (!r) return "aborted";
    if (r instanceof Error) return r.message;
    return String(r);
}

// ------------------------------------------------------------
// Demo — shows all four outcomes:
//   1. success within budget
//   2. tool timeout
//   3. parent abort propagates
//   4. handler throws its own error
// ------------------------------------------------------------

if (require.main === module) {
    const sleep = (ms: number, signal: AbortSignal) =>
        new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, ms);
            signal.addEventListener("abort", () => {
                clearTimeout(t);
                reject(abortError(reasonToString(signal.reason)));
            }, { once: true });
        });

    async function main() {
        // 1) success
        console.log("1:", await withTimeout(async () => "ok", 100).catch(String));

        // 2) timeout
        try {
            await withTimeout(async (s) => { await sleep(500, s); return "nope"; }, 50);
        } catch (e) {
            console.log("2:", (e as Error).name, (e as Error).message);
        }

        // 3) parent abort
        const parent = new AbortController();
        setTimeout(() => parent.abort("user cancelled"), 20);
        try {
            await withTimeout(
                async (s) => { await sleep(500, s); return "nope"; },
                10_000,
                parent.signal,
            );
        } catch (e) {
            console.log("3:", (e as Error).name, (e as Error).message);
        }

        // 4) handler-thrown error survives
        try {
            await withTimeout(async () => { throw new Error("business error"); }, 100);
        } catch (e) {
            console.log("4:", (e as Error).name, (e as Error).message);
        }
    }
    main();
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: What if the tool ignores the signal?
 *     A: Then `withTimeout` throws AbortError but the tool keeps
 *        running in the background. You've lost isolation. Fixes:
 *          - wrap the tool in a Worker/child_process you can kill;
 *          - refuse to register tools that don't accept a signal;
 *          - budget resources at the OS level (cgroup, ulimit).
 *
 *  Q: Node has `AbortSignal.timeout()` and `AbortSignal.any()` —
 *     why write this?
 *     A: In a real codebase, use them. Writing it out reveals the
 *        contract: linking = forward the abort event + cleanup
 *        listeners. Interviewers love seeing the cleanup path.
 *
 *  Q: Does `fetch` really cancel the network call?
 *     A: Yes, since Node 18. The TCP socket is closed. But the *server*
 *        may still process the request — cancellation is client-side.
 *        Design idempotent server APIs.
 *
 *  Q: Timeouts inside a retry loop?
 *     A: Timer starts anew for each retry, but the whole retry must
 *        respect a "deadline" (overall budget). The pattern is:
 *          deadline = Date.now() + overallBudget
 *          per-attempt timeout = min(base, deadline - now())
 */
