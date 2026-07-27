# Serving & Scaling — Vector-Backed Conversational Memory System

A study guide for system design interviews. Covers the hot/cold vector memory
architecture: Event Stream → Embedder → Hot Index (HNSW) → TTL/Eviction →
Summarization → Cold Store.

---

## 1. Framing the problem (say this in the first 2 minutes)

Before touching architecture, state the shape of the problem out loud —
interviewers reward this:

- **Write-heavy, low-latency ingestion**: every message needs to become
  searchable within (roughly) a second or two of being sent.
- **Read pattern is recency-skewed**: most retrievals are "what did we just
  discuss," not "find anything semantically similar across all history ever."
- **Two very different cost/latency tiers are hiding inside one query**:
  a hot, small, frequently-changing working set, and a cold, huge,
  rarely-changing archive.
- **Core tension**: ANN indexes are good at *either* fast incremental
  writes (HNSW) *or* cheap large-scale storage with training-time batch
  builds (IVF/IVFPQ) — rarely both. The architecture exists specifically to
  get both properties by using two different indexes for two different jobs.

Stating this up front tells the interviewer you're not going to reach for
"one big vector DB" as the answer — the tiering is the design, not an
afterthought.

---

## 2. Query path (the thing to draw first)

```
                     ┌──────────────┐
   user message ───► │   Embedder   │
                     └──────┬───────┘
                            │ query vector
              ┌─────────────┼─────────────┐
              ▼                           ▼
     ┌────────────────┐          ┌──────────────────┐
     │  Hot Index      │          │  Cold Index       │
     │  (HNSW, per-user│          │  (IVF/IVFPQ,      │
     │   shard)        │          │   sharded)        │
     └────────┬────────┘          └─────────┬────────┘
              │ top-k hot                    │ top-k cold
              └─────────────┬────────────────┘
                            ▼
                   ┌──────────────────┐
                   │ Merge + Re-rank  │
                   └──────────────────┘
                            │
                            ▼
                     results to agent
```

**Key decisions to narrate:**

1. **Fan-out in parallel, not sequential.** Searching cold only on a hot
   miss adds cold's tail latency to every miss, and misses cases where cold
   has a better match than hot even when hot has *some* match.
2. **Merging isn't concatenation.** Approaches, roughly in order of
   sophistication:
   - Take raw top-k from each, concatenate, sort by score. Simple, but
     under-weights hot results that are contextually important but not the
     top semantic match.
   - Apply a recency-boost multiplier to hot scores before merging
     (`score * decay(age)`).
   - Take top-k from each side as *candidates* (say 20–40 total), then
     re-rank with a more expensive cross-encoder — affordable now because
     you're re-ranking dozens, not millions.

---

## 3. Scaling the Hot Index (HNSW)

### 3.1 Why HNSW doesn't shard the "normal" way

Classic distributed ANN search assumes you want to search *across* all
vectors regardless of which node they live on — this requires either
scatter-gather across shards (expensive) or a genuinely distributed graph
(hard; HNSW graphs don't split/merge cleanly across machines because graph
navigation depends on globally-reachable neighbor links).

### 3.2 The trick: shard by user/tenant, not by vector similarity

Because memory recall is scoped to *one user's own history*, you never
need cross-user similarity search. This turns a hard distributed-ANN
problem into an easy routing problem:

- Each user (or conversation) gets its own small, independent HNSW graph.
- A routing layer (consistent hashing on `user_id`, or a simple
  shard-map service) sends each query straight to the right shard/node.
- No scatter-gather, no cross-shard merge needed for the hot tier at all.

**Say this explicitly in an interview**: "I'm avoiding the open problem of
distributed HNSW by scoping the index per tenant — this is a legitimate
simplification because the access pattern never requires cross-tenant
search."

### 3.3 Bounding the size

