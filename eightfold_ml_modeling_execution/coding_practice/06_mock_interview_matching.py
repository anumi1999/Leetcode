"""
MOCK INTERVIEW: Resume-to-Job Matching System
=============================================
This simulates an actual Eightfold interview coding prompt.

TIME LIMIT: 45-60 minutes
GOAL: Build a working baseline, then iterate

⚠️  INTERVIEW STRATEGY:
1. Start with the SIMPLEST approach that runs
2. Get a working end-to-end pipeline first
3. Then optimize specific components
4. Talk through your decisions out loud
"""

# ============================================================================
# PROBLEM STATEMENT
# ============================================================================
"""
PROBLEM: Build a candidate-job matching system

You are given:
1. A list of candidate profiles (with skills and experience)
2. A list of job postings (with required skills and descriptions)

Tasks:
1. Parse and preprocess the data
2. Convert profiles/jobs into numerical feature vectors
3. Compute match scores between candidates and jobs
4. Return top-K candidates for each job, ranked by match score
5. Evaluate the ranking using NDCG

CONSTRAINTS:
- Do NOT use scikit-learn's TF-IDF or cosine_similarity (show understanding)
- You MAY use numpy and pandas
- Focus on a WORKING solution, then optimize
"""

import numpy as np
from typing import List, Dict, Tuple, Set
from collections import Counter
import re


# ============================================================================
# SAMPLE DATA (provided in interview)
# ============================================================================

CANDIDATES = [
    {
        "id": "C001",
        "name": "Alice Chen",
        "skills": ["python", "machine learning", "tensorflow", "sql", "data analysis"],
        "experience_years": 5,
        "title": "Data Scientist",
        "bio": "Experienced data scientist with expertise in ML and deep learning"
    },
    {
        "id": "C002", 
        "name": "Bob Smith",
        "skills": ["java", "spring boot", "microservices", "aws", "docker"],
        "experience_years": 7,
        "title": "Backend Engineer",
        "bio": "Senior backend developer building scalable distributed systems"
    },
    {
        "id": "C003",
        "name": "Carol Johnson",
        "skills": ["python", "pytorch", "nlp", "transformers", "huggingface"],
        "experience_years": 4,
        "title": "NLP Engineer",
        "bio": "NLP specialist focused on transformer models and text processing"
    },
    {
        "id": "C004",
        "name": "David Brown",
        "skills": ["javascript", "react", "node.js", "typescript", "graphql"],
        "experience_years": 3,
        "title": "Full Stack Developer",
        "bio": "Full stack developer passionate about building user interfaces"
    },
    {
        "id": "C005",
        "name": "Eva Martinez",
        "skills": ["python", "machine learning", "scikit-learn", "pandas", "recommendation systems"],
        "experience_years": 6,
        "title": "ML Engineer",
        "bio": "ML engineer specializing in recommendation systems and personalization"
    },
    {
        "id": "C006",
        "name": "Frank Wilson",
        "skills": ["python", "sql", "tableau", "statistics", "data visualization"],
        "experience_years": 4,
        "title": "Data Analyst",
        "bio": "Data analyst with strong visualization and statistical skills"
    },
    {
        "id": "C007",
        "name": "Grace Lee",
        "skills": ["python", "deep learning", "computer vision", "opencv", "tensorflow"],
        "experience_years": 5,
        "title": "Computer Vision Engineer",
        "bio": "CV engineer working on image recognition and object detection"
    },
    {
        "id": "C008",
        "name": "Henry Taylor",
        "skills": ["java", "python", "spark", "hadoop", "kafka"],
        "experience_years": 8,
        "title": "Data Engineer",
        "bio": "Senior data engineer building large-scale data pipelines"
    },
]

JOBS = [
    {
        "id": "J001",
        "title": "Senior Machine Learning Engineer",
        "required_skills": ["python", "machine learning", "tensorflow", "deep learning"],
        "preferred_skills": ["recommendation systems", "nlp"],
        "min_experience": 4,
        "description": "Build and deploy ML models for talent matching platform"
    },
    {
        "id": "J002",
        "title": "Backend Software Engineer",
        "required_skills": ["java", "microservices", "aws"],
        "preferred_skills": ["docker", "kubernetes"],
        "min_experience": 3,
        "description": "Develop scalable backend services for enterprise platform"
    },
    {
        "id": "J003",
        "title": "Data Scientist - NLP",
        "required_skills": ["python", "nlp", "machine learning"],
        "preferred_skills": ["transformers", "pytorch", "huggingface"],
        "min_experience": 3,
        "description": "Research and develop NLP models for resume parsing"
    },
]

