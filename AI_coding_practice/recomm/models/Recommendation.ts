export interface Recommendation {
  recommendationId: string;
  candidateId: string;
  jobId: string;
  recommendationScore: number;   // 0–100
  ranking: number;               // 1 = best
  reason: string;
  createdAt: Date;
}
