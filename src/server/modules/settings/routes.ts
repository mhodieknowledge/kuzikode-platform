import { Hono } from 'hono';
import { z } from 'zod';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import * as settings from './service';

const numberingSchema = z
  .object({ format: z.string().trim().min(2).max(40), nextValue: z.coerce.number().int().min(1).max(999_999_999) })
  .strict();
const currencySchema = z.object({ active: z.boolean(), isDefault: z.boolean() }).strict();
const taxCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a name.').max(60),
    rateBp: z.coerce.number().int().min(0).max(10_000),
    inclusive: z.boolean().default(false),
  })
  .strict();
const taxUpdateSchema = z
  .object({ name: z.string().trim().min(2).max(60), active: z.boolean(), isDefault: z.boolean() })
  .strict();
const paymentAccountSchema = z
  .object({ label: z.string().trim().min(2).max(60), enabled: z.boolean(), mode: z.enum(['test', 'live']) })
  .strict();
const prefsSchema = z
  .object({
    prefs: z.array(z.object({ type: z.string().max(60), inApp: z.boolean(), email: z.boolean() }).strict()).max(50),
  })
  .strict();

/** Settings APIs (P4.3). The service re-checks permissions. */
export function settingsRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.put('/sections/:id', requirePermission('settings.manage'), async (c) =>
    c.json({
      data: {
        changed: await settings.updateSection(c.var.ctx, c.req.param('id'), await jsonBody(c, z.unknown())),
      },
    }),
  );
  r.put('/numbering/:kind', requirePermission('numbering.manage'), async (c) => {
    await settings.updateNumbering(c.var.ctx, c.req.param('kind'), await jsonBody(c, numberingSchema));
    return c.json({ data: { ok: true } });
  });
  r.put('/currencies/:code', requirePermission('settings.manage'), async (c) => {
    await settings.updateCurrency(c.var.ctx, c.req.param('code'), await jsonBody(c, currencySchema));
    return c.json({ data: { ok: true } });
  });
  r.post('/tax-rates', requirePermission('settings.manage'), async (c) =>
    c.json({ data: await settings.createTaxRate(c.var.ctx, await jsonBody(c, taxCreateSchema)) }, 201),
  );
  r.put('/tax-rates/:id', requirePermission('settings.manage'), async (c) => {
    await settings.updateTaxRate(c.var.ctx, c.req.param('id'), await jsonBody(c, taxUpdateSchema));
    return c.json({ data: { ok: true } });
  });
  r.put('/payment-accounts/:id', requirePermission('payment_settings.manage'), async (c) => {
    await settings.updatePaymentAccount(c.var.ctx, c.req.param('id'), await jsonBody(c, paymentAccountSchema));
    return c.json({ data: { ok: true } });
  });
  r.put('/logo', requirePermission('settings.manage'), async (c) => {
    const { fileId } = await jsonBody(
      c,
      z
        .object({
          fileId: z
            .string()
            .regex(/^fil_[A-Za-z0-9]+$/)
            .nullable(),
        })
        .strict(),
    );
    await settings.setLogo(c.var.ctx, fileId);
    return c.json({ data: { ok: true } });
  });
  r.post('/email/test', requirePermission('settings.manage'), async (c) =>
    c.json({ data: await settings.sendTestEmail(c.var.ctx) }),
  );
  // Personal preferences: every staff member manages their own.
  r.get('/notification-preferences', async (c) => c.json({ data: await settings.notificationPreferences(c.var.ctx) }));
  r.put('/notification-preferences', async (c) => {
    await settings.setNotificationPreferences(c.var.ctx, (await jsonBody(c, prefsSchema)).prefs);
    return c.json({ data: { ok: true } });
  });
  return r;
}
