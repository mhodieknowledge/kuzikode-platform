/* Structured JSON logger with redaction. The only place in src/ allowed to use console. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY =
  /pass(word)?|secret|token|api[-_]?key|integration[-_]?key|encryption[-_]?key|authorization|cookie|hash|otp|\bpin\b|card|cvv|signature|session/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE = /(?<!\d)(\+?\d[\d\s-]{6,}\d)(?!\d)/g;
const MAX_DEPTH = 6;

export const REDACTED = '[REDACTED]';

/** Masks an email to its first character + domain: `j***@example.com`. */
export function maskEmail(value: string): string {
  return value.replace(EMAIL, (_m, first: string, domain: string) => `${first}***@${domain}`);
}

/** Masks a phone number, keeping the last 3 digits. */
export function maskPhone(value: string): string {
  return value.replace(PHONE, (m) => {
    const digits = m.replace(/\D/g, '');
    return digits.length < 7 ? m : `***${digits.slice(-3)}`;
  });
}

/** Deep-copies a value, replacing sensitive keys and masking emails/phone numbers in strings. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[…]';
  if (typeof value === 'string') return maskPhone(maskEmail(value));
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: maskPhone(maskEmail(value.message)) };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export type LogSink = (level: LogLevel, line: string) => void;

const consoleSink: LogSink = (level, line) => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export function createLogger(
  base: Record<string, unknown> = {},
  sink: LogSink = consoleSink,
  minLevel: LogLevel = 'info',
): Logger {
  const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const emit = (level: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (order.indexOf(level) < order.indexOf(minLevel)) return;
    const entry = redact({ ...base, ...fields }) as Record<string, unknown>;
    sink(level, JSON.stringify({ level, msg, time: new Date().toISOString(), ...entry }));
  };
  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (fields) => createLogger({ ...base, ...fields }, sink, minLevel),
  };
}
