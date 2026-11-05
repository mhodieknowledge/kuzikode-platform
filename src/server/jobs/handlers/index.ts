import type { JobHandlers } from '../types';
import { sendEmailHandler } from './send-email';

/** Registry of outbox job types → handlers. Modules add their handlers here as they are built. */
export const defaultHandlers: JobHandlers = {
  'email.send': sendEmailHandler,
};
