/**
 * ============================================================
 *  06 — Tool Registry Pattern
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Once you have >1 tool, you need a place to:
 *    - register tools at boot
 *    - look them up by name
 *    - list them (as schemas) for the LLM
 *    - enforce cross-cutting concerns: validation, auth, quotas,
 *      logging, feature-flagging, hot-reload
 *
 *  The registry is that central place. Think of it as a DI container
 *  for tools.
 *
 *  DESIGN
 *  ------
 *  A Tool = { definition, handler, guards? }
 *
 *  Registry responsibilities (in order of importance):
 *    1. `register(tool)` — reject duplicates, reject invalid names.
 *    2. `list()` — returns the JSON schemas to embed in the LLM call.
 *    3. `invoke(name, args, ctx)` — validate → guard → execute → wrap.
 *    4. `unknown_tool` handling — never throws; returns a structured
 *       error the LLM can read.
 *
 *  Cross-cutting is done with a MIDDLEWARE chain (Koa/Express style)
 *  because it composes cleanly. Each middleware sees the invocation
 *  and can short-circuit.
 */

import { ToolDefinition, JsonSchema, validate } from "./01_schema";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface InvocationContext {
    /** Who is calling? Used for auth, quotas, audit logs. */
    userId?: string;
    /** Correlates all tool calls from one user request. */
    requestId: string;
    /** Cancels the entire request. */
    signal?: AbortSignal;
    /** Free-form logger. */
    log: (fields: Record<string, unknown>) => void;
}

export type ToolHandler = (
    args: Record<string, unknown>,
    ctx: InvocationContext,
) => Promise<unknown>;

export interface Tool {
    definition: ToolDefinition;
    handler: ToolHandler;
    /** Optional per-tool policies. */
    policy?: {
        /** Max concurrent invocations of THIS tool (default: unlimited). */
        maxConcurrency?: number;
        /** Timeout override; batch runner still applies a global cap. */
        timeoutMs?: number;
        /** Required capability the caller must have. */
        requiredScope?: string;
    };
}

export type InvocationResult =
    | { ok: true; value: unknown }
    | { ok: false; error: { kind: string; message: string; details?: unknown } };

export type Middleware = (
    inv: { name: string; args: Record<string, unknown>; ctx: InvocationContext; tool: Tool },
    next: () => Promise<InvocationResult>,
) => Promise<InvocationResult>;

// ------------------------------------------------------------
// Registry
// ------------------------------------------------------------

const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export class ToolRegistry {
    private tools = new Map<string, Tool>();
    private middleware: Middleware[] = [];
    /** Live count of in-flight invocations per tool (for maxConcurrency). */
    private inFlight = new Map<string, number>();

    register(tool: Tool): void {
        const name = tool.definition.function.name;
        if (!NAME_RE.test(name)) {
            throw new Error(`invalid tool name: ${name}`);
        }
        if (this.tools.has(name)) {
            throw new Error(`tool already registered: ${name}`);
        }
        // Sanity: top-level schema must be an object.
        if (tool.definition.function.parameters.type !== "object") {
            throw new Error(`tool ${name}: parameters.type must be "object"`);
        }
        this.tools.set(name, tool);
    }

    /** Batch registration is a common convenience. */
    registerAll(tools: Tool[]): void {
        for (const t of tools) this.register(t);
    }

    unregister(name: string): boolean {
        return this.tools.delete(name);
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }

    /** What we ship to the LLM in the `tools` field of the request. */
    list(): ToolDefinition[] {
        return Array.from(this.tools.values()).map((t) => t.definition);
    }

    /** Attach cross-cutting logic (auth, rate-limits, tracing, ...). */
    use(mw: Middleware): void {
        this.middleware.push(mw);
    }

    /** Main entry point used by the executor. */
    async invoke(
        name: string,
        args: Record<string, unknown>,
        ctx: InvocationContext,
    ): Promise<InvocationResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            // NEVER throw — the model hallucinated a tool name.
            return {
                ok: false,
                error: {
                    kind: "unknown_tool",
                    message: `no tool named "${name}"`,
                    details: { available: Array.from(this.tools.keys()) },
                },
            };
        }

        // Build the middleware pipeline. Terminal step = actual execution.
        const terminal = () => this.execute(tool, args, ctx);
        const chain = this.middleware.reduceRight<() => Promise<InvocationResult>>(
            (next, mw) => () => mw({ name, args, ctx, tool }, next),
            terminal,
        );
        return chain();
    }

    private async execute(
        tool: Tool,
        args: Record<string, unknown>,
        ctx: InvocationContext,
    ): Promise<InvocationResult> {
        // 1. Schema validation at the trust boundary.
        const errors = validate(args, tool.definition.function.parameters);
        if (errors.length) {
            return {
                ok: false,
                error: { kind: "invalid_arguments", message: "schema validation failed", details: errors },
            };
        }

        // 2. Per-tool concurrency cap.
        const cap = tool.policy?.maxConcurrency;
        if (cap !== undefined) {
            const cur = this.inFlight.get(tool.definition.function.name) ?? 0;
            if (cur >= cap) {
                return {
                    ok: false,
                    error: { kind: "rate_limited", message: `maxConcurrency=${cap} reached` },
                };
            }
        }

        const name = tool.definition.function.name;
        this.inFlight.set(name, (this.inFlight.get(name) ?? 0) + 1);
        const started = Date.now();
        try {
            const value = await tool.handler(args, ctx);
            return { ok: true, value };
        } catch (e) {
            return {
                ok: false,
                error: {
                    kind: "handler_error",
                    message: (e as Error).message,
                },
            };
        } finally {
            this.inFlight.set(name, (this.inFlight.get(name) ?? 1) - 1);
            ctx.log({
                event: "tool.invoke",
                tool: name,
                latencyMs: Date.now() - started,
            });
        }
    }
}

