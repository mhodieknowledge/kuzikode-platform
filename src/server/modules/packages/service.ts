/**
 * Admin → Packages & pricing (P4.19, docs/12 §A, §D). Packages belong to a service and carry ordered feature rows;
 * add-ons are global or per package. Every write bumps the content version (public /pricing and division pages update
 * at once) and is audited. Price changes made by someone without `packages.price_review` raise the price-review flag,
 * which shows as a dashboard warning until a reviewer approves. "Add package" in the quotation editor copies prices
 * into ordinary quotation lines at that moment, so later catalogue changes never touch a quotation.
 */
import type { RequestContext } from '../../context';
import { Batch, isUniqueViolation, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan, can } from '../../lib/policies';
import type { AddonInput, PackageInput, PackageLinesInput } from '../../../shared/schemas/packages';
import type { QuotationLineInput } from '../../../shared/schemas/quotations';
import { bumpContentVersionStmt, getSettings, resetCmsCache, settingBool } from '../cms';

export type PackageTab = PackageInput['tab'];

export interface AdminPackageFeature {
  label: string;
  value: 'included' | 'not_included' | 'text';
  text: string | null;
  tooltip: string | null;
  key: string | null;
}

export interface AdminPackage {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryName: string;
  slug: string;
  name: string;
  tagline: string | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  priceUnit: string | null;
  altPriceZwgMinor: number | null;
  annualPriceMinor: number | null;
  minQuantity: number;
  deliveryTime: string | null;
  revisionRounds: string | null;
  supportPeriod: string | null;
  mostPopular: boolean;
  tab: PackageTab;
  status: 'active' | 'coming_soon' | 'inactive';
  priceReviewRequired: boolean;
  costNote: string | null;
  sortOrder: number;
  features: AdminPackageFeature[];
  updatedAt: string;
}

export interface AdminAddon {
  id: string;
  packageId: string | null;
  packageName: string | null;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  unit: AddonInput['unit'];
  billingType: 'one_off' | 'recurring';
  active: boolean;
  sortOrder: number;
}

interface PackageRow {
  id: string;
  service_id: string;
  service_name: string;
  category_name: string;
  slug: string;
  name: string;
  tagline: string | null;
  billing_type: AdminPackage['billingType'];
  interval: AdminPackage['interval'];
  price_type: AdminPackage['priceType'];
  price_minor: number | null;
  currency: string | null;
  price_unit: string | null;
  alt_price_zwg_minor: number | null;
  annual_price_minor: number | null;
  min_quantity: number;
  delivery_time: string | null;
  revision_rounds: string | null;
  support_period: string | null;
  most_popular: number;
  pricing_tab: PackageTab;
  status: AdminPackage['status'];
  price_review_required: number;
  cost_note: string | null;
  sort_order: number;
  updated_at: string;
}
interface FeatureRow {
  package_id: string;
  label: string;
  value_type: AdminPackageFeature['value'];
  value_text: string | null;
  tooltip: string | null;
  comparison_key: string | null;
}
interface AddonRow {
  id: string;
  package_id: string | null;
  package_name: string | null;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  unit: AdminAddon['unit'];
  billing_type: AdminAddon['billingType'];
  active: number;
  sort_order: number;
}

const PACKAGE_SELECT = `SELECT p.*, s.name AS service_name, c.name AS category_name
  FROM service_packages p JOIN services s ON s.id = p.service_id JOIN service_categories c ON c.id = s.category_id`;
const ADDON_SELECT = `SELECT a.*, p.name AS package_name FROM package_addons a LEFT JOIN service_packages p ON p.id = a.package_id`;

const toFeature = (f: FeatureRow): AdminPackageFeature => ({
  label: f.label,
  value: f.value_type,
  text: f.value_text,
  tooltip: f.tooltip,
  key: f.comparison_key,
});

const toPackage = (r: PackageRow, features: FeatureRow[]): AdminPackage => ({
  id: r.id,
  serviceId: r.service_id,
  serviceName: r.service_name,
  categoryName: r.category_name,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  billingType: r.billing_type,
  interval: r.interval,
  priceType: r.price_type,
  priceMinor: r.price_minor,
  currency: r.currency,
  priceUnit: r.price_unit,
  altPriceZwgMinor: r.alt_price_zwg_minor,
  annualPriceMinor: r.annual_price_minor,
  minQuantity: r.min_quantity,
  deliveryTime: r.delivery_time,
  revisionRounds: r.revision_rounds,
  supportPeriod: r.support_period,
  mostPopular: r.most_popular === 1,
  tab: r.pricing_tab,
  status: r.status,
  priceReviewRequired: r.price_review_required === 1,
  costNote: r.cost_note,
  sortOrder: r.sort_order,
  features: features.filter((f) => f.package_id === r.id).map(toFeature),
  updatedAt: r.updated_at,
});

