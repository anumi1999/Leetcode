"""
TF-IDF and Feature Engineering from Scratch
============================================
Essential for processing resume text and job descriptions into numerical features.

This is a COMMON interview question at Eightfold:
"Given resume texts, convert them to feature vectors for ML."
"""

import numpy as np
import re
from typing import List, Dict, Tuple, Optional
from collections import Counter


# ============================================================================
# TEXT PREPROCESSING
# ============================================================================

def tokenize(text: str, lowercase: bool = True) -> List[str]:
    """
    Simple word tokenizer.
    
    Args:
        text: Raw text string
        lowercase: Whether to convert to lowercase
    
    Returns:
        List of tokens (words)
    """
    if lowercase:
        text = text.lower()
    
    # Remove special characters, keep alphanumeric and spaces
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    
    # Split on whitespace and filter empty strings
    tokens = [token.strip() for token in text.split() if token.strip()]
    return tokens


def remove_stopwords(tokens: List[str], 
                     stopwords: Optional[set] = None) -> List[str]:
    """
    Remove common stopwords from token list.
    """
    if stopwords is None:
        # Basic English stopwords
        stopwords = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall',
            'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
            'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
            'through', 'during', 'before', 'after', 'above', 'below',
            'between', 'under', 'again', 'further', 'then', 'once',
            'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either',
            'neither', 'not', 'only', 'own', 'same', 'than', 'too',
            'very', 'just', 'also', 'now', 'i', 'me', 'my', 'we', 'our',
            'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
            'they', 'them', 'their', 'this', 'that', 'these', 'those',
        }
    return [token for token in tokens if token not in stopwords]


# ============================================================================
# TERM FREQUENCY (TF)
# ============================================================================

def compute_tf(tokens: List[str], normalize: bool = True) -> Dict[str, float]:
    """
    Compute Term Frequency for a document.
    
    TF(t, d) = count(t in d) / total_terms_in_d  (if normalized)
    
    Args:
        tokens: List of tokens from a document
        normalize: Whether to normalize by document length
    
    Returns:
        Dictionary mapping term -> TF score
    """
    counts = Counter(tokens)
    
    if normalize and len(tokens) > 0:
        return {term: count / len(tokens) for term, count in counts.items()}
    else:
        return dict(counts)


def compute_tf_log(tokens: List[str]) -> Dict[str, float]:
    """
    Log-normalized Term Frequency.
    
    TF(t, d) = 1 + log(count(t in d))  if count > 0, else 0
    
    This dampens the effect of very frequent terms.
    """
    counts = Counter(tokens)
    return {term: 1 + np.log(count) for term, count in counts.items()}


# ============================================================================
# INVERSE DOCUMENT FREQUENCY (IDF)
# ============================================================================

def compute_idf(documents: List[List[str]], smooth: bool = True) -> Dict[str, float]:
    """
    Compute Inverse Document Frequency across corpus.
    
    IDF(t) = log(N / df(t))  where df(t) = docs containing term t
    
    With smoothing:
    IDF(t) = log((N + 1) / (df(t) + 1)) + 1
    
    Args:
        documents: List of tokenized documents
        smooth: Whether to apply smoothing (recommended)
    
    Returns:
        Dictionary mapping term -> IDF score
    """
    N = len(documents)
    
    # Document frequency: how many docs contain each term
    df = Counter()
    for doc in documents:
        unique_terms = set(doc)
        df.update(unique_terms)
    
    idf = {}
    for term, doc_count in df.items():
        if smooth:
            idf[term] = np.log((N + 1) / (doc_count + 1)) + 1
        else:
            idf[term] = np.log(N / doc_count)
    
    return idf


# ============================================================================
# TF-IDF VECTORIZER (Full Implementation)
# ============================================================================

