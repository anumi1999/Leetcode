from langchain_text_splitters import RecursiveCharacterTextSplitter, CharacterTextSplitter

sample_text = """Gate 1: APM ID Requirement
Every assembly deployed to production must have a valid APM ID registered in the ServiceNow CMDB. The APM ID is used for cost tracking, incident routing, and compliance auditing. Without an APM ID, the deployment will be blocked at the gatekeeper level.

Resolution: Go to ServiceNow, create a new application record, and attach the APM ID to your OneOps assembly under the governance section. Contact the platform team at platform-support@walmart.com if you need assistance.

Gate 2: Certificate Expiry
All SSL/TLS certificates must have a minimum validity of 30 days at deployment time. Certificates expiring within 30 days will trigger a warning. Certificates already expired will block the deployment entirely.

The certificate renewal process involves requesting a new certificate from the internal PKI team. The turnaround time is typically 2 business days. For urgent renewals, escalate to the security team via the #cert-renewals Slack channel.

Gate 3: Load Balancer Health Check
Every load balancer component must have an ECV (External Content Verification) configured. The ECV performs a health check against the backend VMs before routing traffic. Without a valid ECV, the load balancer cannot verify that backend services are healthy, leading to potential traffic routing to failed instances.

For HTTPS services, the ECV must use GET https:// format. For HTTP services, use GET /health or a custom health endpoint that returns HTTP 200."""

print("=" * 65)
print("CHUNKING STRATEGIES COMPARISON")
print("=" * 65)

# Strategy 1: Fixed size
print("\n📦 STRATEGY 1: FIXED SIZE")
print("Splits every 300 chars regardless of content")
print("-" * 65)
fixed = CharacterTextSplitter(chunk_size=300, chunk_overlap=50, separator="")
fixed_chunks = fixed.create_documents([sample_text])
print(f"Total chunks: {len(fixed_chunks)}")
for i, c in enumerate(fixed_chunks[:2]):
    print(f"\n  Chunk {i+1} ({len(c.page_content)} chars):")
    print(f"  '{c.page_content[:150]}...'")
print("\n⚠️  Can cut mid-sentence — loses meaning at boundaries")

# Strategy 2: Recursive (thesis used this)
print("\n\n📝 STRATEGY 2: RECURSIVE (your thesis used this)")
print("Tries: paragraph → sentence → word → character")
print("-" * 65)
recursive = RecursiveCharacterTextSplitter(
    chunk_size=300, chunk_overlap=50,
    separators=["\n\n", "\n", ". ", " ", ""]
)
recursive_chunks = recursive.create_documents([sample_text])
print(f"Total chunks: {len(recursive_chunks)}")
for i, c in enumerate(recursive_chunks[:2]):
    print(f"\n  Chunk {i+1} ({len(c.page_content)} chars):")
    print(f"  '{c.page_content[:200]}'")
print("\n✅ Each chunk contains a complete thought")

# Overlap demo
print("\n\n🔗 WHY OVERLAP MATTERS")
print("-" * 65)
no_ov = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=0)
with_ov = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=80)
no_chunks = no_ov.create_documents([sample_text])
ov_chunks = with_ov.create_documents([sample_text])

print("WITHOUT overlap:")
print(f"  Chunk 1 ends:   '...{no_chunks[0].page_content[-60:]}'")
print(f"  Chunk 2 starts: '{no_chunks[1].page_content[:60]}...'")
print()
print("WITH 80 char overlap (your thesis used 200):")
print(f"  Chunk 1 ends:   '...{ov_chunks[0].page_content[-60:]}'")
print(f"  Chunk 2 starts: '{ov_chunks[1].page_content[:60]}...'")
print()
print("✅ With overlap, queries spanning two chunks still find context")

# Summary
print("\n\n📊 COMPARISON TABLE")
print("-" * 65)
fixed_avg = sum(len(c.page_content) for c in fixed_chunks)/len(fixed_chunks)
rec_avg = sum(len(c.page_content) for c in recursive_chunks)/len(recursive_chunks)
print(f"{'Strategy':<25} {'Chunks':<10} {'Avg Size':<15} {'Boundaries'}")
print(f"{'Fixed size':<25} {len(fixed_chunks):<10} {fixed_avg:.0f} chars     ❌ No")
print(f"{'Recursive (thesis)':<25} {len(recursive_chunks):<10} {rec_avg:.0f} chars     ✅ Yes")
print(f"{'Semantic':<25} {'varies':<10} {'varies':<15} ✅ Best")
print(f"{'Token-based':<25} {'varies':<10} {'~75 words':<15} ✅ Yes")

print("\n\n💡 INTERVIEW ANSWER (Eightfold)")
print("=" * 65)
print("""For HR policy RAG, I'd use RecursiveCharacterTextSplitter
with chunk_size=1000, chunk_overlap=200.

Why recursive over fixed: Policy sections stay intact —
a chunk about certificate renewal won't be split mid-sentence,
so the LLM gets complete context for compliance assessment.

Why 200 char overlap: Sentences near boundaries appear in
both adjacent chunks. A query about 'certificate expiry 30 days'
retrieves the right chunk regardless of where that phrase falls.

At larger scale (millions of resumes), I'd switch to semantic
chunking — split when topic changes, not at fixed size.
Better retrieval quality but needs embedding model at chunk time.""")