# Ground truth: Which candidates are actually good fits (for evaluation)
GROUND_TRUTH = {
    "J001": {"C001", "C003", "C005", "C007"},  # ML-related candidates
    "J002": {"C002", "C008"},                   # Backend/infra candidates
    "J003": {"C001", "C003", "C005"},           # NLP/ML candidates
}


# ============================================================================
# SOLUTION - Part 1: Feature Extraction
# ============================================================================

def extract_skills_set(profile: Dict) -> Set[str]:
    """Extract skills as a set for Jaccard similarity."""
    return set(skill.lower() for skill in profile.get("skills", []))


def jaccard_similarity(set1: Set, set2: Set) -> float:
    """Simple Jaccard similarity between two sets."""
    if not set1 and not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0


def experience_match_score(candidate_years: int, min_required: int) -> float:
    """
    Score based on experience match.
    Returns 1.0 if meets requirement, scaled down if under.
    Bonus capped for over-qualification.
    """
    if candidate_years >= min_required:
        # Slight bonus for extra experience, capped
        bonus = min(0.2, (candidate_years - min_required) * 0.05)
        return 1.0 + bonus
    else:
        # Penalty for under-experience
        return max(0.0, candidate_years / min_required)


# ============================================================================
# SOLUTION - Part 2: Match Scoring (Simple Baseline)
# ============================================================================

def compute_match_score_v1(candidate: Dict, job: Dict) -> float:
    """
    VERSION 1: Simple weighted score (START HERE)
    
    This is your "working baseline" - get this running first!
    """
    score = 0.0
    
    # 1. Required skills overlap (weight: 0.5)
    cand_skills = extract_skills_set(candidate)
    required_skills = set(s.lower() for s in job["required_skills"])
    required_overlap = jaccard_similarity(cand_skills, required_skills)
    score += 0.5 * required_overlap
    
    # 2. Preferred skills overlap (weight: 0.2)
    preferred_skills = set(s.lower() for s in job.get("preferred_skills", []))
    if preferred_skills:
        preferred_overlap = jaccard_similarity(cand_skills, preferred_skills)
        score += 0.2 * preferred_overlap
    
    # 3. Experience match (weight: 0.3)
    exp_score = experience_match_score(
        candidate["experience_years"], 
        job["min_experience"]
    )
    score += 0.3 * exp_score
    
    return score


# ============================================================================
# SOLUTION - Part 3: TF-IDF Based Matching (Improved Version)
# ============================================================================

def tokenize_text(text: str) -> List[str]:
    """Simple tokenizer."""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return [t for t in text.split() if len(t) > 2]


def build_skill_tfidf(candidates: List[Dict], jobs: List[Dict]) -> Tuple[Dict, Dict]:
    """
    Build TF-IDF vectors for skills.
    Returns vocabulary mapping and IDF values.
    """
    # Collect all documents (skills lists)
    all_docs = []
    for c in candidates:
        all_docs.append(c["skills"])
    for j in jobs:
        all_docs.append(j["required_skills"] + j.get("preferred_skills", []))
    
    # Build vocabulary and document frequency
    df = Counter()
    for doc in all_docs:
        unique_skills = set(s.lower() for s in doc)
        df.update(unique_skills)
    
    # IDF with smoothing
    N = len(all_docs)
    vocabulary = {skill: idx for idx, skill in enumerate(sorted(df.keys()))}
    idf = {skill: np.log((N + 1) / (count + 1)) + 1 for skill, count in df.items()}
    
    return vocabulary, idf


def profile_to_tfidf_vector(skills: List[str], vocabulary: Dict, idf: Dict) -> np.ndarray:
    """Convert skill list to TF-IDF vector."""
    vector = np.zeros(len(vocabulary))
    skill_counts = Counter(s.lower() for s in skills)
    total = len(skills) if skills else 1
    
    for skill, count in skill_counts.items():
        if skill in vocabulary:
            tf = count / total
            idx = vocabulary[skill]
            vector[idx] = tf * idf.get(skill, 1.0)
    
    return vector


