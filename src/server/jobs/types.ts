import type { RequestContext } from '../context';

export interface JobMeta {
  outboxId: string;
  idempotencyKey: string;
  attempt: number;
}

/** A job handler. Must be idempotent for its idempotency key: it may run again after a crash mid-way. */
export type JobHandler = (ctx: RequestContext, payload: unknown, meta: JobMeta) => Promise<void>;

export type JobHandlers = Record<string, JobHandler>;

/** Thrown by handlers for errors that retrying cannot fix (bad payload, missing template). Fails the job at once. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}
