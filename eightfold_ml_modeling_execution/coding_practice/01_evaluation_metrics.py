"""
ML Evaluation Metrics from Scratch
===================================
Practice these for Eightfold interviews - they love ranking/recommendation metrics.

Key metrics covered:
- Precision@K
- Recall@K
- NDCG (Normalized Discounted Cumulative Gain)
- MAP (Mean Average Precision)
- MRR (Mean Reciprocal Rank)
"""

import numpy as np
from typing import List, Set


# ============================================================================
# PRECISION@K
# ============================================================================
def precision_at_k(predicted: List[int], relevant: Set[int], k: int) -> float:
    """
    Precision@K = (# of relevant items in top-K predictions) / K
    
    Args:
        predicted: Ranked list of predicted item IDs (most relevant first)
        relevant: Set of actually relevant item IDs (ground truth)
        k: Number of top predictions to consider
    
    Returns:
        Precision score between 0 and 1
    
    Example:
        predicted = [1, 4, 2, 8, 5]  # Model's ranking
        relevant = {1, 2, 3}         # Actually relevant items
        precision_at_k(predicted, relevant, k=3) = 2/3 = 0.667
        (items 1 and 2 are relevant in top 3)
    """
    if k <= 0:
        return 0.0
    
    top_k = predicted[:k]
    relevant_in_top_k = sum(1 for item in top_k if item in relevant)
    return relevant_in_top_k / k


# ============================================================================
# RECALL@K
# ============================================================================
def recall_at_k(predicted: List[int], relevant: Set[int], k: int) -> float:
    """
    Recall@K = (# of relevant items in top-K) / (total # of relevant items)
    
    Args:
        predicted: Ranked list of predicted item IDs
        relevant: Set of actually relevant item IDs
        k: Number of top predictions to consider
    
    Returns:
        Recall score between 0 and 1
    """
    if len(relevant) == 0:
        return 0.0
    
    top_k = predicted[:k]
    relevant_in_top_k = sum(1 for item in top_k if item in relevant)
    return relevant_in_top_k / len(relevant)


# ============================================================================
# DCG and NDCG
# ============================================================================
def dcg_at_k(relevance_scores: List[float], k: int) -> float:
    """
    Discounted Cumulative Gain at K
    
    DCG@K = sum_{i=1}^{k} (relevance[i]) / log2(i + 1)
    
    The idea: Higher positions should matter more, so we discount 
    relevance scores by their position.
    
    Args:
        relevance_scores: List of relevance scores in ranked order
                         (e.g., [3, 2, 0, 1, 0] where 3=highly relevant)
        k: Number of positions to consider
    
    Returns:
        DCG score (unbounded positive number)
    """
    relevance_scores = np.array(relevance_scores[:k])
    positions = np.arange(1, len(relevance_scores) + 1)
    
    # Discount factor: log2(position + 1)
    discounts = np.log2(positions + 1)
    
    return np.sum(relevance_scores / discounts)


def ndcg_at_k(predicted_relevance: List[float], k: int) -> float:
    """
    Normalized Discounted Cumulative Gain at K
    
    NDCG@K = DCG@K / IDCG@K
    
    Where IDCG (Ideal DCG) is the DCG of the perfect ranking
    (all items sorted by relevance descending).
    
    Args:
        predicted_relevance: Relevance scores in the model's predicted order
        k: Number of positions to consider
    
    Returns:
        NDCG score between 0 and 1 (1 = perfect ranking)
    
    Example:
        # Model predicted order with their true relevances
        predicted_relevance = [3, 0, 2, 1]  
        # Ideal order would be: [3, 2, 1, 0]
        ndcg_at_k(predicted_relevance, k=4)
    """
    dcg = dcg_at_k(predicted_relevance, k)
    
    # Ideal DCG: sort relevances in descending order
    ideal_order = sorted(predicted_relevance, reverse=True)
    idcg = dcg_at_k(ideal_order, k)
    
    if idcg == 0:
        return 0.0
    
    return dcg / idcg


