"""
K-Means Clustering from Scratch
================================
K-Means is commonly asked in ML interviews to test understanding of 
iterative optimization and clustering concepts.

Eightfold use case: Clustering candidate profiles or job postings 
into groups for better organization/recommendations.
"""

import numpy as np
from typing import Tuple, Optional, List


class KMeans:
    """
    K-Means clustering implementation from scratch.
    
    Algorithm:
    1. Initialize K centroids (randomly or with kmeans++)
    2. Repeat until convergence:
       a. Assign each point to nearest centroid
       b. Update centroids as mean of assigned points
    3. Return cluster assignments
    
    Usage:
        kmeans = KMeans(n_clusters=3)
        labels = kmeans.fit_predict(X)
        centroids = kmeans.centroids_
    """
    
    def __init__(self, 
                 n_clusters: int = 3,
                 max_iters: int = 100,
                 tol: float = 1e-4,
                 init: str = 'kmeans++',
                 random_state: Optional[int] = None):
        """
        Args:
            n_clusters: Number of clusters (K)
            max_iters: Maximum iterations
            tol: Convergence tolerance (stop if centroid movement < tol)
            init: Initialization method ('random' or 'kmeans++')
            random_state: Random seed for reproducibility
        """
        self.n_clusters = n_clusters
        self.max_iters = max_iters
        self.tol = tol
        self.init = init
        self.random_state = random_state
        
        self.centroids_: Optional[np.ndarray] = None
        self.labels_: Optional[np.ndarray] = None
        self.inertia_: float = 0.0  # Sum of squared distances to centroids
        self.n_iter_: int = 0
    
    def _euclidean_distance(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute Euclidean distance between two points."""
        return np.sqrt(np.sum((a - b) ** 2))
    
    def _compute_distances_to_centroids(self, X: np.ndarray) -> np.ndarray:
        """
        Compute distance from each point to each centroid.
        
        Returns: Shape (n_samples, n_clusters)
        """
        n_samples = X.shape[0]
        distances = np.zeros((n_samples, self.n_clusters))
        
        for i, point in enumerate(X):
            for j, centroid in enumerate(self.centroids_):
                distances[i, j] = self._euclidean_distance(point, centroid)
        
        return distances
    
    def _init_random(self, X: np.ndarray) -> np.ndarray:
        """Initialize centroids by randomly selecting K points."""
        n_samples = X.shape[0]
        indices = np.random.choice(n_samples, self.n_clusters, replace=False)
        return X[indices].copy()
    
    def _init_kmeans_plus_plus(self, X: np.ndarray) -> np.ndarray:
        """
        K-Means++ initialization for better starting centroids.
        
        Algorithm:
        1. Choose first centroid randomly
        2. For each subsequent centroid:
           - Compute D(x) = distance to nearest existing centroid
           - Choose next centroid with probability proportional to D(x)^2
        
        This spreads out initial centroids for faster/better convergence.
        """
        n_samples = X.shape[0]
        centroids = []
        
        # First centroid: random
        first_idx = np.random.randint(n_samples)
        centroids.append(X[first_idx].copy())
        
        # Remaining centroids
        for _ in range(1, self.n_clusters):
            # Compute squared distance to nearest centroid for each point
            min_sq_distances = np.full(n_samples, np.inf)
            
            for point_idx in range(n_samples):
                for centroid in centroids:
                    dist_sq = np.sum((X[point_idx] - centroid) ** 2)
                    min_sq_distances[point_idx] = min(min_sq_distances[point_idx], dist_sq)
            
            # Choose next centroid with probability proportional to D^2
            probabilities = min_sq_distances / min_sq_distances.sum()
            next_idx = np.random.choice(n_samples, p=probabilities)
            centroids.append(X[next_idx].copy())
        
        return np.array(centroids)
    
    def _assign_clusters(self, X: np.ndarray) -> np.ndarray:
        """Assign each point to the nearest centroid."""
        distances = self._compute_distances_to_centroids(X)
        return np.argmin(distances, axis=1)
    
    def _update_centroids(self, X: np.ndarray, labels: np.ndarray) -> np.ndarray:
        """
        Update centroids as mean of assigned points.
        
        Handle empty clusters by keeping the old centroid.
        """
        new_centroids = np.zeros_like(self.centroids_)
        
        for k in range(self.n_clusters):
            cluster_points = X[labels == k]
            
            if len(cluster_points) > 0:
                new_centroids[k] = cluster_points.mean(axis=0)
            else:
                # Keep old centroid if cluster is empty
                new_centroids[k] = self.centroids_[k]
        
        return new_centroids
    
    def _compute_inertia(self, X: np.ndarray, labels: np.ndarray) -> float:
        """Compute sum of squared distances to centroids (inertia)."""
        inertia = 0.0
        for i, point in enumerate(X):
            centroid = self.centroids_[labels[i]]
            inertia += np.sum((point - centroid) ** 2)
        return inertia
    
    def fit(self, X: np.ndarray) -> 'KMeans':
        """
        Fit K-Means clustering.
        
        Args:
            X: Data matrix, shape (n_samples, n_features)
        
        Returns:
            self
        """
        if self.random_state is not None:
            np.random.seed(self.random_state)
        
        # Initialize centroids
        if self.init == 'kmeans++':
            self.centroids_ = self._init_kmeans_plus_plus(X)
        else:
            self.centroids_ = self._init_random(X)
        
        # Iterative refinement
        for iteration in range(self.max_iters):
            # Step 1: Assign points to nearest centroid
            self.labels_ = self._assign_clusters(X)
            
            # Step 2: Update centroids
            new_centroids = self._update_centroids(X, self.labels_)
            
            # Check convergence
            centroid_shift = np.sqrt(np.sum((new_centroids - self.centroids_) ** 2))
            self.centroids_ = new_centroids
            
            if centroid_shift < self.tol:
                break
        
        self.n_iter_ = iteration + 1
        self.inertia_ = self._compute_inertia(X, self.labels_)
        
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict cluster labels for new data."""
        return self._assign_clusters(X)
    
    def fit_predict(self, X: np.ndarray) -> np.ndarray:
        """Fit and return cluster labels."""
        self.fit(X)
        return self.labels_


# ============================================================================
# ELBOW METHOD - Finding optimal K
# ============================================================================

def elbow_method(X: np.ndarray, 
                 k_range: range = range(1, 11),
                 random_state: int = 42) -> List[Tuple[int, float]]:
    """
    Run K-Means for different K values and return inertias.
    
    Use this to find the "elbow" point where adding more clusters
    doesn't significantly reduce inertia.
    
    Returns:
        List of (k, inertia) tuples
    """
    results = []
    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=random_state)
        kmeans.fit(X)
        results.append((k, kmeans.inertia_))
        print(f"K={k}: inertia={kmeans.inertia_:.2f}")
    return results