def cosine_similarity_manual(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Manual cosine similarity (don't use sklearn!)."""
    dot = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def compute_match_score_v2(candidate: Dict, job: Dict, 
                           vocabulary: Dict, idf: Dict) -> float:
    """
    VERSION 2: TF-IDF + Cosine Similarity (More sophisticated)
    
    Use after V1 is working!
    """
    # TF-IDF similarity
    cand_vector = profile_to_tfidf_vector(candidate["skills"], vocabulary, idf)
    job_skills = job["required_skills"] + job.get("preferred_skills", [])
    job_vector = profile_to_tfidf_vector(job_skills, vocabulary, idf)
    
    skill_similarity = cosine_similarity_manual(cand_vector, job_vector)
    
    # Experience component
    exp_score = experience_match_score(
        candidate["experience_years"],
        job["min_experience"]
    )
    
    # Combined score
    return 0.7 * skill_similarity + 0.3 * exp_score


# ============================================================================
# SOLUTION - Part 4: Ranking and Retrieval
# ============================================================================

def rank_candidates_for_job(job: Dict, candidates: List[Dict],
                            version: str = "v1",
                            vocabulary: Dict = None,
                            idf: Dict = None) -> List[Tuple[str, float]]:
    """
    Rank all candidates for a given job.
    
    Returns: List of (candidate_id, score) sorted by score descending
    """
    scores = []
    
    for candidate in candidates:
        if version == "v1":
            score = compute_match_score_v1(candidate, job)
        else:
            score = compute_match_score_v2(candidate, job, vocabulary, idf)
        
        scores.append((candidate["id"], score))
    
    # Sort by score descending
    scores.sort(key=lambda x: -x[1])
    return scores


def get_top_k_candidates(job: Dict, candidates: List[Dict], k: int = 3,
                         **kwargs) -> List[str]:
    """Return top-K candidate IDs for a job."""
    ranked = rank_candidates_for_job(job, candidates, **kwargs)
    return [cid for cid, score in ranked[:k]]


# ============================================================================
# SOLUTION - Part 5: Evaluation Metrics
# ============================================================================

def precision_at_k(predicted: List[str], relevant: Set[str], k: int) -> float:
    """Precision@K metric."""
    top_k = predicted[:k]
    relevant_in_top_k = sum(1 for c in top_k if c in relevant)
    return relevant_in_top_k / k


def dcg_at_k(relevance_scores: List[float], k: int) -> float:
    """Discounted Cumulative Gain."""
    relevance = np.array(relevance_scores[:k])
    positions = np.arange(1, len(relevance) + 1)
    return np.sum(relevance / np.log2(positions + 1))


def ndcg_at_k(predicted: List[str], relevant: Set[str], k: int) -> float:
    """NDCG@K metric."""
    # Get relevance scores in predicted order
    relevance_scores = [1 if cid in relevant else 0 for cid in predicted[:k]]
    
    dcg = dcg_at_k(relevance_scores, k)
    
    # Ideal: all relevant items at top
    ideal_relevance = sorted(relevance_scores, reverse=True)
    idcg = dcg_at_k(ideal_relevance, k)
    
    if idcg == 0:
        return 0.0
    return dcg / idcg


def evaluate_system(jobs: List[Dict], candidates: List[Dict], 
                    ground_truth: Dict, k: int = 3, **kwargs) -> Dict:
    """
    Full system evaluation across all jobs.
    """
    metrics = {"precision@k": [], "ndcg@k": []}
    
    for job in jobs:
        if job["id"] not in ground_truth:
            continue
        
        ranked = rank_candidates_for_job(job, candidates, **kwargs)
        predicted = [cid for cid, _ in ranked]
        relevant = ground_truth[job["id"]]
        
        metrics["precision@k"].append(precision_at_k(predicted, relevant, k))
        metrics["ndcg@k"].append(ndcg_at_k(predicted, relevant, k))
    
    return {
        "mean_precision@k": np.mean(metrics["precision@k"]),
        "mean_ndcg@k": np.mean(metrics["ndcg@k"]),
        "per_job_precision": metrics["precision@k"],
        "per_job_ndcg": metrics["ndcg@k"],
    }


# ============================================================================
# MAIN: RUN THE FULL PIPELINE
# ============================================================================

def main():
    """
    Complete pipeline demonstration.
    This is what you'd build during the interview.
    """
    print("=" * 70)
    print("EIGHTFOLD MOCK INTERVIEW: Candidate-Job Matching System")
    print("=" * 70)
    
    # Step 1: Understand the data
    print("\n📊 DATA OVERVIEW")
    print(f"  Candidates: {len(CANDIDATES)}")
    print(f"  Jobs: {len(JOBS)}")
    print(f"  Ground truth available: {len(GROUND_TRUTH)} jobs")
    
    # Step 2: Simple baseline (V1)
    print("\n" + "=" * 50)
    print("🏃 VERSION 1: Simple Weighted Score")
    print("=" * 50)
    
    print("\nRanking candidates for each job:")
    for job in JOBS:
        print(f"\n📋 {job['title']} ({job['id']})")
        print(f"   Required: {job['required_skills']}")
        
        top_3 = get_top_k_candidates(job, CANDIDATES, k=3, version="v1")
        for rank, cid in enumerate(top_3, 1):
            cand = next(c for c in CANDIDATES if c["id"] == cid)
            print(f"   {rank}. {cand['name']} ({cid}) - {cand['title']}")
    
    # Evaluate V1
    eval_v1 = evaluate_system(JOBS, CANDIDATES, GROUND_TRUTH, k=3, version="v1")
    print(f"\n📈 V1 Metrics:")
    print(f"   Mean Precision@3: {eval_v1['mean_precision@k']:.3f}")
    print(f"   Mean NDCG@3: {eval_v1['mean_ndcg@k']:.3f}")
    
    # Step 3: Improved version (V2)
    print("\n" + "=" * 50)
    print("🚀 VERSION 2: TF-IDF + Cosine Similarity")
    print("=" * 50)
    
    # Build TF-IDF
    vocabulary, idf = build_skill_tfidf(CANDIDATES, JOBS)
    print(f"\nVocabulary size: {len(vocabulary)}")
    
    print("\nRanking candidates for each job:")
    for job in JOBS:
        print(f"\n📋 {job['title']} ({job['id']})")
        
        ranked = rank_candidates_for_job(job, CANDIDATES, version="v2",
                                         vocabulary=vocabulary, idf=idf)
        for rank, (cid, score) in enumerate(ranked[:3], 1):
            cand = next(c for c in CANDIDATES if c["id"] == cid)
            print(f"   {rank}. {cand['name']} ({cid}) - score: {score:.3f}")
    
    # Evaluate V2
    eval_v2 = evaluate_system(JOBS, CANDIDATES, GROUND_TRUTH, k=3,
                              version="v2", vocabulary=vocabulary, idf=idf)
    print(f"\n📈 V2 Metrics:")
    print(f"   Mean Precision@3: {eval_v2['mean_precision@k']:.3f}")
    print(f"   Mean NDCG@3: {eval_v2['mean_ndcg@k']:.3f}")
    
    # Step 4: Comparison
    print("\n" + "=" * 50)
    print("📊 COMPARISON: V1 vs V2")
    print("=" * 50)
    print(f"  Precision@3: {eval_v1['mean_precision@k']:.3f} → {eval_v2['mean_precision@k']:.3f}")
    print(f"  NDCG@3:      {eval_v1['mean_ndcg@k']:.3f} → {eval_v2['mean_ndcg@k']:.3f}")
    
    print("\n" + "=" * 70)
    print("✅ INTERVIEW COMPLETE - Pipeline runs end-to-end!")
    print("=" * 70)
    
    # Interview discussion points
    print("""
🎯 DISCUSSION POINTS (be ready to explain):

1. Why did you choose these feature weights?
   → "I started with intuition and would tune with validation data"

2. How would you improve this system?
   → "Use learned embeddings (BERT), add more features (education, 
      company similarity), use learning-to-rank models"

3. How would this scale to millions of candidates?
   → "Approximate nearest neighbors (FAISS/Annoy), pre-computed 
      embeddings, candidate pre-filtering by hard constraints"

4. How would you handle cold-start (new candidate/job)?
   → "Content-based features, similar job/candidate borrowing"
""")


if __name__ == "__main__":
    main()
