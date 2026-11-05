/** Website enquiries (PRD §3.6): contact form, product interest, consultation requests. */
import type { z } from 'zod';
import type { enquirySchema, projectRequestSchema } from '../../../shared/schemas/enquiries';
import { indicativeEstimate, WIZARD_FEATURES, type Estimate } from '../../../shared/wizard';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { hashIp, type Bytes } from '../../lib/crypto';
import { businessYear } from '../../lib/dates';
import { validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { numberSqlExpr, renderNumber, sequenceKey, sequenceStatements } from '../../lib/sequences';
import { guardPublicSubmission } from '../../lib/public-forms';
import { dispatch, enqueue } from '../../jobs/outbox';
import { getPricingCatalogue, getServiceCatalogue, getSettings, settingText } from '../cms';
import { storeUpload } from '../files';
import { notifyStaffWithPermission } from '../notifications';

type Input = z.output<typeof enquirySchema>;
type ProjectInput = z.output<typeof projectRequestSchema>;

export interface EnquiryResult {
  reference: string;
}

const KIND_LABEL = {
  contact: 'New enquiry',
  wizard: 'Project request',
  product_interest: 'Product interest',
  consultation: 'Consultation request',
} as const;

interface EnquiryRecord {
  id: string;
  kind: 'contact' | 'product_interest' | 'consultation' | 'wizard';
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  category: string;
  serviceId: string | null;
  packageId: string | null;
  productId: string | null;
  budgetRange: string | null;
  message: string;
  brief: string | null;
  attachmentFileId: string | null;
}

async function enquiryNumbering(ctx: RequestContext) {
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.enquiry') ?? 'ENQ-{YYYY}-{SEQ:4}';
  return { settings, format, year: businessYear(ctx.now()) };
}

/**
 * Inserts the enquiry, staff notification, audit row and both emails in one atomic batch (plus `extra` statements,
 * e.g. the attachment's files row). Returns the reference shown to the sender.
 */
async function persistEnquiry(
  ctx: RequestContext,
  r: EnquiryRecord,
  extra: D1PreparedStatement[] = [],
): Promise<EnquiryResult> {
  const { settings, format, year } = await enquiryNumbering(ctx);
  const now = ctx.now();
  const key = sequenceKey('enquiry', format, year);
  const ref = numberSqlExpr(key, format, year);
  const ipHash = await hashIp(ctx.ip, ctx.config.hmacSecret);
  const adminTo = settingText(settings, 'contact.email') ?? (ctx.config.adminAlertEmail || undefined);
  const jobs = [
    enqueue(ctx, {
      type: 'email.send',
      payload: {
        template: 'enquiry_acknowledgement',
        to: r.email,
        data: { name: r.name, enquiryId: r.id, kind: r.kind },
      },
      idempotencyKey: `email:enquiry_ack:${r.id}`,
    }),
    ...(adminTo
      ? [
          enqueue(ctx, {
            type: 'email.send',
            payload: {
              template: 'enquiry_admin',
              to: adminTo,
              replyTo: r.email,
              data: {
                enquiryId: r.id,
                name: r.name,
                email: r.email,
                category: r.category,
                message: r.message.slice(0, 2000),
                kind: r.kind,
              },
            },
            idempotencyKey: `email:enquiry_admin:${r.id}`,
          }),
        ]
      : []),
  ];

  await new Batch(ctx.db)
    .addAll(sequenceStatements(ctx.db, key))
    .addAll(extra)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO enquiries (id, reference, kind, name, email, phone, organisation, category, service_id, package_id, product_id,
           budget_range, message, brief, attachment_file_id, consent_at, ip_hash, user_agent, status, created_at, updated_at)
         VALUES (?, ${ref.sql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
        r.id,
        ...ref.params,
        r.kind,
        r.name,
        r.email,
        r.phone,
        r.organisation,
        r.category,
        r.serviceId,
        r.packageId,
        r.productId,
        r.budgetRange,
        r.message,
        r.brief,
        r.attachmentFileId,
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
        title: `${KIND_LABEL[r.kind]} from ${r.name}`,
        body: r.message.slice(0, 160),
        link: `/admin/enquiries/${r.id}`,
        entityType: 'enquiry',
        entityId: r.id,
        dedupeKey: `enquiry:${r.id}`,
      }),
    )
    .add(
      auditStmt(ctx, {
        action: 'enquiry.received',
        entityType: 'enquiry',
        entityId: r.id,
        after: { kind: r.kind, category: r.category },
      }),
    )
    .addAll(jobs.map((j) => j.stmt))
    .run();
  dispatch(
    ctx,
    jobs.map((j) => j.id),
  );

  const row = await ctx.db
    .prepare('SELECT reference FROM enquiries WHERE id = ?')
    .bind(r.id)
    .first<{ reference: string }>();
  return { reference: row!.reference };
}