# ============================================================================
# SILHOUETTE SCORE - Cluster quality metric
# ============================================================================

def silhouette_score(X: np.ndarray, labels: np.ndarray) -> float:
    """
    Compute silhouette score for clustering quality.
    
    For each point:
    - a = average distance to other points in same cluster
    - b = average distance to points in nearest other cluster
    - s = (b - a) / max(a, b)
    
    Score ranges from -1 to 1:
    - 1: Perfect clustering
    - 0: Overlapping clusters
    - -1: Wrong clustering
    """
    n_samples = X.shape[0]
    unique_labels = np.unique(labels)
    
    silhouette_values = []
    
    for i in range(n_samples):
        point = X[i]
        point_label = labels[i]
        
        # Compute a: mean distance to same cluster
        same_cluster = X[labels == point_label]
        if len(same_cluster) > 1:
            distances_same = [np.sqrt(np.sum((point - p) ** 2)) 
                            for p in same_cluster if not np.array_equal(p, point)]
            a = np.mean(distances_same) if distances_same else 0
        else:
            a = 0
        
        # Compute b: min mean distance to other clusters
        b_values = []
        for other_label in unique_labels:
            if other_label == point_label:
                continue
            other_cluster = X[labels == other_label]
            if len(other_cluster) > 0:
                distances_other = [np.sqrt(np.sum((point - p) ** 2)) 
                                  for p in other_cluster]
                b_values.append(np.mean(distances_other))
        
        b = min(b_values) if b_values else 0
        
        # Compute silhouette for this point
        if max(a, b) > 0:
            s = (b - a) / max(a, b)
        else:
            s = 0
        
        silhouette_values.append(s)
    
    return np.mean(silhouette_values)


