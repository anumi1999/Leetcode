# Serving & Scaling — General System Design Guide

Applies to any system that serves results from a large corpus under a
latency budget: search, recommendations, ads, ranking, retrieval, feature
lookups. Use this as the general toolkit; apply the specific pieces to
whatever problem you're given.

---

## 1. The Two-Stage (Multi-Stage) Serving Architecture

This is the single most reusable pattern in serving system design. It shows
up under different names — "candidate generation + ranking," "retrieval +
re-rank," "L1/L2," "coarse + fine" — but it's always the same idea.

### 1.1 Why it exists

You have two conflicting requirements:
- **Precision**: you want the *best* result, which usually needs an
  expensive scoring function (a large model, a cross-encoder, a complex
  feature set).
- **Latency/cost**: you can't run that expensive function against millions
  or billions of candidates within your latency budget.

The fix is to never apply the expensive function to the full corpus —
apply it only to a small shortlist produced by something cheap.

### 1.2 The generic shape

```
Full corpus (millions–billions)
        │
        ▼
┌───────────────────┐
│  Stage 1: Retrieval / Candidate Generation │
│  cheap, approximate, high recall           │
└─────────┬─────────────────────────────────┘
          │  shortlist (hundreds–low thousands)
          ▼
┌───────────────────┐
│  Stage 2: Ranking / Scoring                │
│  expensive, precise, high precision        │
└─────────┬─────────────────────────────────┘
          │  final results (tens)
          ▼
      returned to user
```

- **Stage 1 optimizes for recall** — "don't miss the good candidates,"
  even if it lets some junk through. Cheap approximate methods: ANN index
  (HNSW/IVF), inverted index (BM25), simple embedding dot-product, rule-based
  filters.
- **Stage 2 optimizes for precision** — "of what stage 1 gave me, rank it
  well." Can afford an expensive model here specifically *because* the
  candidate set is now small (hundreds, not millions).

### 1.3 Sometimes it's 3 stages, not 2

Large-scale systems (think ads auctions, feed ranking) often add a middle
tier:

```
Retrieval (millions → thousands)
   → Pre-ranking / lightweight scoring (thousands → hundreds)
      → Full ranking (hundreds → tens)
         → (sometimes) Re-ranking / business logic (diversity, dedup, ads mix)
```