class TFIDFVectorizer:
    """
    Complete TF-IDF Vectorizer from scratch.
    
    Usage:
        vectorizer = TFIDFVectorizer()
        tfidf_matrix = vectorizer.fit_transform(documents)
        # For new documents:
        new_vectors = vectorizer.transform(new_documents)
    """
    
    def __init__(self, 
                 max_features: Optional[int] = None,
                 min_df: int = 1,
                 max_df: float = 1.0,
                 use_stopwords: bool = True):
        """
        Args:
            max_features: Maximum number of features (vocabulary size)
            min_df: Minimum document frequency for a term to be included
            max_df: Maximum document frequency ratio (0.95 = ignore terms in >95% docs)
            use_stopwords: Whether to remove stopwords
        """
        self.max_features = max_features
        self.min_df = min_df
        self.max_df = max_df
        self.use_stopwords = use_stopwords
        
        self.vocabulary_: Dict[str, int] = {}  # term -> index
        self.idf_: Dict[str, float] = {}
        self.feature_names_: List[str] = []
    
    def _preprocess(self, text: str) -> List[str]:
        """Tokenize and optionally remove stopwords."""
        tokens = tokenize(text)
        if self.use_stopwords:
            tokens = remove_stopwords(tokens)
        return tokens
    
    def fit(self, documents: List[str]) -> 'TFIDFVectorizer':
        """
        Learn vocabulary and IDF values from documents.
        """
        # Tokenize all documents
        tokenized_docs = [self._preprocess(doc) for doc in documents]
        N = len(documents)
        
        # Compute document frequency
        df = Counter()
        for doc in tokenized_docs:
            df.update(set(doc))
        
        # Filter by min_df and max_df
        max_doc_count = int(self.max_df * N) if isinstance(self.max_df, float) else self.max_df
        
        valid_terms = [
            term for term, count in df.items()
            if count >= self.min_df and count <= max_doc_count
        ]
        
        # Sort by document frequency (descending) for consistent ordering
        valid_terms = sorted(valid_terms, key=lambda t: (-df[t], t))
        
        # Limit to max_features
        if self.max_features:
            valid_terms = valid_terms[:self.max_features]
        
        # Build vocabulary
        self.vocabulary_ = {term: idx for idx, term in enumerate(valid_terms)}
        self.feature_names_ = valid_terms
        
        # Compute IDF with smoothing
        self.idf_ = {}
        for term in valid_terms:
            self.idf_[term] = np.log((N + 1) / (df[term] + 1)) + 1
        
        return self
    
    def transform(self, documents: List[str]) -> np.ndarray:
        """
        Transform documents to TF-IDF matrix.
        
        Returns:
            Matrix of shape (n_documents, n_features)
        """
        n_docs = len(documents)
        n_features = len(self.vocabulary_)
        
        tfidf_matrix = np.zeros((n_docs, n_features))
        
        for doc_idx, doc in enumerate(documents):
            tokens = self._preprocess(doc)
            tf = compute_tf(tokens, normalize=True)
            
            for term, tf_value in tf.items():
                if term in self.vocabulary_:
                    feature_idx = self.vocabulary_[term]
                    idf_value = self.idf_[term]
                    tfidf_matrix[doc_idx, feature_idx] = tf_value * idf_value
        
        return tfidf_matrix
    
    def fit_transform(self, documents: List[str]) -> np.ndarray:
        """Fit and transform in one call."""
        self.fit(documents)
        return self.transform(documents)
    
    def get_feature_names(self) -> List[str]:
        """Return list of feature names (vocabulary)."""
        return self.feature_names_


# ============================================================================
# ADDITIONAL FEATURE ENGINEERING UTILITIES
# ============================================================================

def encode_categorical(values: List[str]) -> Tuple[np.ndarray, Dict[str, int]]:
    """
    One-hot encode categorical values.
    
    Args:
        values: List of categorical values
    
    Returns:
        (encoded_matrix, category_to_index mapping)
    """
    unique_values = sorted(set(values))
    value_to_idx = {v: i for i, v in enumerate(unique_values)}
    
    n_samples = len(values)
    n_categories = len(unique_values)
    encoded = np.zeros((n_samples, n_categories))
    
    for i, v in enumerate(values):
        encoded[i, value_to_idx[v]] = 1
    
    return encoded, value_to_idx


