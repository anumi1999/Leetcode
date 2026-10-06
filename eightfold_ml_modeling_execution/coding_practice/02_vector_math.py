"""
Vector Math & Similarity Functions from Scratch
================================================
Core building blocks for embedding-based matching systems.
Eightfold heavily uses vector embeddings for profile-to-job matching.

Practice these without looking at sklearn/scipy implementations!
"""

import numpy as np
from typing import List, Tuple, Optional


# ============================================================================
# DISTANCE METRICS
# ============================================================================

def euclidean_distance(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Euclidean (L2) distance between two vectors.
    
    Formula: sqrt(sum((a_i - b_i)^2))
    
    Use case: Measures "straight line" distance in embedding space.
    Lower = more similar.
    
    Args:
        vec1, vec2: 1D numpy arrays of same length
    
    Returns:
        Non-negative float distance
    """
    diff = vec1 - vec2
    return np.sqrt(np.sum(diff ** 2))


def manhattan_distance(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Manhattan (L1) distance between two vectors.
    
    Formula: sum(|a_i - b_i|)
    
    Use case: More robust to outliers than Euclidean.
    """
    return np.sum(np.abs(vec1 - vec2))


def minkowski_distance(vec1: np.ndarray, vec2: np.ndarray, p: float = 2) -> float:
    """
    Generalized Minkowski distance.
    
    Formula: (sum(|a_i - b_i|^p))^(1/p)
    
    - p=1: Manhattan distance
    - p=2: Euclidean distance
    - p=inf: Chebyshev distance (max absolute difference)
    """
    if p == float('inf'):
        return np.max(np.abs(vec1 - vec2))
    return np.power(np.sum(np.abs(vec1 - vec2) ** p), 1/p)


# ============================================================================
# SIMILARITY METRICS
# ============================================================================

def dot_product(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Dot product (inner product) of two vectors.
    
    Formula: sum(a_i * b_i)
    
    Use case: Base operation for cosine similarity.
    Also used directly for scoring in neural retrieval systems.
    Higher = more similar (when vectors are positive).
    """
    return np.sum(vec1 * vec2)


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Cosine similarity between two vectors.
    
    Formula: (a · b) / (||a|| * ||b||)
    
    Use case: The MOST COMMON similarity metric for text embeddings
    and semantic matching. Measures angle between vectors, not magnitude.
    
    Returns:
        Value between -1 and 1 (1 = identical direction, 0 = orthogonal)
        For normalized embeddings, often between 0 and 1.
    
    ⚠️ Edge case: Returns 0 if either vector has zero magnitude.
    """
    dot = np.sum(vec1 * vec2)
    norm1 = np.sqrt(np.sum(vec1 ** 2))
    norm2 = np.sqrt(np.sum(vec2 ** 2))
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot / (norm1 * norm2)


def cosine_distance(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Cosine distance = 1 - cosine_similarity
    
    Use when you need a distance metric (lower = better).
    """
    return 1.0 - cosine_similarity(vec1, vec2)


def jaccard_similarity(set1: set, set2: set) -> float:
    """
    Jaccard similarity for sets (not vectors).
    
    Formula: |A ∩ B| / |A ∪ B|
    
    Use case: Comparing skill sets, tags, or categorical features.
    """
    if len(set1) == 0 and len(set2) == 0:
        return 1.0  # Both empty = identical
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union


# ============================================================================
# BATCH OPERATIONS (for efficiency)
# ============================================================================

def pairwise_cosine_similarity(matrix: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between all pairs of vectors.
    
    Args:
        matrix: Shape (n_samples, n_features)
    
    Returns:
        Similarity matrix of shape (n_samples, n_samples)
    
    Use case: Find all similar candidates/jobs at once.
    """
    # Normalize each row vector
    norms = np.sqrt(np.sum(matrix ** 2, axis=1, keepdims=True))
    norms[norms == 0] = 1  # Avoid division by zero
    normalized = matrix / norms
    
    # Dot product between all pairs
    return np.dot(normalized, normalized.T)


def top_k_similar(query: np.ndarray, 
                  candidates: np.ndarray, 
                  k: int = 5) -> Tuple[np.ndarray, np.ndarray]:
    """
    Find top-K most similar candidates to a query vector.
    
    Args:
        query: Shape (n_features,) - single query embedding
        candidates: Shape (n_candidates, n_features)
        k: Number of top results
    
    Returns:
        (indices, scores) - indices of top-k candidates and their scores
    
    This is a core operation in Eightfold's matching system!
    """
    # Compute similarities
    scores = np.array([cosine_similarity(query, c) for c in candidates])
    
    # Get top-k indices (argsort gives ascending, so negate for descending)
    top_indices = np.argsort(-scores)[:k]
    top_scores = scores[top_indices]
    
    return top_indices, top_scores


def normalize_vectors(matrix: np.ndarray) -> np.ndarray:
    """
    L2 normalize each row vector to unit length.
    
    After normalization, cosine_similarity(a, b) == dot_product(a, b)
    This makes similarity computation much faster!
    """
    norms = np.sqrt(np.sum(matrix ** 2, axis=1, keepdims=True))
    norms[norms == 0] = 1
    return matrix / norms


# ============================================================================
# WEIGHTED SIMILARITY
# ============================================================================

def weighted_cosine_similarity(vec1: np.ndarray, 
                               vec2: np.ndarray, 
                               weights: np.ndarray) -> float:
    """
    Weighted cosine similarity.
    
    Use case: When some dimensions (features) matter more than others.
    E.g., "Python experience" might be weighted higher than "MS Office".
    
    Formula: Apply sqrt(weights) to both vectors, then compute regular cosine.
    """
    sqrt_weights = np.sqrt(weights)
    weighted_v1 = vec1 * sqrt_weights
    weighted_v2 = vec2 * sqrt_weights
    return cosine_similarity(weighted_v1, weighted_v2)


# ============================================================================
# DEMO / TESTING
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Vector Math Demo - Job/Candidate Matching")
    print("=" * 60)
    
    # Simulate embedding vectors for job and candidates
    np.random.seed(42)
    
    # Job embedding (what we're searching for)
    job_embedding = np.array([0.8, 0.3, 0.9, 0.2, 0.7])
    
    # Candidate embeddings
    candidates = np.array([
        [0.75, 0.35, 0.85, 0.25, 0.65],  # Very similar
        [0.1, 0.9, 0.2, 0.8, 0.1],        # Very different
        [0.6, 0.4, 0.7, 0.3, 0.5],        # Moderately similar
        [0.79, 0.31, 0.88, 0.22, 0.69],   # Almost identical
        [0.5, 0.5, 0.5, 0.5, 0.5],        # Neutral
    ])
    candidate_names = ["Alice", "Bob", "Charlie", "Diana", "Eve"]
    
    print("\n📊 Job Embedding:", job_embedding)
    print("\n--- Individual Similarities ---")
    for i, (name, cand) in enumerate(zip(candidate_names, candidates)):
        cos_sim = cosine_similarity(job_embedding, cand)
        euc_dist = euclidean_distance(job_embedding, cand)
        print(f"{name}: Cosine={cos_sim:.4f}, Euclidean={euc_dist:.4f}")
    
    print("\n--- Top-K Similar Candidates ---")
    top_idx, top_scores = top_k_similar(job_embedding, candidates, k=3)
    for idx, score in zip(top_idx, top_scores):
        print(f"  Rank: {candidate_names[idx]} (score={score:.4f})")
    
    print("\n--- Pairwise Similarity Matrix ---")
    all_vectors = np.vstack([job_embedding, candidates])
    sim_matrix = pairwise_cosine_similarity(all_vectors)
    print("Job vs all candidates (first row):")
    print(np.round(sim_matrix[0], 3))
    
    # Jaccard similarity example (for skills)
    print("\n--- Jaccard Similarity (Skills) ---")
    job_skills = {"Python", "ML", "SQL", "TensorFlow"}
    candidate_skills = [
        {"Python", "ML", "PyTorch", "SQL"},      # Alice
        {"Java", "Spring", "REST"},               # Bob
        {"Python", "SQL", "Pandas"},              # Charlie
        {"Python", "ML", "SQL", "TensorFlow", "Keras"},  # Diana
        {"JavaScript", "React", "Node"},          # Eve
    ]
    for name, skills in zip(candidate_names, candidate_skills):
        jac = jaccard_similarity(job_skills, skills)
        print(f"{name}: Jaccard={jac:.3f} (skills: {skills})")
    
    print("\n" + "=" * 60)
    print("✅ All vector operations completed!")
    print("=" * 60)
