import * as store from '../core/store';
import * as core from '../core/core';

// Reset in-memory store before each test
beforeEach(() => {
  store.clear();
});

describe('createTask', () => {
  it('creates a task with status pending', () => {
    const future = new Date(Date.now() + 60_000);
    const task = core.createTask('Buy milk', 'From the store', future);
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Buy milk');
    expect(task.status).toBe('pending');
  });
});

describe('getTask', () => {
  it('returns the task for a valid id', () => {
    const task = core.createTask('Test', 'desc', new Date(Date.now() + 60_000));
    expect(core.getTask(task.id)).toMatchObject({ id: task.id });
  });

  it('returns null for an unknown id', () => {
    expect(core.getTask('non-existent-id')).toBeNull();
  });
});

describe('getAllTasks', () => {
  beforeEach(() => {
    core.createTask('Alpha', 'a', new Date('2030-01-03'));
    core.createTask('Beta', 'b', new Date('2030-01-01'));
    core.createTask('Gamma', 'c', new Date('2030-01-02'));
  });

  it('returns all tasks', () => {
    expect(core.getAllTasks()).toHaveLength(3);
  });

  it('filters by status', () => {
    const tasks = core.getAllTasks();
    store.update(tasks[0].id, { status: 'done' });
    expect(core.getAllTasks('done')).toHaveLength(1);
    expect(core.getAllTasks('pending')).toHaveLength(2);
  });

  it('sorts by dueDate ascending', () => {
    const sorted = core.getAllTasks(undefined, 'dueDate');
    expect(sorted[0].title).toBe('Beta');
    expect(sorted[2].title).toBe('Alpha');
  });

  it('sorts by title alphabetically', () => {
    const sorted = core.getAllTasks(undefined, 'title');
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[2].title).toBe('Gamma');
  });
});

describe('updateTask', () => {
  it('updates the title of an existing task', () => {
    const task = core.createTask('Old', 'desc', new Date(Date.now() + 60_000));
    const updated = core.updateTask(task.id, { title: 'New' });
    expect(updated?.title).toBe('New');
  });

  it('marks a task as done', () => {
    const task = core.createTask('Todo', 'desc', new Date(Date.now() + 60_000));
    const updated = core.updateTask(task.id, { status: 'done' });
    expect(updated?.status).toBe('done');
  });

  it('returns null for unknown id', () => {
    expect(core.updateTask('bad-id', { title: 'x' })).toBeNull();
  });
});

describe('deleteTask', () => {
  it('removes an existing task and returns true', () => {
    const task = core.createTask('Delete me', 'desc', new Date(Date.now() + 60_000));
    expect(core.deleteTask(task.id)).toBe(true);
    expect(core.getTask(task.id)).toBeNull();
  });

  it('returns false for an unknown id', () => {
    expect(core.deleteTask('ghost')).toBe(false);
  });
});

describe('getOverdueTasks', () => {
  it('returns tasks with past due dates that are not done', () => {
    const past = new Date(Date.now() - 10_000);
    const future = new Date(Date.now() + 60_000);
    core.createTask('Overdue', 'desc', past);
    core.createTask('Future', 'desc', future);
    const overdue = core.getOverdueTasks();
    expect(overdue).toHaveLength(1);
    expect(overdue[0].title).toBe('Overdue');
  });

  it('excludes tasks marked as done even if past due', () => {
    const past = new Date(Date.now() - 10_000);
    const task = core.createTask('Done late', 'desc', past);
    core.updateTask(task.id, { status: 'done' });
    expect(core.getOverdueTasks()).toHaveLength(0);
  });
});
