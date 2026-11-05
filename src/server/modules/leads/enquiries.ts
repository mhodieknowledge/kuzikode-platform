/** Website enquiries (PRD §3.6): contact form, product interest, consultation requests. */
import type { z } from 'zod';
import type { enquirySchema } from '../../../shared/schemas/enquiries';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { hashIp } from '../../lib/crypto';
import { businessYear } from '../../lib/dates';
import { validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { enforce } from '../../lib/rate-limit';
import { numberSqlExpr, renderNumber, sequenceKey, sequenceStatements } from '../../lib/sequences';
import { verifyTurnstile } from '../../lib/turnstile';
import { dispatch, enqueue } from '../../jobs/outbox';
import { getServiceCatalogue, getSettings, settingText } from '../cms';
import { notifyStaffWithPermission } from '../notifications';

type Input = z.output<typeof enquirySchema>;

export interface EnquiryResult {
  reference: string;
}

const KIND_LABEL = {
  contact: 'New enquiry',
  product_interest: 'Product interest',
  consultation: 'Consultation request',
} as const;

/** Validated public submission → enquiry + notifications + emails, atomically. Returns the reference shown to the sender. */
export async function submitEnquiry(ctx: RequestContext, input: Input): Promise<EnquiryResult> {
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.enquiry') ?? 'ENQ-{YYYY}-{SEQ:4}';
  const year = businessYear(ctx.now());

  if (input.website && input.website.trim() !== '') {
    // Honeypot filled: answer like a success so bots learn nothing, store nothing.
    ctx.logger.info('enquiry honeypot triggered');
    return { reference: renderNumber(format, year, 0) };
  }
  await enforce(ctx, { key: `enquiry:ip:${ctx.ip}`, limit: 5, windowSeconds: 3600 });
  if (!(await verifyTurnstile(ctx, input.turnstileToken))) {
    throw validationError({ turnstile: ['Complete the security check and send again.'] });
  }

  const catalogue = await getServiceCatalogue(ctx);
  const division = catalogue.find((c) => c.slug === input.category);
  const service = input.service
    ? (division ?? catalogue.find((c) => c.services.some((s) => s.slug === input.service)))?.services.find(
        (s) => s.slug === input.service,
      )
    : undefined;
  let productId: string | null = null;
  if (input.kind === 'product_interest' || input.product) {
    const product = await ctx.db
      .prepare('SELECT id, name FROM products WHERE slug = ? AND published = 1 AND interest_form_enabled = 1')
      .bind(input.product ?? '')
      .first<{ id: string; name: string }>();
    if (!product) throw validationError({ product: ['This product is not taking interest registrations.'] });
    productId = product.id;
  }

  const now = ctx.now();
  const id = newId('enq', now.getTime());
  const key = sequenceKey('enquiry', format, year);
  const ref = numberSqlExpr(key, format, year);
  const ipHash = await hashIp(ctx.ip, ctx.config.hmacSecret);
  const brief = input.preferredTimes?.length ? JSON.stringify({ preferredTimes: input.preferredTimes }) : null;
  const kind = input.kind;
  const category =
    kind === 'product_interest' ? 'product_interest' : kind === 'consultation' ? 'consultation' : input.category;

  const adminTo = settingText(settings, 'contact.email') ?? (ctx.config.adminAlertEmail || undefined);
  const jobs = [
    enqueue(ctx, {
      type: 'email.send',
      payload: {
        template: 'enquiry_acknowledgement',
        to: input.email,
        data: { name: input.name, enquiryId: id, kind },
      },
      idempotencyKey: `email:enquiry_ack:${id}`,
    }),
    ...(adminTo
      ? [
          enqueue(ctx, {
            type: 'email.send',
            payload: {
              template: 'enquiry_admin',
              to: adminTo,
              replyTo: input.email,
              data: {
                enquiryId: id,
                name: input.name,
                email: input.email,
                category,
                message: input.message.slice(0, 2000),
                kind,
              },
            },
            idempotencyKey: `email:enquiry_admin:${id}`,
          }),
        ]
      : []),
  ];

  await new Batch(ctx.db)
    .addAll(sequenceStatements(ctx.db, key))
    .add(
      stmt(
        ctx.db,
        `INSERT INTO enquiries (id, reference, kind, name, email, phone, organisation, category, service_id, product_id, budget_range,
           message, brief, consent_at, ip_hash, user_agent, status, created_at, updated_at)
         VALUES (?, ${ref.sql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
        id,
        ...ref.params,
        kind,
        input.name,
        input.email,
        input.phone ?? null,
        input.organisation ?? null,
        category,
        service?.id ?? null,
        productId,
        input.budgetRange ?? null,
        input.message,
        brief,
        now.toISOString(),
        ipHash,
        ctx.userAgent,
        now.toISOString(),
        now.toISOString(),
      ),
    )
    .add(
      notifyStaffWithPermission(ctx, 'enquiries.view', {
        type: 'enquiry.new',
        title: `${KIND_LABEL[kind]} from ${input.name}`,
        body: input.message.slice(0, 160),
        link: `/admin/enquiries/${id}`,
        entityType: 'enquiry',
        entityId: id,
        dedupeKey: `enquiry:${id}`,
      }),
    )
    .add(auditStmt(ctx, { action: 'enquiry.received', entityType: 'enquiry', entityId: id, after: { kind, category } }))
    .addAll(jobs.map((j) => j.stmt))
    .run();
  dispatch(
    ctx,
    jobs.map((j) => j.id),
  );

  const row = await ctx.db
    .prepare('SELECT reference FROM enquiries WHERE id = ?')
    .bind(id)
    .first<{ reference: string }>();
  return { reference: row!.reference };
}
