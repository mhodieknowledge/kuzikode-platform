import type { JobHandlers } from '../types';

/** Registry of outbox job types → handlers. Modules add their handlers here as they are built. */
export const defaultHandlers: JobHandlers = {};
