// This includes 3 types:
// Procedural Memory: This type of memory is responsible for storing information about how to perform tasks and actions. It includes skills, habits, and routines that are learned through practice and repetition. Procedural memory is often unconscious and automatic, allowing individuals to perform tasks without conscious thought.
// Semantic Memory: This type of memory is responsible for storing general knowledge and facts about the world. It includes information about concepts, meanings, and relationships between different pieces of information. Semantic memory is often conscious and can be accessed intentionally, allowing individuals to recall information when needed.

// Episodic Memory: This type of memory is responsible for storing personal experiences and events that have occurred in an individual's life. It includes information about specific times, places, and emotions associated with those experiences. Episodic memory is often conscious and can be accessed intentionally, allowing individuals to recall past events and experiences.

interface EpisodicMemory {
    id: string;
    timestamp: Date;
    content: string;
    userId: string;
    summary: string;
}

interface SemanticMemory{
    id: string;
    content: string;
    userId: string;
    summary: string;
    source: string;
    embedding: number[];
}

async function storeEpisodicMemory(id: string, timestamp: Date, content: string, userId: string, db: D1Database): Promise<void> {
    const summary = await callLLM([{
        role: 'user',
        content: `Please summarize the following content into a concise summary:\n\n${content}`
    }]);

    await db.prepare(
        'INSERT INTO episodic_memory (id, timestamp, content, userId, summary) VALUES (?, ?, ?, ?, ?)').bind(
        id, timestamp, content, userId, summary
    ).run();
    console.log('Storing episodic memory:', { id, timestamp, content, userId, summary });
}


// insert into semantic memory table with embedding vector for semantic search
async function storeSemanticMemory(
  id: string, 
  content: string, 
  userId: string, 
  source: string, 
  db: D1Database,
  vectorIndex: VectorizeIndex // Inject the vector engine dependency
): Promise<void> {
  
  // Step A: Calculate the vector geometry
  const embedding = await getEmbedding(content);

  // Step B: Write text & metadata into SQL for relational queries
  await db.prepare(
    'INSERT INTO semantic_memory (id, content, userId, source) VALUES (?, ?, ?, ?)'
  ).bind(id, content, userId, source).run();

  // Step C: Write the geometric array to the vector index for fast similarity lookups
  await vectorIndex.insert([{
    id: id,
    values: embedding,
    metadata: { userId, source } // Tenant isolation filter at the database level
  }]);

  console.log('✅ Storing semantic memory & indexing vector arrays:', { id, userId, source });
}