# ============================================================================
# DEMO
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("K-Means Clustering Demo")
    print("=" * 60)
    
    np.random.seed(42)
    
    # Generate sample data: 3 clusters
    cluster1 = np.random.randn(30, 2) + np.array([0, 0])
    cluster2 = np.random.randn(30, 2) + np.array([5, 5])
    cluster3 = np.random.randn(30, 2) + np.array([10, 0])
    
    X = np.vstack([cluster1, cluster2, cluster3])
    true_labels = np.array([0]*30 + [1]*30 + [2]*30)
    
    print(f"\n📊 Generated data: {X.shape[0]} points, {X.shape[1]} features")
    print(f"True clusters: {len(np.unique(true_labels))}")
    
    # Fit K-Means
    print("\n--- Running K-Means (K=3) ---")
    kmeans = KMeans(n_clusters=3, init='kmeans++', random_state=42)
    predicted_labels = kmeans.fit_predict(X)
    
    print(f"Converged in {kmeans.n_iter_} iterations")
    print(f"Inertia: {kmeans.inertia_:.2f}")
    print(f"Centroids:\n{kmeans.centroids_}")
    
    # Evaluate clustering
    print("\n--- Cluster Distribution ---")
    for k in range(3):
        count = np.sum(predicted_labels == k)
        print(f"Cluster {k}: {count} points")
    
    # Silhouette score
    score = silhouette_score(X, predicted_labels)
    print(f"\nSilhouette Score: {score:.3f}")
    
    # Elbow method demonstration
    print("\n--- Elbow Method (finding optimal K) ---")
    elbow_results = elbow_method(X, k_range=range(1, 7), random_state=42)
    
    print("\n" + "=" * 60)
    print("✅ K-Means clustering complete!")
    print("=" * 60)
    
    # Practical application: Clustering job titles
    print("\n" + "=" * 60)
    print("Practical Example: Job Title Clustering")
    print("=" * 60)
    
    # Simulated job title embeddings (in practice, use real embeddings)
    # Each row is a job's feature vector
    job_features = np.array([
        [0.9, 0.8, 0.1, 0.0],  # ML Engineer 1
        [0.85, 0.75, 0.15, 0.0],  # ML Engineer 2
        [0.1, 0.2, 0.9, 0.8],  # Frontend Dev 1
        [0.15, 0.25, 0.85, 0.75],  # Frontend Dev 2
        [0.5, 0.5, 0.5, 0.5],  # Full Stack
        [0.88, 0.82, 0.12, 0.05],  # Data Scientist
    ])
    job_titles = [
        "ML Engineer", "ML Engineer", 
        "Frontend Dev", "Frontend Dev",
        "Full Stack", "Data Scientist"
    ]
    
    print(f"\nClustering {len(job_titles)} job titles into 2 groups:")
    kmeans_jobs = KMeans(n_clusters=2, random_state=42)
    job_labels = kmeans_jobs.fit_predict(job_features)
    
    for title, label in zip(job_titles, job_labels):
        print(f"  {title}: Cluster {label}")
