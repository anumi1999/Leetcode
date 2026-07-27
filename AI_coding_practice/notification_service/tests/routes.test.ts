import request from 'supertest';
import { app } from '../index';
import * as store from '../store';

// Seeded IDs (from store.seed())
const CANDIDATE_ID   = 'cand-001';
const JOB_ID         = 'job-001';
const APPLICATION_ID = 'app-001';
const RECRUITER_ID   = 'rec-001';

// Helper to create a notification synchronously
async function createNotif(overrides: Record<string, string> = {}) {
  return request(app).post('/notification').send({
    candidateId:         CANDIDATE_ID,
    jobId:               JOB_ID,
    applicationId:       APPLICATION_ID,
    recruiterId:         RECRUITER_ID,
    notificationDetails: 'Your application has been reviewed.',
    ...overrides,
  });
}

// ── POST /notification ────────────────────────────────────────────────────────

describe('POST /notification', () => {
  it('returns 201 with pending status and 3 channels', async () => {
    const res = await createNotif();
    expect(res.status).toBe(201);
    expect(res.body.notificationId).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.channels).toHaveLength(3);
    expect(res.body.channels.map((c: { channel: string }) => c.channel).sort()).toEqual(['email', 'inapp', 'sms']);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/notification').send({ candidateId: CANDIDATE_ID });
    expect(res.status).toBe(400);
  });

  it('returns 404 when candidateId does not exist', async () => {
    const res = await createNotif({ candidateId: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when jobId does not exist', async () => {
    const res = await createNotif({ jobId: 'ghost-job' });
    expect(res.status).toBe(404);
  });

  it('attaches notificationId to candidate record', async () => {
    const res = await createNotif();
    const candidate = store.getCandidate(CANDIDATE_ID);
    expect(candidate?.notificationIds).toContain(res.body.notificationId);
  });
});

// ── GET /status/:notificationId ───────────────────────────────────────────────

describe('GET /status/:notificationId', () => {
  it('returns the notification', async () => {
    const created = await createNotif();
    const res = await request(app).get(`/status/${created.body.notificationId}`);
    expect(res.status).toBe(200);
    expect(res.body.notificationId).toBe(created.body.notificationId);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/status/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ── GET /status/notification ──────────────────────────────────────────────────

describe('GET /status/notification', () => {
  it('returns notifications filtered by jobId', async () => {
    await createNotif();
    const res = await request(app).get(`/status/notification?jobId=${JOB_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    res.body.forEach((n: { jobId: string }) => expect(n.jobId).toBe(JOB_ID));
  });

  it('returns notifications filtered by applicationId', async () => {
    await createNotif();
    const res = await request(app).get(`/status/notification?applicationId=${APPLICATION_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 400 for invalid status filter', async () => {
    const res = await request(app).get('/status/notification?status=unknown');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid channel filter', async () => {
    const res = await request(app).get('/status/notification?channel=fax');
    expect(res.status).toBe(400);
  });
});

// ── GET /status/stats ─────────────────────────────────────────────────────────

describe('GET /status/stats', () => {
  it('returns total, sent, failed, pending counts', async () => {
    await createNotif();
    const res = await request(app).get('/status/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('sent');
    expect(res.body).toHaveProperty('failed');
    expect(res.body).toHaveProperty('pending');
    expect(res.body.total).toBeGreaterThan(0);
  });
});
