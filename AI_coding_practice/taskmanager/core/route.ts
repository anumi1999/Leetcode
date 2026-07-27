// This file is to take care about all the endpoints for the task manager
// POST /tasks → create a task with a title, description, and due date
// GET /tasks → return all tasks
// PUT /tasks/:id → update a task (mark complete, change title, etc.)
// DELETE /tasks/:id → delete a task
// GET /tasks/overdue → return all tasks where due date has passed and task is not complete

import { Router, Request, Response } from 'express';
import * as core from './core';
import { TaskStatus } from './store';

const router = Router();

const VALID_STATUSES: TaskStatus[] = ['pending', 'done', 'overdue'];
const VALID_SORTS = ['dueDate', 'createdAt', 'title'] as const;

// POST /tasks — create a task
router.post('/', (req: Request, res: Response) => {
  const { title, description, dueDate } = req.body;

  if (!title || !description || !dueDate) {
    return res.status(400).json({ error: 'title, description, and dueDate are required' });
  }

  const parsedDate = new Date(dueDate);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'Invalid dueDate — use ISO 8601 format' });
  }

  const task = core.createTask(String(title), String(description), parsedDate);
  return res.status(201).json(task);
});

// GET /tasks — return all tasks (optional ?status= and ?sortBy= query params)
router.get('/', (req: Request, res: Response) => {
  const { status, sortBy } = req.query;

  if (status && !VALID_STATUSES.includes(status as TaskStatus)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (sortBy && !VALID_SORTS.includes(sortBy as (typeof VALID_SORTS)[number])) {
    return res.status(400).json({ error: `sortBy must be one of: ${VALID_SORTS.join(', ')}` });
  }

  const tasks = core.getAllTasks(
    status as TaskStatus | undefined,
    sortBy as 'dueDate' | 'createdAt' | 'title' | undefined
  );
  return res.json(tasks);
});

// GET /tasks/overdue — tasks past due date that are not done
router.get('/overdue', (_req: Request, res: Response) => {
  return res.json(core.getOverdueTasks());
});

// GET /tasks/:id — get a single task
router.get('/:id', (req: Request, res: Response) => {
  const task = core.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json(task);
});

// PUT /tasks/:id — update a task
router.put('/:id', (req: Request, res: Response) => {
  const { title, description, dueDate, status } = req.body;
  const updates: Parameters<typeof core.updateTask>[1] = {};

  if (title !== undefined) updates.title = String(title);
  if (description !== undefined) updates.description = String(description);

  if (dueDate !== undefined) {
    const parsedDate = new Date(dueDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid dueDate — use ISO 8601 format' });
    }
    updates.dueDate = parsedDate;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    updates.status = status as TaskStatus;
  }

  const task = core.updateTask(req.params.id, updates);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json(task);
});

// DELETE /tasks/:id — delete a task
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = core.deleteTask(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Task not found' });
  return res.status(204).send();
});

export default router;
