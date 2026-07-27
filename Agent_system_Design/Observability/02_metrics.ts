/**
 * ============================================================
 *  02 — Metrics: the "many stories summed" pillar
 * ============================================================
 *
 *  PROBLEM
 *  -------
 *  Traces answer "what happened in THIS request?". Metrics answer
 *  "how is the fleet doing over time?" — SLOs, dashboards, alerts.
 *
 *  You cannot alert on traces. You alert on metrics.
 *  You cannot debug on metrics. You debug on traces.
 *  You do both, correlated by trace_id.
 *
 *  THREE INSTRUMENT TYPES (Prometheus / OpenTelemetry model)
 *  ---------------------------------------------------------
 *    Counter   — monotonically increasing (or reset). "How many?"
 *                e.g. tool_calls_total, llm_errors_total
 *
 *    Gauge     — arbitrary up/down value. "What is it right now?"
 *                e.g. in_flight_requests, queue_depth
 *
 *    Histogram — distribution of samples in buckets. "How long?"
 *                e.g. tool_latency_ms, llm_first_token_ms
 *
 *  There's also Summary (client-side quantiles, avoid unless you
 *  have a reason — buckets aggregate across replicas, quantiles
 *  don't).
 *
 *  LABELS — the #1 way to blow up your monitoring bill
 *  ---------------------------------------------------
 *  Every unique combination of labels = one time series in storage.
 *
 *      tool="get_weather" status="ok"     → series #1
 *      tool="get_weather" status="error"  → series #2
 *      tool="search_web"  status="ok"     → series #3
 *      ...
 *
 *  If you add `user_id` as a label and have 1M users, you now have
 *  1M+ series for a single metric. Prometheus will OOM. Do not do this.
 *
 *  RULE OF THUMB: label cardinality < ~100 per label,
 *                 total series per metric < ~10k.
 *
 *  What agents should measure (starter set):
 *
 *  Counters
 *    agent_turns_total{status}
 *    tool_calls_total{tool, outcome}          outcome: ok|timeout|error|invalid
 *    llm_requests_total{provider, model, outcome}
 *    llm_tokens_total{provider, direction}    direction: input|output
 *
 *  Gauges
 *    agent_active_runs
 *    tool_in_flight{tool}
 *
 *  Histograms
 *    tool_latency_ms{tool}                    fixed buckets
 *    llm_first_token_ms{provider, model}
 *    llm_total_latency_ms{provider, model}
 *    context_tokens{provider}                 prompt token size distribution
 */

// ------------------------------------------------------------
// Instrument types
// ------------------------------------------------------------

export type Labels = Record<string, string>;

/** Serialize labels deterministically so {a,b} and {b,a} share a series. */
function seriesKey(name: string, labels: Labels): string {
    const parts = Object.keys(labels).sort().map((k) => `${k}=${labels[k]}`);
    return `${name}{${parts.join(",")}}`;
}

export class Counter {
    private values = new Map<string, number>();
    constructor(readonly name: string, readonly help: string) {}
    inc(labels: Labels = {}, by = 1): void {
        const k = seriesKey(this.name, labels);
        this.values.set(k, (this.values.get(k) ?? 0) + by);
    }
    snapshot(): Map<string, number> { return new Map(this.values); }
}

export class Gauge {
    private values = new Map<string, number>();
    constructor(readonly name: string, readonly help: string) {}
    set(value: number, labels: Labels = {}): void {
        this.values.set(seriesKey(this.name, labels), value);
    }
    add(delta: number, labels: Labels = {}): void {
        const k = seriesKey(this.name, labels);
        this.values.set(k, (this.values.get(k) ?? 0) + delta);
    }
    snapshot(): Map<string, number> { return new Map(this.values); }
}

/**
 * Bucketed histogram. Each series stores a set of counters for
 * `le` (less-or-equal) upper bounds — exactly what Prometheus stores.
 *
 * Bucket choice matters: if all your latencies are 20–200ms and you
 * have buckets at [1s, 5s, 10s], every request lands in the same
 * bucket and you can't compute a p50. Pick buckets that COVER your
 * actual distribution — geometric progressions are safe defaults.
 */
export class Histogram {
    private counts = new Map<string, number[]>();
    private sums   = new Map<string, number>();
    private totals = new Map<string, number>();

    constructor(
        readonly name: string,
        readonly help: string,
        readonly buckets: number[],
    ) {
        // Buckets must be sorted ascending, and we implicitly add +Inf.
        this.buckets = [...buckets].sort((a, b) => a - b);
    }

