import * as fs from 'fs';
import type { IReader } from '../types';

export const JsonReader: IReader = {
  extensions: ['.json'],

  read(filePath: string): unknown {
    const raw = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`[JsonReader] Failed to parse "${filePath}": ${(e as Error).message}`);
    }
  },
};