Each stage trades a bit more compute per item for a smaller candidate set,
until the final stage can afford the most expensive model on a a small
shortlist. Naming this explicitly ("I'd add a lightweight pre-ranker between
retrieval and full ranking if the candidate set from retrieval is still too
big for the ranking model's latency budget") signals maturity in an
interview.

### 1.4 Generic examples of "what plays each role"

| Domain | Stage 1 (retrieval) | Stage 2 (ranking) |
|---|---|---|
| Search | Inverted index / BM25 / ANN over embeddings | Learning-to-rank model, cross-encoder |
| Recommendations | ANN over user/item embeddings, collaborative filtering candidate sets | Deep ranking model with rich features (user, item, context) |
| Ads | Eligibility filters + lightweight CTR model | Full auction-value model (predicted CTR × bid × relevance) |
| Vector memory (our earlier example) | Hot HNSW + cold IVF search | Cross-encoder re-rank of merged candidates |

---

## 2. Infrastructure Layers

Regardless of domain, a serving system's infrastructure tends to decompose
into the same layers. Walking through these layer by layer is a strong
way to structure an interview answer.

### 2.1 Ingestion / write path
- How new data enters the system (batch job, streaming event, user action).
- Decoupled from the read path via a **queue** (Kafka, Kinesis, pub/sub) —
  this absorbs bursty writes so the serving path isn't directly coupled to
  ingestion spikes.

### 2.2 Feature/embedding computation
- Wherever raw data becomes the representation used for retrieval/ranking
  (embeddings, feature vectors).
- Often the actual bottleneck (model inference cost) — batch here for
  throughput.
- Split into **online** (computed at request time — user/session context)
  vs. **offline/batch** (computed ahead of time — item embeddings, static
  features) is a critical distinction to raise: don't recompute at request
  time anything that could've been precomputed.

### 2.3 Index / storage layer
- Whatever structure stage 1 queries against (ANN index, inverted index,
  key-value feature store).
- Choice here follows the same read/write tradeoff we covered for
  HNSW vs. IVF: does this layer need fast incremental writes, or is it
  read-heavy and batch-updated?

### 2.4 Serving layer / model servers
- Stateless services that run the ranking model(s), typically horizontally
  scaled behind a load balancer.
- Common pattern: separate fleets for stage 1 and stage 2, since they have
  very different resource profiles (stage 1 = memory/index-heavy, stage 2 =
  compute/GPU-heavy) — scaling them together wastes resources.

### 2.5 Caching layer
- Cache hot queries, hot candidates, or hot feature lookups — placed in
  front of whichever layer is most expensive per call.
- Cache invalidation strategy matters: TTL-based (simple, staleness risk)
  vs. event-driven invalidation (more accurate, more complex).

### 2.6 Orchestration / fan-out layer
- The service that calls stage 1, then stage 2, aggregates, and applies
  final business logic (dedup, diversity, filtering) before responding.
- This is usually where **timeouts and partial-result handling** live —
  see latency budgeting below.

---

## 3. Latency Budgeting

This is the section interviewers use to test whether you can turn "make it
fast" into actual numbers and tradeoffs.

### 3.1 Start from the total budget, work backward

If the end-to-end SLA is, say, 200ms p99:

```
Total budget: 200ms
├── Network/gateway overhead:      ~10ms
├── Stage 1 (retrieval):           ~30-50ms
├── Stage 2 (ranking):             ~80-100ms
├── Aggregation/business logic:    ~10-20ms
└── Buffer/safety margin:          ~20ms
```

Always reserve a safety margin — real systems have variance, and a budget
with zero slack means any single slow dependency blows the SLA.

### 3.2 p50 vs. p99 — say both, not just average

- **Average latency hides tail behavior.** A system with 50ms average but
  a 2-second p99 will feel broken to a meaningful fraction of users.
  Always discuss p95/p99, not mean, when talking about latency targets.
- **Tail latency often comes from stragglers** — one slow shard in a
  scatter-gather query drags down the whole response. Mitigations:
  - **Hedged requests**: fire a duplicate request to a second replica if
    the first hasn't responded within some threshold, take whichever
    returns first.
  - **Timeouts with partial results**: if stage 1 or a shard doesn't
    respond in time, proceed with whatever came back rather than blocking
    the whole request — degrade gracefully instead of failing entirely.

### 3.3 Where latency is typically spent (and how to cut it)

| Source | Typical fix |
|---|---|
| Too many candidates reaching an expensive stage | Add a cheaper pre-filter/pre-rank stage |
| Cold cache / cold start | Pre-warm caches for known-hot keys; background refresh before TTL expiry |
| Network hops between services | Colocate frequently-chained services; batch calls instead of N sequential round-trips |
| Slow single shard (straggler) | Hedged requests, timeout + partial results, replica diversity |
| Model inference itself is heavy | Distillation/smaller model for stage 2, quantization, batching requests to the model server |
| Serialization/deserialization overhead | Compact binary formats (protobuf) over JSON for internal calls |

### 3.4 Sync vs. async in the critical path

Anything not needed to answer the current request should be **moved off
the synchronous critical path**:
- Logging, analytics events, async model feedback/training signals →
  fire-and-forget or queue-based, never blocking the response.
- Only things the response *directly depends on* (retrieval, ranking,
  the minimum business logic) stay synchronous.

---

## 4. Scaling Strategies (the generic menu)

### 4.1 Horizontal vs. vertical
- Prefer horizontal scaling (more instances) for stateless services
  (rankers, orchestration layer) — trivially elastic.
- Stateful layers (indexes, databases) need explicit sharding/partitioning
  strategy — this is where most of the interesting design decisions live.

### 4.2 Sharding strategies (pick based on access pattern, always justify the choice)
- **By key/tenant** (e.g., user ID) — good when queries are naturally
  scoped to one entity; avoids cross-shard fan-out entirely. (This was the
  trick in the hot-tier HNSW example — sidesteps distributed-graph search.)
- **By hash** — even load distribution, but any "search across everything"
  query requires scatter-gather across all shards.
- **By range** — useful for time-ordered data (recent vs. old), enables
  easy TTL/archival by dropping whole shards, but risks hot shards if
  traffic isn't uniform across ranges.

### 4.3 Read replicas vs. write scaling
- Replicate for **read throughput** when read:write ratio is high (most
  serving systems are read-heavy).
- Replicate for **availability**, not throughput, when per-entity load is
  naturally low (e.g., per-user shards) — 2-3 replicas to survive node
  failure, not to spread load.

### 4.4 Batch vs. real-time processing tradeoff
- **Batch/offline**: cheaper per unit of work, higher latency to freshness
  (hours), good for large-scale index builds, embedding computation for
  static content, model retraining.
- **Streaming/online**: lower latency to freshness (seconds), more
  operational complexity, needed when "just happened" data must be
  reflected immediately.
- Most real systems are hybrid — this is the deep reason the hot/cold
  tiering pattern exists generically: **hot = streaming-updated, cold =
  batch-updated**, and this split shows up far beyond vector search
  (feature stores, recommendation candidate pools, search indexes all
  split this way).

### 4.5 Caching as a scaling lever, not just a latency lever
- A well-hit cache doesn't just make one request faster — it reduces load
  on the backing store, letting that store handle more total traffic
  without scaling itself.
- Cache placement follows cost, not just frequency: cache whatever is
  most expensive to recompute/refetch, even if it's not the single
  most-frequently-requested item.

---

## 5. A Generic Checklist to Walk Through in Any Serving/Scaling Question

1. **What's the latency SLA, and what's the read/write ratio?** — this
   determines almost everything downstream.
2. **Does this need one stage or two?** — is a single retrieval good
   enough, or does precision demand a re-rank step?
3. **What's cheap vs. expensive, and can the expensive part be deferred to
   a smaller candidate set?**
4. **What can be precomputed offline vs. must happen online?**
5. **What's the natural sharding key, based on the access pattern (not
   just "spread data evenly")?**
6. **Where do replicas serve throughput vs. availability?**
7. **What happens on partial failure — timeout, degrade, hedge?**
8. **What's synchronous vs. can be pushed off the critical path?**
9. **What's the plan for staleness — cache TTL, index reindex cadence,
   replication lag?**

Walking through this list out loud, even briefly, on any "design a serving
system for X" question will cover almost everything an interviewer wants
to hear, regardless of the specific domain.

---

## 6. One-paragraph generic summary (say this if asked to recap the pattern)

"Serving systems generally split into a cheap, high-recall retrieval stage
and an expensive, high-precision ranking stage, so the costly computation
only ever runs on a small shortlist. Infrastructure layers decompose into
ingestion, feature computation, storage/index, serving, caching, and
orchestration — each scaled independently based on its own read/write and
latency profile. Latency budgets get allocated top-down across stages with
a safety margin, tail latency is handled separately from average latency
via hedging/timeouts, and sharding keys are chosen based on the actual
access pattern rather than just for even data distribution."