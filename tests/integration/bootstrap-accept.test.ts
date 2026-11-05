import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { buildCreateSql, newToken } from '../../scripts/bootstrap-admin';
import { statements } from '../helpers/seed';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';

describe('bootstrap invite acceptance', () => {
  it('the printed link sets the password once and grants every permission', async () => {
    await createStaff(); // seeds roles
    await env.DB.prepare("DELETE FROM user_roles WHERE role_id = 'rol_super_admin'").run();
    const { token, hash } = newToken();
    const sql = buildCreateSql({
      userId: 'usr_boot',
      email: 'boot@example.com',
      name: 'Owner',
      tokenId: 'tok_boot',
      tokenHash: hash,
      now: new Date(),
    });
    await env.DB.batch(statements(sql).map((s) => env.DB.prepare(s)));
    expect(
      (await api('/api/v1/auth/invitations/accept', { body: { token, password: 'my kuzikode passphrase' } })).status,
    ).toBe(422); // contains company name
    expect(
      (await api('/api/v1/auth/invitations/accept', { body: { token, password: 'owner chosen passphrase 1' } })).status,
    ).toBe(200);
    const s = await login('admin', 'boot@example.com', 'owner chosen passphrase 1');
    const me = await api('/api/v1/auth/admin/me', { cookie: s.cookie });
    expect(me.body.data.roles).toEqual(['super_admin']);
    expect(me.body.data.permissions).toContain('roles.manage');
    expect(
      (await api('/api/v1/auth/invitations/accept', { body: { token, password: 'reuse attempt passphrase' } })).status,
    ).toBe(422);
  });
});
