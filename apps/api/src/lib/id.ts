import { randomUUID } from 'node:crypto';

export const uuid = (): string => randomUUID();
export const nowMs = (): number => Date.now();
