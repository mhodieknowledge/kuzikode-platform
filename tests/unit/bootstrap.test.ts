import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCreateSql, buildInviteEmailSql, parseArgs, run } from '../../scripts/bootstrap-admin';

describe('bootstrap-admin argument parsing and SQL', () => {
  it('validates arguments', () => {
    expect(parseArgs(['--env', 'local', '--email', 'Owner@Example.com', '--name', 'Owner'])).toMatchObject({
      env: 'local',
      email: 'owner@example.com',
      reissue: false,
      sendEmail: false,
    });
    expect(parseArgs(['--env', 'staging', '--email', 'a@b.co', '--name', 'A', '--send-email']).sendEmail).toBe(true);
    expect(() => parseArgs(['--env', 'prod', '--email', 'a@b.co', '--name', 'x'])).toThrow(/--env/);
    expect(() => parseArgs(['--env', 'local', '--email', 'nope', '--name', 'x'])).toThrow(/--email/);
    expect(() => parseArgs(['--env', 'local', '--email', 'a@b.co'])).toThrow(/--name/);
  });

  it('escapes values and stores only the token hash', () => {
    const sql = buildCreateSql({
      userId: 'usr_1',
      email: "o'brien@example.com",
      name: "O'Brien",
      tokenId: 'tok_1',
      tokenHash: 'abc',
      now: new Date('2026-11-05T00:00:00Z'),
    });
    expect(sql).toContain("'o''brien@example.com'");
    expect(sql).toContain("'invite_staff', 'abc', '2026-11-06T00:00:00.000Z'");
    expect(sql).toContain("'rol_super_admin'");
    expect(sql).toContain("'system', 'user.bootstrap_super_admin'");
  });

  it('builds the invitation email outbox row with the link only inside the payload', () => {
    const sql = buildInviteEmailSql({
      email: "o'brien@example.com",
      name: "O'Brien",
      link: 'https://kuzikode-staging.example.workers.dev/admin/accept-invite?token=abc',
      tokenId: 'tok_1',
      now: new Date('2026-11-05T00:00:00Z'),
    });
    expect(sql).toMatch(/^INSERT OR IGNORE INTO outbox /);
    expect(sql).toContain("'email.send'");
    expect(sql).toContain("'email:invite:tok_1'");
    expect(sql).toContain('"template":"staff_invitation"');
    expect(sql).toContain('"to":"o\'\'brien@example.com"');
    expect(sql).toContain('"expiresInDays":1');
  });
});

describe('bootstrap-admin against a local D1', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'kz-bootstrap-'));
    execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', dir], {
      stdio: 'ignore',
    });
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', dir, '--file', 'seeds/base.sql', '--yes'],
      {
        stdio: 'ignore',
      },
    );
  }, 120_000);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const sql = (command: string) =>
    JSON.parse(
      execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', dir, '--json', '--command', command],
        { encoding: 'utf8' },
      ),
    )[0].results;

  it('creates an invited super admin with a 24 h link, then refuses a second run once active', () => {
    const args = {
      env: 'local' as const,
      email: 'owner@example.com',
      name: 'Owner',
      reissue: false,
      sendEmail: false,
      persistTo: dir,
    };
    const { link } = run(args);
    expect(link).toMatch(/^http:\/\/localhost:8787\/admin\/accept-invite\?token=[A-Za-z0-9_-]{43}$/);
    const [user] = sql("SELECT status, user_type, password_hash FROM users WHERE email = 'owner@example.com'");
    expect(user).toEqual({ status: 'invited', user_type: 'staff', password_hash: null });
    expect(() => run(args)).toThrow(/already exists/);
    expect(run({ ...args, reissue: true }).link).not.toBe(link);
    expect(sql("SELECT count(*) n FROM auth_tokens WHERE purpose = 'invite_staff' AND used_at IS NULL")[0].n).toBe(1);
    sql("UPDATE users SET status = 'active' WHERE email = 'owner@example.com'");
    expect(() => run({ ...args, email: 'second@example.com' })).toThrow(/Super Administrator already exists/);
    expect(() => run({ ...args, reissue: true })).toThrow(/already exists/);
  }, 120_000);

  it('--send-email queues the invitation through the outbox instead of returning it for printing', () => {
    sql("UPDATE users SET status = 'disabled' WHERE email = 'owner@example.com'");
    const res = run({
      env: 'local',
      email: 'mailed@example.com',
      name: 'Mailed Owner',
      reissue: false,
      sendEmail: true,
      persistTo: dir,
    });
    expect(res.emailed).toBe(true);
    const [job] = sql("SELECT type, status, payload FROM outbox WHERE idempotency_key LIKE 'email:invite:%'");
    expect(job.type).toBe('email.send');
    expect(job.status).toBe('pending');
    const payload = JSON.parse(job.payload);
    expect(payload).toEqual({
      template: 'staff_invitation',
      to: 'mailed@example.com',
      data: { name: 'Mailed Owner', link: res.link, expiresInDays: 1 },
    });
  }, 120_000);
});
