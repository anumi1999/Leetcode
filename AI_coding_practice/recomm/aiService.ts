/**
 * aiService.ts — OpenAI-powered job scoring
 *
 * Given a candidate and a list of jobs, asks GPT-4o-mini to score and rank
 * each job and return a structured JSON response.
 *
 * The prompt is designed so GPT returns a JSON array ordered by score desc:
 * [
 *   { "jobId": "...", "score": 87, "reason": "..." },
 *   ...
 * ]
 */

import OpenAI from 'openai';
import { Candidate } from './models/Candidate';
import { Job } from './models/Job';
import { logger } from './logger';

// Lazily instantiated so tests can mock this module before the client is created
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export interface JobScore {
  jobId: string;
  score: number;   // 0–100
  reason: string;
}

export async function scoreJobs(candidate: Candidate, jobs: Job[]): Promise<JobScore[]> {
  const candidateSummary = {
    name:       candidate.name,
    skills:     candidate.skills,
    experience: candidate.experience,
    roles:      candidate.roles,
  };

  const jobSummaries = jobs.map(j => ({
    jobId:          j.jobId,
    name:           j.name,
    role:           j.role,
    skillsRequired: j.skillsRequired,
    experience:     j.experience,
    description:    j.description,
  }));

  const prompt = `
You are a job-matching AI. Score how well the candidate fits each job on a scale of 0–100.
Return ONLY a valid JSON array (no markdown, no explanation outside the JSON) with this exact shape:
[{ "jobId": "<id>", "score": <number>, "reason": "<one sentence why>" }]
Order the array from highest score to lowest.

Candidate:
${JSON.stringify(candidateSummary, null, 2)}

Jobs:
${JSON.stringify(jobSummaries, null, 2)}
`.trim();

  logger.debug('Calling OpenAI for job scoring', {
    candidateId: candidate.candidateId,
    jobCount: jobs.length,
  });

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? '[]';

  try {
    const scores: JobScore[] = JSON.parse(raw);
    logger.debug('OpenAI scoring complete', { candidateId: candidate.candidateId, count: scores.length });
    return scores;
  } catch {
    logger.error('Failed to parse OpenAI response', { raw });
    throw new Error('AI service returned invalid JSON');
  }
}
