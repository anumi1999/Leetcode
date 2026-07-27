import { Router, Request, Response } from 'express';
import * as core from './core';
import { logger } from './logger';

const router = Router();

// ── POST /user ────────────────────────────────────────────────────────────────
router.post('/user', (req: Request, res: Response) => {
  const { name, skills, experience, roles } = req.body;

  if (!name || !Array.isArray(skills) || experience === undefined || !Array.isArray(roles)) {
    return res.status(400).json({
      error: 'name, skills (array), experience (number), and roles (array) are required',
    });
  }

  if (typeof experience !== 'number' || experience < 0) {
    return res.status(400).json({ error: 'experience must be a non-negative number' });
  }

  const candidate = core.createCandidate({ name, skills, experience, roles });
  return res.status(201).json({ message: 'Successfully created', candidateId: candidate.candidateId });
});

// ── POST /job ─────────────────────────────────────────────────────────────────
router.post('/job', (req: Request, res: Response) => {
  const { name, description, skillsRequired, experience, role } = req.body;

  if (!name || !description || !Array.isArray(skillsRequired) || experience === undefined || !role) {
    return res.status(400).json({
      error: 'name, description, skillsRequired (array), experience (number), and role are required',
    });
  }

  if (typeof experience !== 'number' || experience < 0) {
    return res.status(400).json({ error: 'experience must be a non-negative number' });
  }

  const job = core.createJob({ name, description, skillsRequired, experience, role });
  return res.status(201).json({ message: 'Successfully created', jobId: job.jobId });
});

// ── GET /recommendation/:candidateId ─────────────────────────────────────────
router.get('/recommendation/:candidateId', async (req: Request, res: Response) => {
  try {
    const recommendations = await core.getRecommendations(req.params.candidateId);
    const candidate = core.getCandidate(req.params.candidateId);

    return res.json({
      candidateId: req.params.candidateId,
      noOfRecommendationRequests: candidate?.noOfRecommendationRequests ?? 0,
      recommendations,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GET /recommendation error', { error: message });

    if (message.startsWith('Candidate not found')) {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

export default router;
