"""
Gradient Descent & Regression from Scratch
==========================================
Core ML algorithms that interviewers love to ask about.
Understanding the math behind gradient descent is essential.

Covered:
- Linear Regression with Gradient Descent
- Logistic Regression with Gradient Descent
- Stochastic Gradient Descent (SGD)
- Mini-batch Gradient Descent
"""

import numpy as np
from typing import Tuple, List, Optional


# ============================================================================
# LINEAR REGRESSION
# ============================================================================

class LinearRegression:
    """
    Linear Regression using Gradient Descent.
    
    Model: y = X @ w + b
    Loss: MSE = (1/n) * sum((y_pred - y_true)^2)
    
    Gradients:
    - dL/dw = (2/n) * X.T @ (y_pred - y)
    - dL/db = (2/n) * sum(y_pred - y)
    """
    
    def __init__(self, 
                 learning_rate: float = 0.01,
                 n_iterations: int = 1000,
                 regularization: float = 0.0):
        """
        Args:
            learning_rate: Step size for gradient updates
            n_iterations: Number of training iterations
            regularization: L2 regularization strength (0 = none)
        """
        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.regularization = regularization
        
        self.weights_: Optional[np.ndarray] = None
        self.bias_: float = 0.0
        self.loss_history_: List[float] = []
    
    def _compute_loss(self, y_pred: np.ndarray, y_true: np.ndarray) -> float:
        """Compute Mean Squared Error loss."""
        mse = np.mean((y_pred - y_true) ** 2)
        
        # Add L2 regularization term
        if self.regularization > 0:
            mse += self.regularization * np.sum(self.weights_ ** 2)
        
        return mse
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'LinearRegression':
        """
        Train linear regression using gradient descent.
        
        Args:
            X: Features, shape (n_samples, n_features)
            y: Target, shape (n_samples,)
        """
        n_samples, n_features = X.shape
        
        # Initialize weights
        self.weights_ = np.zeros(n_features)
        self.bias_ = 0.0
        self.loss_history_ = []
        
        for iteration in range(self.n_iterations):
            # Forward pass
            y_pred = X @ self.weights_ + self.bias_
            
            # Compute loss
            loss = self._compute_loss(y_pred, y)
            self.loss_history_.append(loss)
            
            # Compute gradients
            error = y_pred - y
            dw = (2 / n_samples) * (X.T @ error)
            db = (2 / n_samples) * np.sum(error)
            
            # Add L2 regularization gradient
            if self.regularization > 0:
                dw += 2 * self.regularization * self.weights_
            
            # Update weights
            self.weights_ -= self.learning_rate * dw
            self.bias_ -= self.learning_rate * db
            
            # Print progress
            if (iteration + 1) % 100 == 0:
                print(f"Iteration {iteration + 1}: Loss = {loss:.6f}")
        
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict target values."""
        return X @ self.weights_ + self.bias_
    
    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        """
        Compute R-squared score.
        R² = 1 - (SS_res / SS_tot)
        """
        y_pred = self.predict(X)
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        return 1 - (ss_res / ss_tot)


# ============================================================================
# LOGISTIC REGRESSION
# ============================================================================

class LogisticRegression:
    """
    Logistic Regression using Gradient Descent (Binary Classification).
    
    Model: p = sigmoid(X @ w + b)
    Loss: Binary Cross-Entropy = -mean(y*log(p) + (1-y)*log(1-p))
    
    Gradients:
    - dL/dw = (1/n) * X.T @ (p - y)
    - dL/db = (1/n) * sum(p - y)
    """
    
    def __init__(self,
                 learning_rate: float = 0.1,
                 n_iterations: int = 1000,
                 regularization: float = 0.0):
        self.learning_rate = learning_rate
        self.n_iterations = n_iterations
        self.regularization = regularization
        
        self.weights_: Optional[np.ndarray] = None
        self.bias_: float = 0.0
        self.loss_history_: List[float] = []
    
    def _sigmoid(self, z: np.ndarray) -> np.ndarray:
        """
        Sigmoid activation function.
        σ(z) = 1 / (1 + exp(-z))
        
        Clipping prevents overflow.
        """
        z = np.clip(z, -500, 500)  # Prevent overflow
        return 1 / (1 + np.exp(-z))
    
    def _compute_loss(self, y_pred: np.ndarray, y_true: np.ndarray) -> float:
        """Compute Binary Cross-Entropy loss."""
        # Clip predictions to avoid log(0)
        eps = 1e-15
        y_pred = np.clip(y_pred, eps, 1 - eps)
        
        bce = -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))
        
        # Add L2 regularization
        if self.regularization > 0:
            bce += self.regularization * np.sum(self.weights_ ** 2)
        
        return bce
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'LogisticRegression':
        """
        Train logistic regression using gradient descent.
        
        Args:
            X: Features, shape (n_samples, n_features)
            y: Binary labels, shape (n_samples,) with values 0 or 1
        """
        n_samples, n_features = X.shape
        
        # Initialize weights
        self.weights_ = np.zeros(n_features)
        self.bias_ = 0.0
        self.loss_history_ = []
        
        for iteration in range(self.n_iterations):
            # Forward pass
            z = X @ self.weights_ + self.bias_
            y_pred = self._sigmoid(z)
            
            # Compute loss
            loss = self._compute_loss(y_pred, y)
            self.loss_history_.append(loss)
            
            # Compute gradients
            error = y_pred - y
            dw = (1 / n_samples) * (X.T @ error)
            db = (1 / n_samples) * np.sum(error)
            
            # L2 regularization gradient
            if self.regularization > 0:
                dw += 2 * self.regularization * self.weights_
            
            # Update weights
            self.weights_ -= self.learning_rate * dw
            self.bias_ -= self.learning_rate * db
            
            if (iteration + 1) % 100 == 0:
                print(f"Iteration {iteration + 1}: Loss = {loss:.6f}")
        
        return self
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Predict probability of class 1."""
        z = X @ self.weights_ + self.bias_
        return self._sigmoid(z)
    
    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Predict class labels (0 or 1)."""
        probabilities = self.predict_proba(X)
        return (probabilities >= threshold).astype(int)
    
    def score(self, X: np.ndarray, y: np.ndarray) -> float:
        """Compute accuracy."""
        predictions = self.predict(X)
        return np.mean(predictions == y)


# ============================================================================
# STOCHASTIC & MINI-BATCH GRADIENT DESCENT
# ============================================================================

class SGDLinearRegression:
    """
    Linear Regression with Stochastic Gradient Descent.
    
    Instead of computing gradient over all samples, update weights
    using one sample (SGD) or a batch of samples (mini-batch) at a time.
    
    Benefits:
    - Faster per iteration
    - Can escape local minima
    - Works for online learning
    """
    
    def __init__(self,
                 learning_rate: float = 0.01,
                 n_epochs: int = 100,
                 batch_size: int = 32,
                 shuffle: bool = True,
                 random_state: Optional[int] = None):
        self.learning_rate = learning_rate
        self.n_epochs = n_epochs
        self.batch_size = batch_size
        self.shuffle = shuffle
        self.random_state = random_state
        
        self.weights_: Optional[np.ndarray] = None
        self.bias_: float = 0.0
        self.loss_history_: List[float] = []
    
    def fit(self, X: np.ndarray, y: np.ndarray) -> 'SGDLinearRegression':
        """Train with mini-batch SGD."""
        if self.random_state is not None:
            np.random.seed(self.random_state)
        
        n_samples, n_features = X.shape
        
        # Initialize weights
        self.weights_ = np.zeros(n_features)
        self.bias_ = 0.0
        self.loss_history_ = []
        
        for epoch in range(self.n_epochs):
            # Shuffle data
            if self.shuffle:
                indices = np.random.permutation(n_samples)
                X_shuffled = X[indices]
                y_shuffled = y[indices]
            else:
                X_shuffled = X
                y_shuffled = y
            
            epoch_loss = 0.0
            n_batches = 0
            
            # Process mini-batches
            for start in range(0, n_samples, self.batch_size):
                end = min(start + self.batch_size, n_samples)
                X_batch = X_shuffled[start:end]
                y_batch = y_shuffled[start:end]
                batch_size_actual = end - start
                
                # Forward pass
                y_pred = X_batch @ self.weights_ + self.bias_
                
                # Compute batch loss
                batch_loss = np.mean((y_pred - y_batch) ** 2)
                epoch_loss += batch_loss
                n_batches += 1
                
                # Compute gradients on this batch only
                error = y_pred - y_batch
                dw = (2 / batch_size_actual) * (X_batch.T @ error)
                db = (2 / batch_size_actual) * np.sum(error)
                
                # Update weights
                self.weights_ -= self.learning_rate * dw
                self.bias_ -= self.learning_rate * db
            
            avg_loss = epoch_loss / n_batches
            self.loss_history_.append(avg_loss)
            
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch + 1}: Loss = {avg_loss:.6f}")
        
        return self
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        return X @ self.weights_ + self.bias_


# ============================================================================
# GRADIENT DESCENT VARIANTS EXPLAINED
# ============================================================================

def gradient_descent_comparison():
    """
    Quick reference for gradient descent variants:
    
    1. BATCH GRADIENT DESCENT
       - Uses ALL samples to compute gradient
       - Stable, converges to minimum
       - Slow for large datasets
    
    2. STOCHASTIC GRADIENT DESCENT (SGD)
       - Uses ONE sample at a time
       - Fast, but noisy updates
       - Good for online learning
    
    3. MINI-BATCH GRADIENT DESCENT
       - Uses batch of samples (typically 32-256)
       - Balance between stability and speed
       - Most commonly used in practice
    
    Learning Rate Schedules:
    - Constant: lr stays same
    - Step decay: lr *= 0.1 every N epochs
    - Exponential decay: lr *= decay_rate each epoch
    - Adam/AdaGrad: Adaptive learning rates per parameter
    """
    pass


# ============================================================================
# DEMO
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Gradient Descent Demo")
    print("=" * 60)
    
    np.random.seed(42)
    
    # -------------------------
    # LINEAR REGRESSION DEMO
    # -------------------------
    print("\n" + "=" * 40)
    print("1. Linear Regression")
    print("=" * 40)
    
    # Generate synthetic data: y = 3*x1 + 2*x2 + 1 + noise
    n_samples = 100
    X_linear = np.random.randn(n_samples, 2)
    y_linear = 3 * X_linear[:, 0] + 2 * X_linear[:, 1] + 1 + 0.1 * np.random.randn(n_samples)
    
    print(f"Data: {n_samples} samples, 2 features")
    print(f"True coefficients: [3, 2], bias: 1")
    
    lr = LinearRegression(learning_rate=0.1, n_iterations=500)
    lr.fit(X_linear, y_linear)
    
    print(f"\nLearned weights: {lr.weights_}")
    print(f"Learned bias: {lr.bias_:.4f}")
    print(f"R² score: {lr.score(X_linear, y_linear):.4f}")
    
    # -------------------------
    # LOGISTIC REGRESSION DEMO
    # -------------------------
    print("\n" + "=" * 40)
    print("2. Logistic Regression (Binary Classification)")
    print("=" * 40)
    
    # Generate binary classification data
    X_class0 = np.random.randn(50, 2) + np.array([-2, -2])
    X_class1 = np.random.randn(50, 2) + np.array([2, 2])
    X_binary = np.vstack([X_class0, X_class1])
    y_binary = np.array([0] * 50 + [1] * 50)
    
    # Shuffle
    shuffle_idx = np.random.permutation(100)
    X_binary = X_binary[shuffle_idx]
    y_binary = y_binary[shuffle_idx]
    
    print(f"Data: {len(y_binary)} samples (50 per class)")
    
    log_reg = LogisticRegression(learning_rate=0.5, n_iterations=500)
    log_reg.fit(X_binary, y_binary)
    
    print(f"\nLearned weights: {log_reg.weights_}")
    print(f"Learned bias: {log_reg.bias_:.4f}")
    print(f"Accuracy: {log_reg.score(X_binary, y_binary):.4f}")
    
    # -------------------------
    # SGD DEMO
    # -------------------------
    print("\n" + "=" * 40)
    print("3. Mini-Batch SGD Linear Regression")
    print("=" * 40)
    
    sgd_lr = SGDLinearRegression(
        learning_rate=0.05,
        n_epochs=50,
        batch_size=16,
        random_state=42
    )
    sgd_lr.fit(X_linear, y_linear)
    
    print(f"\nLearned weights: {sgd_lr.weights_}")
    print(f"Learned bias: {sgd_lr.bias_:.4f}")
    
    print("\n" + "=" * 60)
    print("✅ Gradient descent implementations complete!")
    print("=" * 60)
    
    # -------------------------
    # EIGHTFOLD USE CASE
    # -------------------------
    print("\n" + "=" * 60)
    print("Eightfold Use Case: Match Score Regression")
    print("=" * 60)
    
    # Simulate: Predicting match score between candidate and job
    # Features: skill overlap, experience match, location proximity, etc.
    print("""
    Real-world application at Eightfold:
    
    Features (X):                     Target (y):
    - skill_overlap_score             - recruiter_rating (0-1)
    - years_experience_match  →       - hired_or_not (0/1)
    - education_level_match           - time_to_hire (regression)
    - location_proximity
    - salary_expectations_match
    
    Linear Regression: Predict match quality score
    Logistic Regression: Predict probability of hire
    """)