def handle_missing_numerical(values: np.ndarray, 
                             strategy: str = 'mean') -> np.ndarray:
    """
    Handle missing values (NaN) in numerical data.
    
    Args:
        values: 1D array with potential NaN values
        strategy: 'mean', 'median', 'zero', or 'drop'
    
    Returns:
        Array with NaN values replaced (or removed if 'drop')
    """
    result = values.copy()
    mask = np.isnan(result)
    
    if not np.any(mask):
        return result
    
    if strategy == 'mean':
        fill_value = np.nanmean(values)
    elif strategy == 'median':
        fill_value = np.nanmedian(values)
    elif strategy == 'zero':
        fill_value = 0
    elif strategy == 'drop':
        return result[~mask]
    else:
        raise ValueError(f"Unknown strategy: {strategy}")
    
    result[mask] = fill_value
    return result


def normalize_features(X: np.ndarray, method: str = 'minmax') -> np.ndarray:
    """
    Normalize feature matrix.
    
    Args:
        X: Feature matrix (n_samples, n_features)
        method: 'minmax' (0-1 scaling) or 'zscore' (standard scaling)
    """
    if method == 'minmax':
        min_vals = X.min(axis=0)
        max_vals = X.max(axis=0)
        range_vals = max_vals - min_vals
        range_vals[range_vals == 0] = 1  # Avoid division by zero
        return (X - min_vals) / range_vals
    
    elif method == 'zscore':
        mean = X.mean(axis=0)
        std = X.std(axis=0)
        std[std == 0] = 1
        return (X - mean) / std
    
    else:
        raise ValueError(f"Unknown method: {method}")


# ============================================================================
# DEMO
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("TF-IDF Feature Engineering Demo")
    print("=" * 60)
    
    # Sample resume texts
    resumes = [
        "Senior Python developer with 5 years experience in machine learning and data science. Expert in TensorFlow and PyTorch.",
        "Full stack engineer skilled in JavaScript React Node.js. Building scalable web applications.",
        "Data scientist with strong Python skills. Experience in NLP, deep learning, and statistical modeling.",
        "Machine learning engineer. Python TensorFlow PyTorch. Computer vision and recommendation systems.",
        "Backend developer Java Spring Boot microservices. AWS cloud infrastructure experience.",
    ]
    
    job_description = "Looking for a machine learning engineer with Python experience. TensorFlow and PyTorch knowledge required."
    
    print("\n📄 Sample Resumes:")
    for i, r in enumerate(resumes, 1):
        print(f"  {i}. {r[:60]}...")
    
    print(f"\n🎯 Job Description:\n  {job_description}")
    
    # Create and fit TF-IDF vectorizer
    print("\n--- Training TF-IDF Vectorizer ---")
    vectorizer = TFIDFVectorizer(max_features=20, min_df=1)
    tfidf_matrix = vectorizer.fit_transform(resumes)
    
    print(f"Vocabulary size: {len(vectorizer.vocabulary_)}")
    print(f"Top features: {vectorizer.feature_names_[:10]}")
    print(f"TF-IDF matrix shape: {tfidf_matrix.shape}")
    
    # Transform job description
    print("\n--- Matching Job to Resumes ---")
    job_vector = vectorizer.transform([job_description])
    
    # Compute cosine similarity
    def cosine_sim(a, b):
        dot = np.sum(a * b)
        norm_a = np.sqrt(np.sum(a ** 2))
        norm_b = np.sqrt(np.sum(b ** 2))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)
    
    similarities = []
    for i, resume_vec in enumerate(tfidf_matrix):
        sim = cosine_sim(job_vector[0], resume_vec)
        similarities.append((i, sim))
    
    # Sort by similarity
    similarities.sort(key=lambda x: -x[1])
    
    print("\nRanked candidates (by TF-IDF similarity):")
    for rank, (idx, sim) in enumerate(similarities, 1):
        print(f"  {rank}. Resume {idx+1}: similarity={sim:.4f}")
        print(f"     \"{resumes[idx][:50]}...\"")
    
    # Demo categorical encoding
    print("\n--- Categorical Encoding Demo ---")
    job_levels = ["senior", "junior", "mid", "senior", "mid"]
    encoded, mapping = encode_categorical(job_levels)
    print(f"Levels: {job_levels}")
    print(f"Mapping: {mapping}")
    print(f"Encoded:\n{encoded}")
    
    print("\n" + "=" * 60)
    print("✅ Feature engineering complete!")
    print("=" * 60)
