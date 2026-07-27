// This is for in-memory storage of tasks. It will be used by the core.ts file to store and retrieve tasks.

import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'pending' | 'done' | 'overdue';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  status: TaskStatus;
  createdAt: Date;
}

const tasks: Task[] = [];

export function getAll(): Task[] {
  return tasks;
}

export function getById(id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

export function insert(data: Omit<Task, 'id' | 'status' | 'createdAt'>): Task {
  const newTask: Task = {
    id: uuidv4(),
    ...data,
    status: 'pending',
    createdAt: new Date(),
  };
  tasks.push(newTask);
  return newTask;
}

export function update(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task | null {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  Object.assign(task, updates);
  return task;
}

export function remove(id: string): boolean {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  return true;
}

export function clear(): void {
  tasks.length = 0;
}
