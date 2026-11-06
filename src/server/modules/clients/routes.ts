import { Hono } from 'hono';
import { z } from 'zod';
import {
  clientListQuery,
  clientSchema,
  contactSchema,
  noteSchema,
  portalInviteSchema,
} from '../../../shared/schemas/clients';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as clients from './service';

const createSchema = clientSchema.extend({ primaryContact: contactSchema.optional() }).strict();
const ok = { data: { ok: true } };

/** Client administration (P4.4). Services re-check permissions. */
export function clientRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('clients.view'), async (c) =>
    c.json({ data: await clients.listClients(c.var.ctx, query(c, clientListQuery)) }),
  );
  r.post('/', requirePermission('clients.create'), async (c) => {
    const { primaryContact, ...data } = await jsonBody(c, createSchema);
    return c.json({ data: await clients.createClient(c.var.ctx, data, primaryContact) }, 201);
  });
  r.get('/portal-signups', requirePermission('clients.view'), async (c) =>
    c.json({ data: await clients.listPortalSignups(c.var.ctx) }),
  );
  r.post('/portal-signups/:userId/link', requirePermission('clients.update'), async (c) => {
    const input = await jsonBody(
      c,
      z.object({ clientId: z.string().min(1).max(64), role: z.enum(['owner', 'member', 'billing']) }).strict(),
    );
    await clients.linkPortalSignup(c.var.ctx, c.req.param('userId'), input);
    return c.json(ok);
  });
  r.post('/portal-signups/:userId/decline', requirePermission('clients.update'), async (c) => {
    await clients.declinePortalSignup(c.var.ctx, c.req.param('userId'));
    return c.json(ok);
  });
  r.get('/:id', requirePermission('clients.view'), async (c) =>
    c.json({ data: await clients.getClient(c.var.ctx, c.req.param('id')) }),
  );
  r.put('/:id', requirePermission('clients.update'), async (c) => {
    await clients.updateClient(c.var.ctx, c.req.param('id'), await jsonBody(c, clientSchema));
    return c.json(ok);
  });
  r.post('/:id/archive', requirePermission('clients.archive'), async (c) => {
    await clients.setArchived(c.var.ctx, c.req.param('id'), true);
    return c.json(ok);
  });
  r.post('/:id/restore', requirePermission('clients.archive'), async (c) => {
    await clients.setArchived(c.var.ctx, c.req.param('id'), false);
    return c.json(ok);
  });
  r.delete('/:id', requirePermission('clients.archive'), async (c) => {
    await clients.deleteClient(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.post('/:id/contacts', requirePermission('clients.update'), async (c) =>
    c.json({ data: await clients.addContact(c.var.ctx, c.req.param('id'), await jsonBody(c, contactSchema)) }, 201),
  );
  r.put('/:id/contacts/:contactId', requirePermission('clients.update'), async (c) => {
    await clients.updateContact(
      c.var.ctx,
      c.req.param('id'),
      c.req.param('contactId'),
      await jsonBody(c, contactSchema),
    );
    return c.json(ok);
  });
  r.delete('/:id/contacts/:contactId', requirePermission('clients.update'), async (c) => {
    await clients.removeContact(c.var.ctx, c.req.param('id'), c.req.param('contactId'));
    return c.json(ok);
  });
  r.post('/:id/notes', requirePermission('clients.update'), async (c) =>
    c.json({ data: await clients.addNote(c.var.ctx, c.req.param('id'), (await jsonBody(c, noteSchema)).body) }, 201),
  );
  r.post('/:id/portal/invitations', requirePermission('clients.update'), async (c) =>
    c.json(
      { data: await clients.invitePortalContact(c.var.ctx, c.req.param('id'), await jsonBody(c, portalInviteSchema)) },
      201,
    ),
  );
  r.post('/:id/portal/access/:accessId', requirePermission('clients.update'), async (c) => {
    const { action } = await jsonBody(c, z.object({ action: z.enum(['approve', 'revoke']) }).strict());
    await clients.setPortalAccess(c.var.ctx, c.req.param('id'), c.req.param('accessId'), action);
    return c.json(ok);
  });
  return r;
}