const toAddon = (r: AddonRow): AdminAddon => ({
  id: r.id,
  packageId: r.package_id,
  packageName: r.package_name,
  name: r.name,
  description: r.description,
  priceMinor: r.price_minor,
  currency: r.currency,
  unit: r.unit,
  billingType: r.billing_type,
  active: r.active === 1,
  sortOrder: r.sort_order,
});

async function runWrite(batch: Batch) {
  try {
    const res = await batch.run();
    resetCmsCache();
    return res;
  } catch (err) {
    if (isUniqueViolation(err))
      throw validationError({ slug: ['Another package of this service already uses that web address.'] });
    throw err;
  }
}

// ---------------------------------------------------------------- reads

export interface PackagesOverview {
  packages: AdminPackage[];
  addons: AdminAddon[];
  reviewCount: number;
  showPrices: boolean;
}

/** Every package (all statuses) in pricing-tab and display order, every add-on, and the price-display switch. */
export async function listPackagesAdmin(ctx: RequestContext): Promise<PackagesOverview> {
  assertCan(ctx, 'packages.manage');
  const [pk, ft, ad] = await ctx.db.batch([
    ctx.db.prepare(`${PACKAGE_SELECT} ORDER BY p.pricing_tab, p.sort_order, p.name`),
    ctx.db.prepare('SELECT * FROM package_features ORDER BY package_id, position'),
    ctx.db.prepare(`${ADDON_SELECT} ORDER BY a.package_id IS NOT NULL, p.name, a.sort_order, a.name`),
  ]);
  const features = (ft?.results ?? []) as FeatureRow[];
  const packages = ((pk?.results ?? []) as PackageRow[]).map((r) => toPackage(r, features));
  const settings = await getSettings(ctx);
  return {
    packages,
    addons: ((ad?.results ?? []) as AddonRow[]).map(toAddon),
    reviewCount: packages.filter((p) => p.priceReviewRequired && p.status === 'active').length,
    showPrices: settingBool(settings, 'pricing.show_prices'),
  };
}

export async function getPackageAdmin(ctx: RequestContext, id: string): Promise<AdminPackage> {
  assertCan(ctx, 'packages.manage');
  return loadPackage(ctx, id);
}

async function loadPackage(ctx: RequestContext, id: string): Promise<AdminPackage> {
  const [pk, ft] = await ctx.db.batch([
    ctx.db.prepare(`${PACKAGE_SELECT} WHERE p.id = ?`).bind(id),
    ctx.db.prepare('SELECT * FROM package_features WHERE package_id = ? ORDER BY position').bind(id),
  ]);
  const row = ((pk?.results ?? []) as PackageRow[])[0];
  if (!row) throw notFound();
  return toPackage(row, (ft?.results ?? []) as FeatureRow[]);
}

/** Active add-ons that can go with a package: its own plus the global ones. */
export async function addonsFor(ctx: RequestContext, packageId: string): Promise<AdminAddon[]> {
  const { results } = await ctx.db
    .prepare(
      `${ADDON_SELECT} WHERE a.active = 1 AND (a.package_id IS NULL OR a.package_id = ?) ORDER BY a.sort_order, a.name`,
    )
    .bind(packageId)
    .all<AddonRow>();
  return results.map(toAddon);
}

/** Active packages with a price, for the quotation editor's "Add package" picker. */
export async function packagePicker(ctx: RequestContext) {
  assertCan(ctx, 'quotations.create');
  const [pk, ad] = await ctx.db.batch([
    ctx.db.prepare(
      `${PACKAGE_SELECT} WHERE p.status = 'active' AND p.price_type <> 'custom_quote' ORDER BY c.sort_order, s.sort_order, p.sort_order`,
    ),
    ctx.db.prepare(`${ADDON_SELECT} WHERE a.active = 1 ORDER BY a.sort_order, a.name`),
  ]);
  const addons = ((ad?.results ?? []) as AddonRow[]).map(toAddon);
  return ((pk?.results ?? []) as PackageRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    serviceName: r.service_name,
    priceMinor: r.price_minor!,
    currency: r.currency!,
    altPriceZwgMinor: r.alt_price_zwg_minor,
    billingType: r.billing_type,
    interval: r.interval,
    minQuantity: r.min_quantity,
    addons: addons
      .filter((a) => a.packageId === null || a.packageId === r.id)
      .map((a) => ({ id: a.id, name: a.name, priceMinor: a.priceMinor, currency: a.currency, unit: a.unit })),
  }));
}