// ------------------------------------------------------------
// Reusable middleware
// ------------------------------------------------------------

/** Enforces `policy.requiredScope` against a caller-provided capability set. */
export function authMiddleware(
    getScopes: (ctx: InvocationContext) => Set<string>,
): Middleware {
    return async (inv, next) => {
        const scope = inv.tool.policy?.requiredScope;
        if (scope && !getScopes(inv.ctx).has(scope)) {
            return {
                ok: false,
                error: { kind: "forbidden", message: `missing scope: ${scope}` },
            };
        }
        return next();
    };
}

/** Structured request/response logs. Useful for offline analysis. */
export const traceMiddleware: Middleware = async (inv, next) => {
    inv.ctx.log({ event: "tool.request", tool: inv.name, args: inv.args });
    const res = await next();
    inv.ctx.log({ event: "tool.response", tool: inv.name, ok: res.ok });
    return res;
};

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const registry = new ToolRegistry();
    registry.use(traceMiddleware);
    registry.use(authMiddleware(() => new Set(["weather:read"])));

    registry.register({
        definition: {
            type: "function",
            function: {
                name: "get_weather",
                description: "Get weather for a city.",
                parameters: {
                    type: "object",
                    required: ["city"],
                    additionalProperties: false,
                    properties: {
                        city: { type: "string", minLength: 1 } as JsonSchema,
                    },
                },
            },
        },
        policy: { requiredScope: "weather:read", maxConcurrency: 4 },
        handler: async ({ city }) => ({ city, tempC: 18 }),
    });

    const ctx: InvocationContext = {
        requestId: "req_1",
        log: (f) => console.log(JSON.stringify(f)),
    };

    (async () => {
        console.log("ok:      ", await registry.invoke("get_weather", { city: "SF" }, ctx));
        console.log("bad args:", await registry.invoke("get_weather", {}, ctx));
        console.log("unknown: ", await registry.invoke("no_such_tool", {}, ctx));
    })();
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why middleware instead of hard-coding auth/logging?
 *     A: Composability. Different agents may have different policies
 *        (public assistant vs. internal admin). Middleware lets each
 *        deployment assemble its own pipeline without forking the code.
 *
 *  Q: How do you hot-reload tools without a redeploy?
 *     A: The registry is just an in-memory Map. On config change,
 *        atomically swap the underlying map (or use copy-on-write).
 *        Tools that were "in flight" during the swap keep running
 *        because they hold their handler reference.
 *
 *  Q: Should tool schemas be versioned?
 *     A: Yes — argument shapes drift. Common approach: bake the
 *        version into the tool name (`get_weather_v2`) and let the
 *        model naturally migrate as you update the system prompt.
 *
 *  Q: What about MCP (Model Context Protocol)?
 *     A: MCP is essentially a network-transport version of this
 *        registry: tools live on a remote server, discovered at
 *        connect time. Our in-process registry is the mental
 *        model; MCP just adds RPC.
 *
 *  Q: Namespacing / collisions?
 *     A: Prefix tool names when merging registries (`fs::read_file`,
 *        `http::get`). Enforce this at register-time.
 */