    observe(value: number, labels: Labels = {}): void {
        const k = seriesKey(this.name, labels);
        let arr = this.counts.get(k);
        if (!arr) {
            arr = new Array(this.buckets.length + 1).fill(0);
            this.counts.set(k, arr);
        }
        let placed = false;
        for (let i = 0; i < this.buckets.length; i++) {
            if (value <= this.buckets[i]) { arr[i]++; placed = true; break; }
        }
        if (!placed) arr[this.buckets.length]++; // +Inf bucket
        this.sums.set(k, (this.sums.get(k) ?? 0) + value);
        this.totals.set(k, (this.totals.get(k) ?? 0) + 1);
    }

    /** Estimate a quantile from bucket counts. Linear-interp inside a bucket. */
    quantile(q: number, labels: Labels = {}): number | undefined {
        const k = seriesKey(this.name, labels);
        const counts = this.counts.get(k);
        const total = this.totals.get(k) ?? 0;
        if (!counts || total === 0) return undefined;
        const target = q * total;
        let cumulative = 0;
        for (let i = 0; i < counts.length; i++) {
            const prev = cumulative;
            cumulative += counts[i];
            if (cumulative >= target) {
                // For the +Inf bucket, we can't interpolate — return the last finite bound.
                if (i === this.buckets.length) return this.buckets[this.buckets.length - 1];
                const bucketLow  = i === 0 ? 0 : this.buckets[i - 1];
                const bucketHigh = this.buckets[i];
                const bucketFraction = counts[i] === 0 ? 0 : (target - prev) / counts[i];
                return bucketLow + (bucketHigh - bucketLow) * bucketFraction;
            }
        }
        return undefined;
    }

    snapshot(): { counts: Map<string, number[]>; sums: Map<string, number>; totals: Map<string, number> } {
        return {
            counts: new Map(this.counts),
            sums:   new Map(this.sums),
            totals: new Map(this.totals),
        };
    }
}

// ------------------------------------------------------------
// Registry — collect all instruments in one place
// ------------------------------------------------------------

export class MetricsRegistry {
    private counters   = new Map<string, Counter>();
    private gauges     = new Map<string, Gauge>();
    private histograms = new Map<string, Histogram>();

    counter(name: string, help: string): Counter {
        return this.getOrCreate(this.counters, name, () => new Counter(name, help));
    }
    gauge(name: string, help: string): Gauge {
        return this.getOrCreate(this.gauges, name, () => new Gauge(name, help));
    }
    histogram(name: string, help: string, buckets: number[]): Histogram {
        return this.getOrCreate(this.histograms, name, () => new Histogram(name, help, buckets));
    }

    private getOrCreate<T>(map: Map<string, T>, name: string, factory: () => T): T {
        let it = map.get(name);
        if (!it) { it = factory(); map.set(name, it); }
        return it;
    }

    /** Prometheus text-format-ish dump; good enough for demos. */
    dump(): string {
        const out: string[] = [];
        for (const c of this.counters.values()) {
            out.push(`# TYPE ${c.name} counter`);
            for (const [k, v] of c.snapshot()) out.push(`${k} ${v}`);
        }
        for (const g of this.gauges.values()) {
            out.push(`# TYPE ${g.name} gauge`);
            for (const [k, v] of g.snapshot()) out.push(`${k} ${v}`);
        }
        for (const h of this.histograms.values()) {
            out.push(`# TYPE ${h.name} histogram`);
            const snap = h.snapshot();
            for (const [k, counts] of snap.counts) {
                let cum = 0;
                for (let i = 0; i < h.buckets.length; i++) {
                    cum += counts[i];
                    out.push(`${k.replace(/\}$/, `,le="${h.buckets[i]}"}`)}_bucket ${cum}`);
                }
                cum += counts[h.buckets.length];
                out.push(`${k.replace(/\}$/, `,le="+Inf"}`)}_bucket ${cum}`);
                out.push(`${k}_sum   ${snap.sums.get(k)}`);
                out.push(`${k}_count ${snap.totals.get(k)}`);
            }
        }
        return out.join("\n");
    }
}

// ------------------------------------------------------------
// A pre-baked set of agent metrics you'd use in prod.
// ------------------------------------------------------------

