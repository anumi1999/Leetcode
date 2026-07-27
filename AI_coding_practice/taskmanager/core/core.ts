// This is where all the manipulations and real data handling will be done for the task manager. 
// This would also include functions to create, read, update, and delete tasks, as well as any other business logic related to task management.
// Include cronjob that updates the status of tasks based on their due dates and completion status.

import cron from 'node-cron';
import * as store from './store';
import { Task, TaskStatus } from './store';
import { logger } from './logger';

export function createTask(title: string, description: string, dueDate: Date): Task {
  const task = store.insert({ title, description, dueDate });
  logger.info('Task created', { id: task.id, title: task.title, dueDate: task.dueDate });
  return task;
}

export function getTask(id: string): Task | null {
  const task = store.getById(id) ?? null;
  if (!task) logger.warn('Task not found', { id });
  return task;
}

export function getAllTasks(
  filter?: TaskStatus,
  sortBy?: 'dueDate' | 'createdAt' | 'title'
): Task[] {
  let tasks = [...store.getAll()];

  if (filter) {
    tasks = tasks.filter((t) => t.status === filter);
  }

  if (sortBy) {
    tasks.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
    });
  }

  logger.debug('Fetched tasks', { count: tasks.length, filter, sortBy });
  return tasks;
}

export function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'createdAt'>>
): Task | null {
  const task = store.update(id, updates);
  if (!task) {
    logger.warn('Update failed — task not found', { id });
  } else {
    logger.info('Task updated', { id, updates });
  }
  return task;
}

export function deleteTask(id: string): boolean {
  const deleted = store.remove(id);
  if (!deleted) {
    logger.warn('Delete failed — task not found', { id });
  } else {
    logger.info('Task deleted', { id });
  }
  return deleted;
}

export function getOverdueTasks(): Task[] {
  const now = new Date();
  const tasks = store.getAll().filter((t) => t.status !== 'done' && new Date(t.dueDate) < now);
  logger.debug('Fetched overdue tasks', { count: tasks.length });
  return tasks;
}

// Cron job: runs every minute — marks pending tasks as overdue if their due date has passed
cron.schedule('* * * * *', () => {
  const now = new Date();
  let marked = 0;
  store.getAll().forEach((task) => {
    if (task.status === 'pending' && new Date(task.dueDate) < now) {
      store.update(task.id, { status: 'overdue' });
      marked++;
    }
  });
  if (marked > 0) logger.info('Cron: marked tasks as overdue', { count: marked });
});
