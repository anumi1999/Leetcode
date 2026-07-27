/**
 * core.ts — business logic + recommendation cache
 *
 * Cache key: candidateId
 * Cache value: the top-5 Recommendation[] for that candidate
 *
 * Cache is invalidated when new jobs are added (via invalidateCache()).
 * On a cache hit the stored recommendations are returned immediately
 * without calling OpenAI.
 */

import { v4 as uuidv4 } from 'uuid';
import * as store from './store';
import { scoreJobs } from './aiService';
import { Recommendation } from './models/Recommendation';
import { Candidate } from './models/Candidate';
import { Job } from './models/Job';
import { logger } from './logger';

const TOP_N = 5;

// ── In-memory recommendation cache ───────────────────────────────────────────
const cache = new Map<string, Recommendation[]>();

export function invalidateCache(candidateId?: string): void {
  if (candidateId) {
    cache.delete(candidateId);
  } else {
    cache.clear(); // called when new jobs are added
  }
}

// ── Candidate CRUD ────────────────────────────────────────────────────────────
export function createCandidate(input: Omit<Candidate, 'candidateId' | 'recommendations' | 'noOfRecommendationRequests'>): Candidate {
  const candidate: Candidate = {
    ...input,
    candidateId: uuidv4(),
    recommendations: [],
    noOfRecommendationRequests: 0,
  };
  store.insertCandidate(candidate);
  logger.info('Candidate created', { candidateId: candidate.candidateId, name: candidate.name });
  return candidate;
}

export function getCandidate(id: string): Candidate | null {
  return store.getCandidate(id) ?? null;
}

// ── Job CRUD ──────────────────────────────────────────────────────────────────
export function createJob(input: Omit<Job, 'jobId'>): Job {
  const job: Job = { ...input, jobId: uuidv4() };
  store.insertJob(job);
  // New job means existing cached recommendations may be stale
  invalidateCache();
  logger.info('Job created', { jobId: job.jobId, name: job.name });
  return job;
}

// ── Recommendations ───────────────────────────────────────────────────────────
export async function getRecommendations(candidateId: string): Promise<Recommendation[]> {
  const candidate = store.getCandidate(candidateId);
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

  // Cache hit
  if (cache.has(candidateId)) {
    logger.info('Recommendation cache hit', { candidateId });
    store.updateCandidate(candidateId, {
      noOfRecommendationRequests: candidate.noOfRecommendationRequests + 1,
    });
    return cache.get(candidateId)!;
  }

  // Cache miss — call AI
  logger.info('Recommendation cache miss, calling AI', { candidateId });
  const allJobs = store.getAllJobs();
  if (allJobs.length === 0) throw new Error('No jobs available to match against');

  const scores = await scoreJobs(candidate, allJobs);

  // Take top N, build Recommendation objects
  const top = scores.slice(0, TOP_N);
  const recommendations: Recommendation[] = top.map((s, idx) => ({
    recommendationId:    uuidv4(),
    candidateId,
    jobId:               s.jobId,
    recommendationScore: s.score,
    ranking:             idx + 1,
    reason:              s.reason,
    createdAt:           new Date(),
  }));

  // Persist each recommendation
  recommendations.forEach(r => store.insertRecommendation(r));

  // Update candidate record
  store.updateCandidate(candidateId, {
    recommendations: [
      ...candidate.recommendations,
      ...recommendations.map(r => r.recommendationId),
    ],
    noOfRecommendationRequests: candidate.noOfRecommendationRequests + 1,
  });

  // Populate cache
  cache.set(candidateId, recommendations);

  logger.info('Recommendations generated and cached', {
    candidateId,
    count: recommendations.length,
  });

  return recommendations;
}
