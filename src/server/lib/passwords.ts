import commonList from './data/common-passwords.txt?raw';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

let common: Set<string> | undefined;
function commonPasswords(): Set<string> {
  common ??= new Set(commonList.split('\n').filter((l) => l && !l.startsWith('#')));
  return common;
}

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'];

/**
 * docs/07 §1 policy: at least 12 characters, not a common password, no composition rules.
 * Also rejects common passwords padded with digits/symbols, single repeated characters, simple runs, and the
 * user's own email or name. Returns a user-facing problem or null.
 */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  const lower = password.toLowerCase();
  const core = lower.replace(/^[\d\W_]+|[\d\W_]+$/g, '');
  const list = commonPasswords();
  if (list.has(lower) || (core.length >= 4 && list.has(core)) || /^(.)\1+$/.test(lower)) {
    return 'This password is too common. Choose something less predictable, such as a few unrelated words.';
  }
  if (SEQUENCES.some((s) => s.includes(lower) || [...s].reverse().join('').includes(lower))) {
    return 'This password is too predictable.';
  }
  const local = context.email?.split('@')[0]?.toLowerCase();
  if ((local && local.length >= 4 && lower.includes(local)) || lower.includes('kuzikode')) {
    return 'Don’t include your email address or the company name in your password.';
  }
  return null;
}