/** Packages awaiting price approval (active ones), for the dashboard warning. */
export async function priceReviewCount(ctx: RequestContext): Promise<number> {
  const r = await ctx.db
    .prepare("SELECT COUNT(*) AS n FROM service_packages WHERE status = 'active' AND price_review_required = 1")
    .first<{ n: number }>();
  return r?.n ?? 0;
}

// ---------------------------------------------------------------- writes

async function checkService(ctx: RequestContext, serviceId: string) {
  const s = await ctx.db.prepare('SELECT id FROM services WHERE id = ?').bind(serviceId).first();
  if (!s) throw validationError({ serviceId: ['Choose a service.'] });
}

async function checkCurrency(ctx: RequestContext, code: string | null, field = 'currency') {
  if (!code) return;
  const c = await ctx.db.prepare('SELECT code FROM currencies WHERE code = ?').bind(code).first();
  if (!c) throw validationError({ [field]: ['Choose a currency.'] });
}

function featureStmts(ctx: RequestContext, packageId: string, input: PackageInput): D1PreparedStatement[] {
  return [
    stmt(ctx.db, 'DELETE FROM package_features WHERE package_id = ?', packageId),
    ...input.features.map((f, i) =>
      stmt(
        ctx.db,
        `INSERT INTO package_features (id, package_id, position, label, value_type, value_text, tooltip, comparison_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        newId('pft', ctx.now().getTime()),
        packageId,
        (i + 1) * 10,
        f.label,
        f.value,
        f.value === 'text' ? f.text : null,
        f.tooltip,
        f.key,
      ),
    ),
  ];
}

/** "Most popular" is one package per pricing tab: setting it clears the others in the same tab. */
function popularStmt(ctx: RequestContext, id: string, input: PackageInput): D1PreparedStatement[] {
  return input.mostPopular
    ? [
        stmt(
          ctx.db,
          'UPDATE service_packages SET most_popular = 0 WHERE pricing_tab = ? AND id <> ? AND most_popular = 1',
          input.tab,
          id,
        ),
      ]
    : [];
}

const packageValues = (input: PackageInput) => [
  input.serviceId,
  input.slug,
  input.name,
  input.tagline,
  input.billingType,
  input.interval,
  input.priceType,
  input.priceMinor,
  input.currency,
  input.priceUnit,
  input.altPriceZwgMinor,
  input.annualPriceMinor,
  input.minQuantity,
  input.deliveryTime,
  input.revisionRounds,
  input.supportPeriod,
  input.mostPopular ? 1 : 0,
  input.tab,
  input.status,
  input.costNote,
];

const priceOf = (
  p: Pick<AdminPackage, 'priceType' | 'priceMinor' | 'currency' | 'altPriceZwgMinor' | 'annualPriceMinor'>,
) => ({
  priceType: p.priceType,
  priceMinor: p.priceMinor,
  currency: p.currency,
  altPriceZwgMinor: p.altPriceZwgMinor,
  annualPriceMinor: p.annualPriceMinor,
});

export async function createPackage(ctx: RequestContext, input: PackageInput): Promise<{ id: string }> {
  assertCan(ctx, 'packages.manage');
  await checkService(ctx, input.serviceId);
  await checkCurrency(ctx, input.currency);
  const id = newId('pkg', ctx.now().getTime());
  const now = ctx.now().toISOString();
  // A reviewer creating a package approves its price; anyone else's new price waits for review.
  const review = can(ctx, 'packages.price_review') ? 0 : 1;
  await runWrite(
    new Batch(ctx.db)
      .addAll(popularStmt(ctx, id, input))
      .add(
        stmt(
          ctx.db,
          `INSERT INTO service_packages (id, service_id, slug, name, tagline, billing_type, interval, price_type, price_minor, currency,
             price_unit, alt_price_zwg_minor, annual_price_minor, min_quantity, delivery_time, revision_rounds, support_period,
             most_popular, pricing_tab, status, cost_note, price_review_required, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM service_packages WHERE pricing_tab = ?), ?, ?)`,
          id,
          ...packageValues(input),
          review,
          input.tab,
          now,
          now,
        ),
      )
      .addAll(featureStmts(ctx, id, input))
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'package.created',
          entityType: 'package',
          entityId: id,
          after: {
            name: input.name,
            slug: input.slug,
            ...priceOf(input),
            status: input.status,
            priceReviewRequired: !!review,
          },
        }),
      ),
  );
  return { id };
}

export async function updatePackage(ctx: RequestContext, id: string, input: PackageInput): Promise<void> {
  assertCan(ctx, 'packages.manage');
  const before = await loadPackage(ctx, id);
  await checkService(ctx, input.serviceId);
  await checkCurrency(ctx, input.currency);
  const priceChanged = JSON.stringify(priceOf(before)) !== JSON.stringify(priceOf(input));
  // Price edits by someone who can't approve prices put the package back under review.
  const review = priceChanged && !can(ctx, 'packages.price_review') ? 1 : before.priceReviewRequired ? 1 : 0;
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .addAll(popularStmt(ctx, id, input))
      .add(
        stmt(
          ctx.db,
          `UPDATE service_packages SET service_id = ?, slug = ?, name = ?, tagline = ?, billing_type = ?, interval = ?, price_type = ?,
             price_minor = ?, currency = ?, price_unit = ?, alt_price_zwg_minor = ?, annual_price_minor = ?, min_quantity = ?,
             delivery_time = ?, revision_rounds = ?, support_period = ?, most_popular = ?, pricing_tab = ?, status = ?, cost_note = ?,
             price_review_required = ?,
             sort_order = CASE WHEN pricing_tab = ? THEN sort_order
               ELSE (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM service_packages WHERE pricing_tab = ?) END,
             updated_at = ?
           WHERE id = ?`,
          ...packageValues(input),
          review,
          input.tab,
          input.tab,
          now,
          id,
        ),
      )
      .addAll(featureStmts(ctx, id, input))
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: priceChanged ? 'package.price_changed' : 'package.updated',
          entityType: 'package',
          entityId: id,
          before: { name: before.name, status: before.status, ...priceOf(before) },
          after: { name: input.name, status: input.status, ...priceOf(input), priceReviewRequired: !!review },
        }),
      ),
  );
}

/** Packages referenced by enquiries, quotations, invoices or subscriptions can't be deleted: hide them instead. */
export async function packageInUse(ctx: RequestContext, id: string): Promise<boolean> {
  const r = await ctx.db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM enquiries WHERE package_id = ?) + (SELECT COUNT(*) FROM quotation_items WHERE package_id = ?)
        + (SELECT COUNT(*) FROM invoice_items WHERE package_id = ?) + (SELECT COUNT(*) FROM subscriptions WHERE package_id = ?) AS n`,
    )
    .bind(id, id, id, id)
    .first<{ n: number }>();
  return (r?.n ?? 0) > 0;
}

export async function deletePackage(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'packages.manage');
  const before = await loadPackage(ctx, id);
  if (await packageInUse(ctx, id))
    throw conflict('This package is used by enquiries, quotations, invoices or subscriptions. Hide it instead.');
  await runWrite(
    new Batch(ctx.db)
      .sql('DELETE FROM package_features WHERE package_id = ?', id)
      .sql('DELETE FROM package_addons WHERE package_id = ?', id)
      .sql('DELETE FROM service_packages WHERE id = ?', id)
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'package.deleted',
          entityType: 'package',
          entityId: id,
          before: { name: before.name, slug: before.slug, ...priceOf(before) },
        }),
      ),
  );
}

