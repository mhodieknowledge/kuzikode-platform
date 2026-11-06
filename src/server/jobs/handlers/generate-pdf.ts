import { z } from 'zod';
import { DOCUMENT_KINDS, ensureStoredPdf } from '../../modules/documents/service';
import type { DocumentKind } from '../../pdf';
import { AppError } from '../../lib/errors';
import { PermanentJobError, type JobHandler } from '../types';

const payload = z.object({ kind: z.enum(DOCUMENT_KINDS as [DocumentKind, ...DocumentKind[]]), id: z.string().min(1) });

/** `pdf.generate`: renders and stores an issued document's PDF once. Re-running is a no-op once it is stored. */
export const generatePdfHandler: JobHandler = async (ctx, raw) => {
  const p = payload.safeParse(raw);
  if (!p.success) throw new PermanentJobError('Invalid pdf.generate payload');
  try {
    await ensureStoredPdf(ctx, p.data.kind, p.data.id);
  } catch (err) {
    // A missing record or a document that is (again) a draft can't be fixed by retrying.
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'CONFLICT'))
      throw new PermanentJobError(`${p.data.kind} ${p.data.id}: ${err.message}`);
    throw err;
  }
};