export function makeAgentMetrics(reg: MetricsRegistry) {
    return {
        turns:         reg.counter("agent_turns_total", "agent turns completed"),
        toolCalls:     reg.counter("tool_calls_total", "tool calls attempted"),
        llmRequests:   reg.counter("llm_requests_total", "LLM API calls"),
        llmTokens:     reg.counter("llm_tokens_total", "LLM tokens used"),
        activeRuns:    reg.gauge("agent_active_runs", "in-flight agent runs"),
        toolInFlight:  reg.gauge("tool_in_flight", "in-flight tool executions"),
        // Buckets chosen for a p50~50ms, p99~2s workload.
        toolLatency:   reg.histogram(
            "tool_latency_ms", "tool call wall-clock",
            [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
        ),
        llmFirstToken: reg.histogram(
            "llm_first_token_ms", "time to first LLM token",
            [50, 100, 250, 500, 1000, 2000, 5000],
        ),
    };
}

// ------------------------------------------------------------
// Demo
// ------------------------------------------------------------

if (require.main === module) {
    const reg = new MetricsRegistry();
    const m = makeAgentMetrics(reg);

    // Simulate 100 calls to two tools with different latency shapes.
    for (let i = 0; i < 100; i++) {
        // get_weather: fast, mostly ok
        const wLatency = 20 + Math.random() * 40; // 20-60ms
        const wOk = Math.random() < 0.97;
        m.toolCalls.inc({ tool: "get_weather", outcome: wOk ? "ok" : "error" });
        m.toolLatency.observe(wLatency, { tool: "get_weather" });

        // search_web: slower, more errors
        const sLatency = 100 + Math.random() * 900;
        const sOk = Math.random() < 0.85;
        m.toolCalls.inc({ tool: "search_web", outcome: sOk ? "ok" : "timeout" });
        m.toolLatency.observe(sLatency, { tool: "search_web" });
    }

    m.llmRequests.inc({ provider: "openai", model: "gpt-4o", outcome: "ok" }, 100);
    m.llmTokens.inc({ provider: "openai", direction: "input" }, 12345);
    m.llmTokens.inc({ provider: "openai", direction: "output" }, 4567);
    m.activeRuns.set(3);

    console.log("--- Prometheus-style dump (excerpt) ---");
    console.log(reg.dump().split("\n").slice(0, 20).join("\n"), "\n...");

    console.log("\n--- Quantiles ---");
    for (const tool of ["get_weather", "search_web"]) {
        for (const q of [0.5, 0.95, 0.99]) {
            console.log(
                `${tool} p${q * 100}: ${m.toolLatency.quantile(q, { tool })?.toFixed(1)}ms`,
            );
        }
    }
}

/**
 * INTERVIEW FOLLOW-UPS
 * --------------------
 *  Q: Why bucketed histograms instead of storing every sample?
 *     A: Storing every sample means unbounded memory + storage costs.
 *        Buckets are O(1) per observation and aggregate perfectly
 *        across replicas (sum the bucket counts). The trade-off is
 *        that quantiles are estimated, not exact. Bucket choice
 *        matters — bad buckets = useless p99.
 *
 *  Q: Why not use client-side quantiles (t-digest, HDR)?
 *     A: They don't aggregate. Your p99 across 20 replicas is not
 *        "the max of each replica's p99". Buckets can be summed;
 *        percentiles cannot. Use client-side quantiles only for
 *        single-instance dashboards.
 *
 *  Q: What's an SLO and how does it relate to these metrics?
 *     A: SLO = target for user-facing behavior. Example:
 *        "99% of tool calls complete in < 1s over 30 days."
 *        Computed from tool_latency_ms histogram + tool_calls_total.
 *        The error budget (1% × 30d = ~7h) is what tells you when
 *        to slow feature launches and prioritize reliability work.
 *
 *  Q: How do you alert without false positives?
 *     A: Alert on burn rate of the SLO error budget, not on raw
 *        thresholds. Multi-window multi-burn-rate:
 *          - fast: 2% budget burnt in 1h → page
 *          - slow: 5% budget burnt in 6h → ticket
 *        Never alert on averages — they hide bimodal distributions.
 *
 *  Q: My tool_calls_total keeps growing. Do I need to reset it?
 *     A: No. Prometheus + PromQL compute rates from monotonic
 *        counters (`rate(tool_calls_total[5m])`). Resetting on
 *        deploy is fine (the query handles it) but never manually
 *        reset counters — you'll break every query.
 *
 *  Q: Push vs pull collection?
 *     A: Pull (Prometheus): server scrapes /metrics on your app.
 *        Simpler ops, works badly for short-lived jobs.
 *        Push (StatsD, OTLP): app pushes to a collector.
 *        Better for serverless/batch workloads.
 *        Modern OTel supports both; pick what your infra already runs.
 */