/** Approves the current prices of the given packages (or all flagged ones when `ids` is empty). */
export async function approvePrices(ctx: RequestContext, ids: string[]): Promise<number> {
  assertCan(ctx, 'packages.price_review');
  const { results } = await (
    ids.length
      ? ctx.db
          .prepare(
            'SELECT id, name, price_minor, currency FROM service_packages WHERE price_review_required = 1 AND id IN (SELECT value FROM json_each(?))',
          )
          .bind(JSON.stringify(ids))
      : ctx.db.prepare('SELECT id, name, price_minor, currency FROM service_packages WHERE price_review_required = 1')
  ).all<{ id: string; name: string; price_minor: number | null; currency: string | null }>();
  if (results.length === 0) return 0;
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .addAll(
        results.map((p) =>
          stmt(
            ctx.db,
            'UPDATE service_packages SET price_review_required = 0, updated_at = ? WHERE id = ? AND price_review_required = 1',
            now,
            p.id,
          ),
        ),
      )
      .addAll(
        results.map((p) =>
          auditStmt(ctx, {
            action: 'package.price_approved',
            entityType: 'package',
            entityId: p.id,
            after: { name: p.name, priceMinor: p.price_minor, currency: p.currency },
          }),
        ),
      )
      .add(bumpContentVersionStmt(ctx.db)),
  );
  return results.length;
}