TTL keeps each shard small by construction (e.g., "last 7 days" caps how
much a single user's graph can grow). This means:

- Insertion stays cheap (HNSW insertion cost grows with graph size/degree,
  not dataset-wide size, since it's per-shard).
- Many small graphs can be packed onto one node — capacity planning becomes
  "how many concurrent small graphs fit in RAM on this instance," not
  "can one graph hold the whole dataset."

### 3.4 Replication

Because per-user read/write volume is naturally low, replicate for
**availability**, not throughput. You don't need N replicas to handle QPS
for a single user — you need at least 2 to survive a node failure without
losing that user's hot memory.

### 3.5 Handling hot-shard skew

Some users (or bots, or heavy accounts) will generate far more messages
than others — a classic power-law tail. Mitigations to mention:

- Cap hot-shard size independent of TTL (evict oldest-first once a size
  ceiling is hit, even if TTL hasn't expired) to bound worst-case memory
  per shard.
- Consider a secondary shard key (e.g., `user_id + day-bucket`) if a single
  user's volume alone can overwhelm a shard.

---

## 4. Scaling the Cold Store (IVF / IVFPQ)

This is a much more conventional large-scale-search scaling problem — say
so, and move faster here in an interview so you have time for the hot tier
and merge logic (where the interesting judgment calls live).

- **True horizontal sharding is fine** — partition by vector-ID range,
  hash of user/time-bucket, or IVF cluster range. Cold reads tolerate
  scatter-gather latency because they're not blocking a live conversation
  turn as tightly.
- **Read replicas for throughput** — cold store is read-heavy, and writes
  arrive in batches (via the periodic reindex job), not per-event, so
  read/write contention is naturally low.
- **Compression matters here, not in hot tier.** IVFPQ (quantized vectors)
  beats IVFFlat at this scale — cold store holds orders of magnitude more
  data, and a small accuracy loss per vector is an acceptable trade for
  the memory savings. (Connects back to earlier discussion: "Flat" stores
  raw vectors; PQ compresses them via product quantization.)
- **Reindexing is a batch job, not a live mutation.** Build the new index
  offline, then atomically swap it in. Costs 2x storage briefly during the
  swap, but avoids any query-time disruption or read/write races.

---

## 5. Scaling the Embedder

Often the actual bottleneck and easy to skip past in the diagram — call
this out, interviewers like it when you flag hidden bottlenecks.

- **Batching**: accumulate events for a short window (tens of ms) before
  calling the embedding model — throughput on batched GPU inference is far
  better than one-at-a-time calls.
- **Queue as a buffer**: the event stream (e.g., Kafka or similar) naturally
  decouples bursty ingestion from steady embedding throughput — mention this
  explicitly as the reason the "Event Stream" box exists as a distinct
  component rather than embedding being called directly inline.
- **Horizontal scaling behind the queue**: multiple embedder workers consume
  from the same stream/partition set, so throughput scales with worker count.

---

## 6. Failure modes & resilience (a section interviewers love probing)

| Failure | Why it's contained | What breaks if you *didn't* design it this way |
|---|---|---|
| One hot-shard node dies | Only that subset of users lose hot recall; replicas fail over | A monolithic hot index dying takes down memory for *everyone* |
| TTL sweep is slow | Runs per-shard, lightweight, independently schedulable | A single global compaction pass over one giant index would stall live queries |
| Embedder backlog spikes | Queue absorbs the burst; hot index just sees delayed inserts | Without a queue, burst traffic directly overloads the embedding service and cascades into request failures |
| Cold reindex job fails mid-way | Old index still serving; new index just doesn't swap in | In-place reindexing could leave cold store in a half-updated, inconsistent state |
| A user's hot shard grows unexpectedly large | Size-cap eviction bounds worst case | Pure TTL-based eviction alone doesn't protect against a burst of activity within the TTL window |

---

## 7. Capacity estimation (bring numbers, even rough ones)

Interviewers care less about precision and more about whether you can
reason quantitatively. Rough back-of-envelope approach:

- **Users**: assume, e.g., 10M active users, avg 50 messages/day retained
  in hot tier (7-day TTL) → ~350 messages/user in hot tier at steady state.
- **Vector size**: e.g., 768-dim float32 embedding ≈ 3KB raw. HNSW overhead
  (graph edges/metadata) commonly adds 1.5–2x on top of raw vector size —
  so budget ~5–6KB/vector in the hot tier.
- **Hot tier footprint**: 10M users × 350 vectors × ~6KB ≈ ~21TB total
  across the whole hot tier — distributed across many small per-user
  shards, not one graph.
- **Per-node capacity**: if a node holds, say, 64GB usable for hot-shard
  data, that's roughly ~10M vectors worth of shards per node (order of
  magnitude) → gives you a rough node count for the hot tier.
- **QPS**: estimate concurrent active conversations (not total users) to
  size query throughput — hot tier QPS tracks *active* sessions, not total
  registered users.
- **Cold store**: assume it holds everything ever evicted, potentially
  summarized/compressed — so its growth rate is slower than raw message
  volume, and IVFPQ compression (e.g., 8–16x reduction vs. raw float32)
  matters a lot here for the multi-year storage cost.

State assumptions out loud as you go ("let's say 10M DAU, and I'll assume
~50 messages/day — tell me if you want different numbers") — this is more
valuable to the interviewer than getting an exact number right.

---

## 8. Common interview follow-up questions (rehearse these)

1. **"Why not just use one index for everything?"**
   → No single ANN structure is simultaneously cheap-to-write-to-frequently
   (like HNSW) *and* cheap-to-store-at-huge-scale-with-compression (like
   IVFPQ). The tiering exists to get both properties by paying for each
   only where it's needed.

2. **"What if a query genuinely needs cross-user search (e.g., admin
   analytics)?"**
   → That's a different access pattern with different latency requirements
   — it should hit a separate, purpose-built index (or the cold store
   directly, batch-style), not the per-user hot shards. Good to flag this
   as an explicit non-goal of the hot tier's design.

3. **"How do you keep hot and cold consistent — could you retrieve
   duplicate or contradictory info from both tiers?"**
   → Once an event is evicted from hot, it should be marked evicted
   atomically as part of the same job that summarizes/writes it to cold
   (or at least idempotent enough that a brief overlap window is
   tolerable) — small consistency windows are usually acceptable given the
   summarized cold version isn't meant to be byte-identical anyway.

4. **"What happens if the embedder is down?"**
   → Event stream buffers writes (this is exactly why it's a queue and not
   a direct call) — reads against existing hot/cold indexes are unaffected;
   only *new* memory stops being ingested until the embedder recovers.

5. **"How would you evaluate whether this system is working well?"**
   → Recall@k against a labeled "should have retrieved X" set, tail
   latency (p95/p99) for the merged hot+cold query, hot-tier hit rate
   (how often the answer was in hot vs. required cold), and eviction/TTL
   tuning validated against real recall regressions when memory expires.

---

## 9. One-paragraph summary (say this if asked to recap)

"I split memory into a fast, small, per-user HNSW index for recent activity
— since HNSW supports incremental writes without retraining — and a large,
compressed, batch-rebuilt IVF-style index for everything older, since that
data is read far more than written and benefits from compression. Queries
fan out to both in parallel and get merged with a recency-aware re-rank.
Sharding hot indexes by user avoids the hard distributed-HNSW problem
entirely, since cross-user search is never required for this use case."