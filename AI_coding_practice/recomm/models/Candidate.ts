export interface Candidate {
  candidateId: string;
  name: string;
  skills: string[];
  experience: number;
  roles: string[];
  recommendations: string[];          // RecommendationIds
  noOfRecommendationRequests: number;
}