/** Saves the comparison order of one pricing tab. `ids` must be exactly that tab's packages. */
export async function reorderPackages(ctx: RequestContext, tab: PackageTab, ids: string[]): Promise<void> {
  assertCan(ctx, 'packages.manage');
  const { results } = await ctx.db
    .prepare('SELECT id FROM service_packages WHERE pricing_tab = ?')
    .bind(tab)
    .all<{ id: string }>();
  const existing = new Set(results.map((r) => r.id));
  if (ids.length !== existing.size || new Set(ids).size !== ids.length || ids.some((i) => !existing.has(i)))
    throw conflict('The list changed while you were sorting. Reload the page and try again.');
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .addAll(
        ids.map((id, i) =>
          stmt(
            ctx.db,
            'UPDATE service_packages SET sort_order = ?, updated_at = ? WHERE id = ?',
            (i + 1) * 10,
            now,
            id,
          ),
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, { action: 'package.reordered', entityType: 'package', entityId: tab, after: { order: ids } }),
      ),
  );
}

// ---------------------------------------------------------------- add-ons

async function checkAddon(ctx: RequestContext, input: AddonInput) {
  await checkCurrency(ctx, input.currency);
  if (input.packageId) {
    const p = await ctx.db.prepare('SELECT id FROM service_packages WHERE id = ?').bind(input.packageId).first();
    if (!p) throw validationError({ packageId: ['Choose a package, or make it available with every package.'] });
  }
}

const addonValues = (i: AddonInput) => [
  i.packageId,
  i.name,
  i.description,
  i.priceMinor,
  i.currency,
  i.unit,
  i.billingType,
  i.active ? 1 : 0,
];

