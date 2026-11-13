import type { RequestContext } from '../context';
import type { EmailProvider } from './provider';
import { logProvider } from './providers/log';
import { resendProvider } from './providers/resend';
import type { Brand } from './templates/layout';

/** Resend when configured (EMAIL_PROVIDER=resend + RESEND_API_KEY), otherwise the log adapter. */
export function emailProvider(ctx: RequestContext): EmailProvider {
  if (ctx.config.emailProvider === 'resend' && ctx.config.resendApiKey) return resendProvider(ctx.config.resendApiKey);
  return logProvider(ctx.logger);
}

export async function brandFor(ctx: RequestContext): Promise<Brand> {
  const row = await ctx.db
    .prepare("SELECT value FROM application_settings WHERE key = 'company.name'")
    .first<{ value: string }>();
  return {
    companyName: row ? (JSON.parse(row.value) as string) : 'Kuzikode Intelligent Technologies',
    siteUrl: ctx.config.siteUrl.toString(),
  };
}

export { EmailProviderError, type EmailMessage, type EmailProvider } from './provider';
