const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const ID_PREFIXES = [
  'usr',
  'ses',
  'tok',
  'rol',
  'cli',
  'con',
  'cua',
  'cnt',
  'ccr',
  'enq',
  'led',
  'lac',
  'svc',
  'scat',
  'quo',
  'qit',
  'inv',
  'iit',
  'ish',
  'crn',
  'cni',
  'irm',
  'ppa',
  'prt',
  'att',
  'pay',
  'spm',
  'pal',
  'pev',
  'ref',
  'prj',
  'mil',
  'tsk',
  'pup',
  'pfl',
  'pmg',
  'exc',
  'exp',
  'sup',
  'smg',
  'fil',
  'med',
  'pag',
  'sec',
  'pfo',
  'prd',
  'ann',
  'tm',
  'tax',
  'obx',
  'ntf',
  'eml',
  'aud',
  'bak',
  'pkg',
  'pft',
  'pad',
  'sub',
  'spd',
  'ast',
  'job',
  'app',
  'aev',
  'pst',
  'pct',
  'ptg',
  'ind',
  'faq',
  'tst',
  'tec',
  'nws',
  'tim',
  'bkc',
  'req',
] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

function encodeTime(ms: number): string {
  let out = '';
  let t = ms;
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CROCKFORD[b & 31];
  return out;
}

/** ULID-style ID (48-bit time + 80 bits randomness, Crockford base32) with a type prefix: `inv_01JC…`. Sortable by creation time. */
export function newId(prefix: IdPrefix, nowMs: number = Date.now()): string {
  return `${prefix}_${encodeTime(nowMs)}${randomChars(16)}`;
}

/** Decodes the creation time from an ID produced by `newId`. */
export function idTimestamp(id: string): number {
  const body = id.slice(id.indexOf('_') + 1, id.indexOf('_') + 11);
  let t = 0;
  for (const ch of body) t = t * 32 + CROCKFORD.indexOf(ch);
  return t;
}

/** URL-safe random token (default 32 bytes) for cookies, public document links, invites. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