async function honeypotReference(ctx: RequestContext): Promise<EnquiryResult> {
  const { format, year } = await enquiryNumbering(ctx);
  return { reference: renderNumber(format, year, 0) };
}

/** Validated public submission → enquiry + notifications + emails, atomically. Returns the reference shown to the sender. */
export async function submitEnquiry(ctx: RequestContext, input: Input): Promise<EnquiryResult> {
  if (!(await guardPublicSubmission(ctx, { honeypot: input.website, token: input.turnstileToken, bucket: 'enquiry' })))
    return honeypotReference(ctx);

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
  const kind = input.kind;
  return persistEnquiry(ctx, {
    id: newId('enq', ctx.now().getTime()),
    kind,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    organisation: input.organisation ?? null,
    category:
      kind === 'product_interest' ? 'product_interest' : kind === 'consultation' ? 'consultation' : input.category,
    serviceId: service?.id ?? null,
    packageId: null,
    productId,
    budgetRange: input.budgetRange ?? null,
    message: input.message,
    brief: input.preferredTimes?.length ? JSON.stringify({ preferredTimes: input.preferredTimes }) : null,
    attachmentFileId: null,
  });
}

export interface ProjectBrief {
  version: 1;
  division: { slug: string; name: string };
  service: { slug: string; name: string } | null;
  package: { slug: string; name: string } | null;
  addons: { id: string; name: string }[];
  features: { value: string; label: string }[];
  budgetRange: string;
  timeline: string;
  websiteUrl: string | null;
  estimate: Estimate | null;
  attachment: { fileId: string; name: string; size: number } | null;
}

/** Start-a-Project wizard (docs/12 §C.2): validated brief → enquiry (kind `wizard`) with structured JSON + attachment. */
export async function submitProjectRequest(
  ctx: RequestContext,
  input: ProjectInput,
  attachment?: { bytes: Bytes; filename: string },
): Promise<EnquiryResult> {
  if (!(await guardPublicSubmission(ctx, { honeypot: input.website, token: input.turnstileToken, bucket: 'enquiry' })))
    return honeypotReference(ctx);

  const division = (await getServiceCatalogue(ctx)).find((c) => c.slug === input.category);
  if (!division || division.status !== 'active') throw validationError({ category: ['Choose what you need.'] });
  const service = input.service ? division.services.find((s) => s.slug === input.service) : undefined;
  if (input.service && (!service || service.status !== 'active'))
    throw validationError({ service: ['Choose a service from the list.'] });

  const pricing = await getPricingCatalogue(ctx);
  const pkg = input.package
    ? pricing.packages.find(
        (p) => p.slug === input.package && p.status === 'active' && p.categorySlug === division.slug,
      )
    : undefined;
  if (input.package && !pkg) throw validationError({ package: ['Choose a package from the list.'] });
  const addonIds = [...new Set(input.addons)];
  const addons = addonIds.map((id) => pricing.addons.find((a) => a.id === id));
  if (addons.some((a) => !a)) throw validationError({ addons: ['Choose add-ons from the list.'] });
  const chosenAddons = addons.filter((a): a is NonNullable<typeof a> => Boolean(a));

  const id = newId('enq', ctx.now().getTime());
  let stored: Awaited<ReturnType<typeof storeUpload>> | null = null;
  if (attachment) {
    stored = await storeUpload(ctx, {
      bytes: attachment.bytes,
      filename: attachment.filename,
      purpose: 'document',
      ownerType: 'enquiry',
      ownerId: id,
    });
  }

  const brief: ProjectBrief = {
    version: 1,
    division: { slug: division.slug, name: division.name },
    service: service ? { slug: service.slug, name: service.name } : null,
    package: pkg ? { slug: pkg.slug, name: pkg.name } : null,
    addons: chosenAddons.map((a) => ({ id: a.id, name: a.name })),
    features: [...new Set(input.features)].map((v) => ({
      value: v,
      label: WIZARD_FEATURES.find((f) => f.value === v)!.label,
    })),
    budgetRange: input.budgetRange,
    timeline: input.timeline,
    websiteUrl: input.websiteUrl ?? null,
    estimate: pricing.showPrices ? indicativeEstimate(pkg ?? null, chosenAddons) : null,
    attachment: stored ? { fileId: stored.id, name: stored.name, size: stored.size } : null,
  };

  return persistEnquiry(
    ctx,
    {
      id,
      kind: 'wizard',
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      organisation: input.organisation ?? null,
      category: division.slug,
      serviceId: service?.id ?? null,
      packageId: pkg?.id ?? null,
      productId: null,
      budgetRange: input.budgetRange,
      message: input.description,
      brief: JSON.stringify(brief),
      attachmentFileId: stored?.id ?? null,
    },
    stored ? [stored.stmt] : [],
  );
}
