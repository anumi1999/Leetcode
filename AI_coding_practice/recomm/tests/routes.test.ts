/**
 * Tests mock aiService.scoreJobs so no OPENAI_API_KEY is needed.
 */

import request from 'supertest';
import { app } from '../index';
import * as store from '../store';
import * as aiService from '../aiService';
import { invalidateCache } from '../core';
import * as storeModule from '../store';

// Mock the AI layer
jest.mock('../aiService');
const mockScoreJobs = aiService.scoreJobs as jest.MockedFunction<typeof aiService.scoreJobs>;

// Fixed AI response covering all seeded jobs
const AI_SCORES = [
  { jobId: 'job-001', score: 92, reason: 'Strong Node.js and TypeScript match.' },
  { jobId: 'job-002', score: 85, reason: 'Full stack skills align well.' },
  { jobId: 'job-003', score: 60, reason: 'Some overlap in backend skills.' },
  { jobId: 'job-004', score: 45, reason: 'Limited data skills.' },
  { jobId: 'job-005', score: 30, reason: 'Product role mismatch.' },
  { jobId: 'job-006', score: 75, reason: 'React experience is a good fit.' },
];

beforeEach(() => {
  mockScoreJobs.mockClear();
  mockScoreJobs.mockResolvedValue(AI_SCORES);
  invalidateCache();      // clear recommendation cache
  storeModule.resetStore(); // reset candidate/job state to clean seed
});

// ── POST /user ────────────────────────────────────────────────────────────────

describe('POST /user', () => {
  it('creates a candidate and returns 201', async () => {
    const res = await request(app).post('/user').send({
      name: 'Dave', skills: ['Go', 'Kubernetes'], experience: 5, roles: ['DevOps Engineer'],
    });
    expect(res.status).toBe(201);
    expect(res.body.candidateId).toBeDefined();
    expect(res.body.message).toMatch(/successfully created/i);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/user').send({
      skills: ['Go'], experience: 3, roles: ['Engineer'],
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when skills is not an array', async () => {
    const res = await request(app).post('/user').send({
      name: 'Eve', skills: 'Python', experience: 2, roles: ['Data Scientist'],
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when experience is negative', async () => {
    const res = await request(app).post('/user').send({
      name: 'Frank', skills: ['Java'], experience: -1, roles: ['Engineer'],
    });
    expect(res.status).toBe(400);
  });
});

// ── POST /job ─────────────────────────────────────────────────────────────────

describe('POST /job', () => {
  it('creates a job and returns 201', async () => {
    const res = await request(app).post('/job').send({
      name: 'Site Reliability Engineer',
      description: 'Keep the lights on.',
      skillsRequired: ['Kubernetes', 'Prometheus'],
      experience: 4,
      role: 'SRE',
    });
    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();
  });

  it('returns 400 when skillsRequired is missing', async () => {
    const res = await request(app).post('/job').send({
      name: 'SRE', description: 'desc', experience: 3, role: 'SRE',
    });
    expect(res.status).toBe(400);
  });
});

// ── GET /recommendation/:candidateId ─────────────────────────────────────────

describe('GET /recommendation/:candidateId', () => {
  it('returns top-5 recommendations for a seeded candidate', async () => {
    const res = await request(app).get('/recommendation/cand-001');
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(5);
    expect(res.body.recommendations[0].ranking).toBe(1);
    expect(res.body.recommendations[0].recommendationScore).toBe(92);
  });

  it('increments noOfRecommendationRequests on each call', async () => {
    await request(app).get('/recommendation/cand-001');
    await request(app).get('/recommendation/cand-001'); // cache hit
    const res = await request(app).get('/recommendation/cand-001');
    expect(res.body.noOfRecommendationRequests).toBe(3);
  });

  it('serves from cache on second request (AI called only once)', async () => {
    await request(app).get('/recommendation/cand-002');
    await request(app).get('/recommendation/cand-002');
    expect(mockScoreJobs).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for unknown candidateId', async () => {
    const res = await request(app).get('/recommendation/ghost-cand');
    expect(res.status).toBe(404);
  });

  it('rankings are 1-indexed and ascending', async () => {
    const res = await request(app).get('/recommendation/cand-001');
    const rankings = res.body.recommendations.map((r: { ranking: number }) => r.ranking);
    expect(rankings).toEqual([1, 2, 3, 4, 5]);
  });

  it('stores recommendationIds on the candidate record', async () => {
    await request(app).get('/recommendation/cand-001');
    const candidate = store.getCandidate('cand-001');
    expect(candidate?.recommendations.length).toBeGreaterThan(0);
  });
});
