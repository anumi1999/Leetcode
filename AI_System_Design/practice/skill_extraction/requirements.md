Design a machine learning system that predicts the likelihood a candidate will accept a job offer, given a candidate's profile and a specific job/offer. This helps recruiters prioritize which candidates to pursue and can inform offer negotiation strategy.

Business need: yes, we have historical data — every time an offer was extended to a candidate in the past, we know the outcome: accepted or declined
Data: Candidate profile -> yoe, current salary, skills , job details, interaction, historical outcome, offered salary, competitive offers, location, flexibility, company profile
Latency:  Offline
Scale: small per-recruiter volume (tens of active offers), naturally scoped to candidates in an active offer process.
Timing: fires after an offer is extended, so real offer terms are available as input.

Binary classification: prediction: accepting/ declining offer 
Objective function: sigmoid output layer + binary cross-entropy loss

Online: log Loss, Brier Score, Calibration Curve, AUC
Offline: A/B Testing, online calibration monitoring

Model: gradient-boosted trees (XGBoost/LightGBM) — right fit for tabular data, no scaling needed (unlike neural nets), interpretable via feature importance.
Calibration: mandatory post-training step (Platt scaling/isotonic regression) regardless of model family — tree ensembles are particularly prone to pushing scores toward extremes.
Data split: time-based/chronological split (train on oldest, test on most recent) — prevents look-ahead bias/data leakage, since production never sees future data at prediction time.
Class imbalance: decline is the likely minority class (most offers get accepted, given pre-offer filtering already happened) — start with class weighting before reaching for resampling techniques like SMOTE.



