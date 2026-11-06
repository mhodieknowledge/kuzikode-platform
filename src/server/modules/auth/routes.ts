import { Hono } from 'hono';
import {
  acceptInviteSchema,
  audienceSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type Audience,
} from '../../../shared/schemas/auth';
import { notFound } from '../../lib/errors';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import * as auth from './service';
import * as mfa from '../mfa/service';
import { z } from 'zod';

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) }).strict();
const passwordCodeSchema = z
  .object({ password: z.string().min(1).max(128), code: z.string().trim().min(6).max(20) })
  .strict();

function audienceParam(value: string): Audience {
  const parsed = audienceSchema.safeParse(value);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

export function authRoutes() {
  const r = new Hono<ApiEnv>();

  // Token-based routes (no session).
  r.post('/password/reset', csrfProtect(), async (c) => {
    await auth.resetPassword(c.var.ctx, await jsonBody(c, resetPasswordSchema));
    return c.json({ data: { ok: true } });
  });
  r.post('/invitations/accept', csrfProtect(), async (c) => {
    const result = await auth.acceptInvitation(c.var.ctx, await jsonBody(c, acceptInviteSchema));
    return c.json({ data: { audience: result.audience } });
  });
  r.post('/email/verify', csrfProtect(), async (c) => {
    await auth.verifyEmail(c.var.ctx, (await jsonBody(c, verifyEmailSchema)).token);
    return c.json({ data: { ok: true } });
  });

  for (const audience of ['admin', 'portal'] as const) {
    const a = new Hono<ApiEnv>();
    a.use('*', withAuth(audience), csrfProtect());

    a.post('/login', async (c) => {
      const result = await auth.login(c.var.ctx, audienceParam(audience), await jsonBody(c, loginSchema));
      c.header('Set-Cookie', result.cookie);
      return c.json({
        data: {
          user: result.user,
          mustChangePassword: result.mustChangePassword,
          mfaRequired: result.mfaRequired,
          mfaEnrolmentRequired: result.mfaEnrolmentRequired,
        },
      });
    });

    if (audience === 'portal') {
      a.post('/register', async (c) =>
        c.json({ data: await auth.registerPortalAccount(c.var.ctx, await jsonBody(c, registerSchema)) }, 202),
      );
    }

    a.put('/profile', requireAuth(audience), async (c) => {
      await auth.updateProfile(c.var.ctx, c.var.ctx.auth!, await jsonBody(c, profileSchema));
      return c.json({ data: { ok: true } });
    });

    a.post('/password/forgot', async (c) => {
      await auth.requestPasswordReset(c.var.ctx, audience, await jsonBody(c, forgotPasswordSchema));
      return c.json({
        data: { message: 'If an account exists for that email, we have sent a link to reset the password.' },
      });
    });

    a.get('/me', requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true }), async (c) => {
      const s = c.var.ctx.auth!;
      return c.json({
        data: {
          user: s.user,
          roles: s.roles,
          permissions: [...s.permissions].sort(),
          clientIds: s.clientIds,
          mfa: { ...s.mfa, verified: s.session.mfaVerified },
          csrfToken: await auth.csrfToken(s),
        },
      });
    });

    a.post('/logout', requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true }), async (c) => {
      c.header('Set-Cookie', await auth.logout(c.var.ctx, c.var.ctx.auth!));
      return c.json({ data: { ok: true } });
    });

    a.post('/logout-all', requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true }), async (c) => {
      c.header('Set-Cookie', await auth.logoutEverywhere(c.var.ctx, c.var.ctx.auth!));
      return c.json({ data: { ok: true } });
    });

    a.post(
      '/password/change',
      requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true }),
      async (c) => {
        c.header(
          'Set-Cookie',
          await auth.changePassword(c.var.ctx, c.var.ctx.auth!, await jsonBody(c, changePasswordSchema)),
        );
        return c.json({ data: { ok: true } });
      },
    );

    a.post('/email/send-verification', requireAuth(audience), async (c) => {
      await auth.sendEmailVerification(c.var.ctx, c.var.ctx.auth!);
      return c.json({ data: { ok: true } });
    });

    a.get('/sessions', requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true }), async (c) =>
      c.json({ data: await auth.listSessions(c.var.ctx, c.var.ctx.auth!) }),
    );

    a.delete(
      '/sessions/:id',
      requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true }),
      async (c) => {
        await auth.revokeOwnSession(c.var.ctx, c.var.ctx.auth!, c.req.param('id'));
        return c.json({ data: { ok: true } });
      },
    );

    const pending = requireAuth(audience, { allowPasswordChange: true, allowMfaPending: true });
    a.get('/mfa', pending, async (c) => c.json({ data: await mfa.mfaStatus(c.var.ctx, c.var.ctx.auth!.user.id) }));
    a.post('/mfa/enrol', pending, async (c) => c.json({ data: await mfa.startEnrolment(c.var.ctx) }));
    a.post('/mfa/enrol/confirm', pending, async (c) =>
      c.json({ data: await mfa.confirmEnrolment(c.var.ctx, (await jsonBody(c, codeSchema)).code) }),
    );
    a.post('/mfa/verify', pending, async (c) =>
      c.json({ data: await mfa.verifySession(c.var.ctx, (await jsonBody(c, codeSchema)).code) }),
    );
    a.post('/mfa/disable', requireAuth(audience), async (c) => {
      await mfa.disable(c.var.ctx, await jsonBody(c, passwordCodeSchema));
      return c.json({ data: { ok: true } });
    });
    a.post('/mfa/backup-codes', requireAuth(audience), async (c) =>
      c.json({ data: await mfa.regenerateBackupCodes(c.var.ctx, await jsonBody(c, passwordCodeSchema)) }),
    );

    r.route(`/${audience}`, a);
  }
  return r;
}
