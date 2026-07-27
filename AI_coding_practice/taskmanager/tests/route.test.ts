import request from 'supertest';
import { app } from '../index';
import * as store from '../core/store';

// Reset store before each test
beforeEach(() => {
  store.clear();
});

const FUTURE = new Date(Date.now() + 86_400_000).toISOString(); // +1 day
const PAST = new Date(Date.now() - 86_400_000).toISOString();   // -1 day

// ─── POST /tasks ──────────────────────────────────────────────────────────────

describe('POST /tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await request(app).post('/tasks').send({
      title: 'My Task',
      description: 'Some work',
      dueDate: FUTURE,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ description: 'x', dueDate: FUTURE });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid dueDate', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'x', description: 'y', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

// ─── GET /tasks ───────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
  beforeEach(async () => {
    await request(app).post('/tasks').send({ title: 'A', description: 'desc', dueDate: FUTURE });
    await request(app).post('/tasks').send({ title: 'B', description: 'desc', dueDate: FUTURE });
  });

  it('returns all tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters by status', async () => {
    const all = await request(app).get('/tasks');
    const id = all.body[0].id;
    await request(app).put(`/tasks/${id}`).send({ status: 'done' });

    const res = await request(app).get('/tasks?status=done');
    expect(res.body).toHaveLength(1);
  });

  it('returns 400 for invalid status filter', async () => {
    const res = await request(app).get('/tasks?status=invalid');
    expect(res.status).toBe(400);
  });

  it('sorts by title', async () => {
    const res = await request(app).get('/tasks?sortBy=title');
    expect(res.body[0].title).toBe('A');
    expect(res.body[1].title).toBe('B');
  });
});

// ─── GET /tasks/overdue ───────────────────────────────────────────────────────

describe('GET /tasks/overdue', () => {
  it('returns overdue tasks', async () => {
    await request(app).post('/tasks').send({ title: 'Late', description: 'd', dueDate: PAST });
    await request(app).post('/tasks').send({ title: 'OnTime', description: 'd', dueDate: FUTURE });

    const res = await request(app).get('/tasks/overdue');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Late');
  });

  it('excludes done tasks', async () => {
    const create = await request(app)
      .post('/tasks')
      .send({ title: 'DoneLate', description: 'd', dueDate: PAST });
    await request(app).put(`/tasks/${create.body.id}`).send({ status: 'done' });

    const res = await request(app).get('/tasks/overdue');
    expect(res.body).toHaveLength(0);
  });
});

// ─── GET /tasks/:id ───────────────────────────────────────────────────────────

describe('GET /tasks/:id', () => {
  it('returns a task by id', async () => {
    const create = await request(app)
      .post('/tasks')
      .send({ title: 'Find me', description: 'd', dueDate: FUTURE });
    const res = await request(app).get(`/tasks/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Find me');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/tasks/unknown-id');
    expect(res.status).toBe(404);
  });
});

// ─── PUT /tasks/:id ───────────────────────────────────────────────────────────

describe('PUT /tasks/:id', () => {
  it('updates title and status', async () => {
    const create = await request(app)
      .post('/tasks')
      .send({ title: 'Old', description: 'desc', dueDate: FUTURE });
    const res = await request(app)
      .put(`/tasks/${create.body.id}`)
      .send({ title: 'New', status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.status).toBe('done');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const create = await request(app)
      .post('/tasks')
      .send({ title: 'T', description: 'd', dueDate: FUTURE });
    const res = await request(app)
      .put(`/tasks/${create.body.id}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /tasks/:id ────────────────────────────────────────────────────────

describe('DELETE /tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const create = await request(app)
      .post('/tasks')
      .send({ title: 'Bye', description: 'd', dueDate: FUTURE });
    const res = await request(app).delete(`/tasks/${create.body.id}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/tasks/${create.body.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/tasks/ghost');
    expect(res.status).toBe(404);
  });
});
