import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { seedBase } from '../helpers/seed';

const count = async (table: string) =>
  (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

describe('seeds', () => {
  it('applies base + nonprod twice without errors or duplicates', async () => {
    await seedBase();
    const before = {
      roles: await count('roles'),
      services: await count('services'),
      settings: await count('application_settings'),
    };
    await seedBase();
    expect({
      roles: await count('roles'),
      services: await count('services'),
      settings: await count('application_settings'),
    }).toEqual(before);
    expect(before.roles).toBe(7);
    expect(before.services).toBe(37);
  });

  it('routes USD to the Paynow account and keeps the mock as a low-priority fallback', async () => {
    await seedBase();
    const { results } = await env.DB.prepare(
      'SELECT account_id, currency, priority FROM payment_routes ORDER BY priority',
    ).all();
    expect(results).toEqual([
      { account_id: 'ppa_paynow_usd', currency: 'USD', priority: 100 },
      { account_id: 'ppa_mock', currency: '*', priority: 900 },
    ]);
  });
});
