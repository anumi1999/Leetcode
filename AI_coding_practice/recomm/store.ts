import { Candidate } from './models/Candidate';
import { Job } from './models/Job';
import { Recommendation } from './models/Recommendation';

const candidates    = new Map<string, Candidate>();
const jobs          = new Map<string, Job>();
const recommendations = new Map<string, Recommendation>();

// ── Candidates ────────────────────────────────────────────────────────────────
export function insertCandidate(c: Candidate): void {
  candidates.set(c.candidateId, c);
}

export function getCandidate(id: string): Candidate | undefined {
  return candidates.get(id);
}

export function getAllCandidates(): Candidate[] {
  return [...candidates.values()];
}

export function updateCandidate(id: string, patch: Partial<Candidate>): Candidate | null {
  const c = candidates.get(id);
  if (!c) return null;
  Object.assign(c, patch);
  return c;
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export function insertJob(j: Job): void {
  jobs.set(j.jobId, j);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function getAllJobs(): Job[] {
  return [...jobs.values()];
}

// ── Recommendations ───────────────────────────────────────────────────────────
export function insertRecommendation(r: Recommendation): void {
  recommendations.set(r.recommendationId, r);
}

export function getRecommendation(id: string): Recommendation | undefined {
  return recommendations.get(id);
}

export function getRecommendationsByCandidate(candidateId: string): Recommendation[] {
  return [...recommendations.values()].filter(r => r.candidateId === candidateId);
}

// ── Reset (test helper) ─────────────────────────────────────────────────────
export function resetStore(): void {
  candidates.clear();
  jobs.clear();
  recommendations.clear();
  seed();
}

// ── Seed data ─────────────────────────────────────────────────────────────────
export function seed(): void {
  insertCandidate({
    candidateId: 'cand-001', name: 'Alice', experience: 4,
    skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
    roles: ['Software Engineer', 'Full Stack Developer'],
    recommendations: [], noOfRecommendationRequests: 0,
  });
  insertCandidate({
    candidateId: 'cand-002', name: 'Bob', experience: 7,
    skills: ['Python', 'Machine Learning', 'PyTorch', 'SQL'],
    roles: ['ML Engineer', 'Data Scientist'],
    recommendations: [], noOfRecommendationRequests: 0,
  });
  insertCandidate({
    candidateId: 'cand-003', name: 'Carol', experience: 2,
    skills: ['Product Strategy', 'Agile', 'Figma', 'Data Analysis'],
    roles: ['Product Manager'],
    recommendations: [], noOfRecommendationRequests: 0,
  });

  insertJob({
    jobId: 'job-001', name: 'Senior Backend Engineer', role: 'Software Engineer',
    experience: 4, skillsRequired: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs'],
    description: 'Build scalable backend services for Eightfold\'s core platform.',
  });
  insertJob({
    jobId: 'job-002', name: 'Full Stack Developer', role: 'Full Stack Developer',
    experience: 3, skillsRequired: ['React', 'Node.js', 'TypeScript', 'GraphQL'],
    description: 'Work across the stack on candidate-facing product features.',
  });
  insertJob({
    jobId: 'job-003', name: 'ML Engineer', role: 'ML Engineer',
    experience: 5, skillsRequired: ['Python', 'PyTorch', 'Machine Learning', 'MLOps'],
    description: 'Train and deploy recommendation models at scale.',
  });
  insertJob({
    jobId: 'job-004', name: 'Data Scientist', role: 'Data Scientist',
    experience: 3, skillsRequired: ['Python', 'SQL', 'Statistics', 'Machine Learning'],
    description: 'Analyze hiring trends and build predictive models.',
  });
  insertJob({
    jobId: 'job-005', name: 'Product Manager – AI', role: 'Product Manager',
    experience: 3, skillsRequired: ['Product Strategy', 'Agile', 'Data Analysis', 'Stakeholder Management'],
    description: 'Own the roadmap for AI-powered hiring features.',
  });
  insertJob({
    jobId: 'job-006', name: 'Frontend Engineer', role: 'Software Engineer',
    experience: 2, skillsRequired: ['React', 'TypeScript', 'CSS', 'Figma'],
    description: 'Build beautiful, accessible UIs for Eightfold\'s recruiter dashboard.',
  });
}