# ============================================================================
# MEAN AVERAGE PRECISION (MAP)
# ============================================================================
def average_precision(predicted: List[int], relevant: Set[int]) -> float:
    """
    Average Precision for a single query.
    
    AP = (1/|relevant|) * sum of (Precision@k * rel(k)) for all k
    
    Where rel(k) = 1 if item at position k is relevant, else 0.
    
    Args:
        predicted: Ranked list of predicted item IDs
        relevant: Set of actually relevant item IDs
    
    Returns:
        AP score between 0 and 1
    """
    if len(relevant) == 0:
        return 0.0
    
    precision_sum = 0.0
    relevant_count = 0
    
    for k, item in enumerate(predicted, start=1):
        if item in relevant:
            relevant_count += 1
            precision_at_position = relevant_count / k
            precision_sum += precision_at_position
    
    return precision_sum / len(relevant)


def mean_average_precision(predictions: List[List[int]], 
                           relevants: List[Set[int]]) -> float:
    """
    Mean Average Precision across multiple queries.
    
    MAP = (1/Q) * sum of AP for each query
    
    Args:
        predictions: List of ranked predictions for each query
        relevants: List of relevant item sets for each query
    
    Returns:
        MAP score between 0 and 1
    """
    if len(predictions) == 0:
        return 0.0
    
    ap_sum = sum(average_precision(pred, rel) 
                 for pred, rel in zip(predictions, relevants))
    return ap_sum / len(predictions)


# ============================================================================
# MEAN RECIPROCAL RANK (MRR)
# ============================================================================
def reciprocal_rank(predicted: List[int], relevant: Set[int]) -> float:
    """
    Reciprocal Rank for a single query.
    
    RR = 1 / (position of first relevant item)
    
    Args:
        predicted: Ranked list of predicted item IDs
        relevant: Set of actually relevant item IDs
    
    Returns:
        RR score between 0 and 1 (0 if no relevant item found)
    """
    for position, item in enumerate(predicted, start=1):
        if item in relevant:
            return 1.0 / position
    return 0.0


def mean_reciprocal_rank(predictions: List[List[int]], 
                         relevants: List[Set[int]]) -> float:
    """
    Mean Reciprocal Rank across multiple queries.
    
    MRR = (1/Q) * sum of RR for each query
    """
    if len(predictions) == 0:
        return 0.0
    
    rr_sum = sum(reciprocal_rank(pred, rel) 
                 for pred, rel in zip(predictions, relevants))
    return rr_sum / len(predictions)


# ============================================================================
# TESTING / DEMO
# ============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("ML Evaluation Metrics Demo")
    print("=" * 60)
    
    # Example: Job-candidate matching scenario
    # Model predicted these candidates (by ID) for a job posting
    predicted_candidates = [101, 203, 145, 178, 299, 312, 400, 155, 210, 305]
    
    # Ground truth: HR marked these candidates as actually good fits
    relevant_candidates = {101, 145, 155, 210, 999}  # 999 wasn't even retrieved
    
    print("\n📊 Scenario: Job-Candidate Matching")
    print(f"Predicted ranking: {predicted_candidates}")
    print(f"Actually relevant: {relevant_candidates}")
    
    # Precision and Recall at different K values
    print("\n--- Precision@K and Recall@K ---")
    for k in [3, 5, 10]:
        p = precision_at_k(predicted_candidates, relevant_candidates, k)
        r = recall_at_k(predicted_candidates, relevant_candidates, k)
        print(f"K={k}: Precision={p:.3f}, Recall={r:.3f}")
    
    # NDCG example with graded relevance
    print("\n--- NDCG@K (with graded relevance) ---")
    # Relevance scores in model's predicted order: 0=not relevant, 1=slightly, 2=relevant, 3=highly
    predicted_relevance = [3, 0, 2, 0, 0, 0, 0, 2, 1, 0]  # matches predicted_candidates
    for k in [3, 5, 10]:
        score = ndcg_at_k(predicted_relevance, k)
        print(f"NDCG@{k}: {score:.3f}")
    
    # Average Precision
    print("\n--- Average Precision ---")
    ap = average_precision(predicted_candidates, relevant_candidates)
    print(f"AP: {ap:.3f}")
    
    # Reciprocal Rank
    print("\n--- Reciprocal Rank ---")
    rr = reciprocal_rank(predicted_candidates, relevant_candidates)
    print(f"RR: {rr:.3f} (first relevant at position {int(1/rr) if rr > 0 else 'N/A'})")
    
    print("\n" + "=" * 60)
    print("✅ All metrics computed successfully!")
    print("=" * 60)