export async function createAddon(ctx: RequestContext, input: AddonInput): Promise<{ id: string }> {
  assertCan(ctx, 'packages.manage');
  await checkAddon(ctx, input);
  const id = newId('pad', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO package_addons (id, package_id, name, description, price_minor, currency, unit, billing_type, active, sort_order,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM package_addons), ?, ?)`,
          id,
          ...addonValues(input),
          now,
          now,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'package_addon.created',
          entityType: 'package_addon',
          entityId: id,
          after: {
            name: input.name,
            priceMinor: input.priceMinor,
            currency: input.currency,
            packageId: input.packageId,
          },
        }),
      ),
  );
  return { id };
}

async function loadAddon(ctx: RequestContext, id: string): Promise<AdminAddon> {
  const r = await ctx.db.prepare(`${ADDON_SELECT} WHERE a.id = ?`).bind(id).first<AddonRow>();
  if (!r) throw notFound();
  return toAddon(r);
}

export async function updateAddon(ctx: RequestContext, id: string, input: AddonInput): Promise<void> {
  assertCan(ctx, 'packages.manage');
  const before = await loadAddon(ctx, id);
  await checkAddon(ctx, input);
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `UPDATE package_addons SET package_id = ?, name = ?, description = ?, price_minor = ?, currency = ?, unit = ?, billing_type = ?,
             active = ?, updated_at = ? WHERE id = ?`,
          ...addonValues(input),
          ctx.now().toISOString(),
          id,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'package_addon.updated',
          entityType: 'package_addon',
          entityId: id,
          before: {
            name: before.name,
            priceMinor: before.priceMinor,
            currency: before.currency,
            active: before.active,
          },
          after: { name: input.name, priceMinor: input.priceMinor, currency: input.currency, active: input.active },
        }),
      ),
  );
}

/** Quotations copy add-ons as plain lines, so an add-on can always be deleted. */
export async function deleteAddon(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'packages.manage');
  const before = await loadAddon(ctx, id);
  await runWrite(
    new Batch(ctx.db)
      .sql('DELETE FROM package_addons WHERE id = ?', id)
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'package_addon.deleted',
          entityType: 'package_addon',
          entityId: id,
          before: { name: before.name, priceMinor: before.priceMinor, currency: before.currency },
        }),
      ),
  );
}

// ---------------------------------------------------------------- quotation integration

const UNIT_LABEL: Record<AdminAddon['unit'], string> = {
  each: '',
  page: 'per page',
  mailbox: 'per mailbox',
  month: 'per month',
  year: 'per year',
  hour: 'per hour',
};

/**
 * Quotation lines for a package plus chosen add-ons, priced now. The description lists what's included, so the
 * quotation reads on its own. A ZWG quotation uses the package's manual ZWG price; add-ons must match the currency.
 */
export async function packageQuoteLines(
  ctx: RequestContext,
  packageId: string,
  input: PackageLinesInput,
): Promise<QuotationLineInput[]> {
  assertCan(ctx, 'quotations.create');
  const p = await loadPackage(ctx, packageId);
  if (p.status !== 'active') throw validationError({ packageId: ['This package is not offered at the moment.'] });
  if (p.priceType === 'custom_quote' || p.priceMinor == null)
    throw validationError({ packageId: ['Custom-quote packages have no price. Add the scope as lines instead.'] });
  const price = input.currency === p.currency ? p.priceMinor : input.currency === 'ZWG' ? p.altPriceZwgMinor : null;
  if (price == null)
    throw validationError({
      currency: [`${p.name} has no ${input.currency} price. Quote in ${p.currency ?? 'its currency'} instead.`],
    });
  const included = p.features
    .filter((f) => f.value !== 'not_included')
    .map((f) => (f.value === 'text' ? `${f.label}: ${f.text}` : f.label));
  const description = [
    `${p.name}${p.priceType === 'starting_from' ? ' (starting price)' : ''}`,
    ...(included.length ? [`Includes: ${included.join('; ')}.`] : []),
    ...(p.deliveryTime ? [`Delivery: ${p.deliveryTime}.`] : []),
  ]
    .join('\n')
    .slice(0, 2000);
  const lines: QuotationLineInput[] = [
    {
      serviceId: p.serviceId,
      packageId: p.id,
      description,
      quantity: String(Math.max(input.quantity ?? p.minQuantity, p.minQuantity)),
      unitPriceMinor: price,
      taxRateId: null,
      isRecurring: p.billingType === 'recurring',
      recurringInterval: p.billingType === 'recurring' ? p.interval : null,
      discountType: 'none',
      discountValue: 0,
    },
  ];
  if (input.addons.length) {
    const available = new Map((await addonsFor(ctx, p.id)).map((a) => [a.id, a]));
    for (const sel of input.addons) {
      const a = available.get(sel.id);
      if (!a) throw validationError({ addons: ['One of the add-ons is no longer offered with this package.'] });
      if (a.currency !== input.currency)
        throw validationError({ addons: [`${a.name} is priced in ${a.currency} only.`] });
      const recurring = a.billingType === 'recurring';
      const interval = a.unit === 'month' ? 'month' : 'year';
      lines.push({
        serviceId: p.serviceId,
        packageId: p.id,
        description:
          `${a.name}${UNIT_LABEL[a.unit] ? ` (${UNIT_LABEL[a.unit]})` : ''}${a.description ? `\n${a.description}` : ''}`.slice(
            0,
            2000,
          ),
        quantity: String(sel.quantity),
        unitPriceMinor: a.priceMinor,
        taxRateId: null,
        isRecurring: recurring,
        recurringInterval: recurring ? interval : null,
        discountType: 'none',
        discountValue: 0,
      });
    }
  }
  return lines;
}

/** Services (with their division) and active currencies for the package editor. */
export async function packageFormOptions(ctx: RequestContext) {
  assertCan(ctx, 'packages.manage');
  const [sv, cu] = await ctx.db.batch([
    ctx.db.prepare(
      `SELECT s.id, s.name, c.name AS division FROM services s JOIN service_categories c ON c.id = s.category_id
       ORDER BY c.sort_order, s.sort_order`,
    ),
    ctx.db.prepare('SELECT code FROM currencies WHERE active = 1 ORDER BY is_default DESC, code'),
  ]);
  return {
    services: (sv?.results ?? []) as { id: string; name: string; division: string }[],
    currencies: ((cu?.results ?? []) as { code: string }[]).map((c) => c.code),
  };
}
