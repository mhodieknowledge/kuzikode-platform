import { Hono } from 'hono';
import { ConfigError } from './config';
import { AppError, toErrorResponse } from './lib/errors';
import { createLogger } from './lib/logger';
import { PRIVATE_HEADERS, securityHeaders } from './lib/security-headers';
import { apiHeaders } from './middleware/headers';
import { requestContext, type ApiEnv } from './middleware/request-context';
import { authRoutes } from './modules/auth';
import { fileRoutes } from './modules/files';
import { roleRoutes, userRoutes } from './modules/users';
import { enquiryAdminRoutes, leadAdminRoutes, publicEnquiryRoutes } from './modules/leads';
import { publicNewsletterRoutes } from './modules/newsletter';
import { careersAdminRoutes, publicCareersRoutes } from './modules/careers';
import { adminShellRoutes } from './modules/admin';
import { settingsRoutes } from './modules/settings';
import { clientRoutes } from './modules/clients';
import { catalogueRoutes } from './modules/catalogue';
import { packageRoutes } from './modules/packages';
import { assetRoutes, subscriptionRoutes } from './modules/subscriptions';
import { publicQuotationRoutes, quotationRoutes } from './modules/quotations';
import { documentRoutes, publicDocumentRoutes } from './modules/documents';
import { invoiceRoutes } from './modules/invoices';
import { paymentRoutes } from './modules/payments';
import { projectRoutes } from './modules/projects';
import { expenseRoutes } from './modules/expenses';
import { supportRoutes } from './modules/support';
import { cmsAdminRoutes, contentAdminRoutes } from './modules/cms';
import { timeRoutes } from './modules/timetracking';

export function createApp() {
  const app = new Hono<ApiEnv>();

  app.use('*', requestContext());
  app.use('*', apiHeaders());

  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));
  app.route('/api/v1/auth', authRoutes());
  app.route('/api/v1', fileRoutes());
  app.route('/api/v1/admin/users', userRoutes());
  app.route('/api/v1/admin/roles', roleRoutes());
  app.route('/api/v1/admin/settings', settingsRoutes());
  app.route('/api/v1/admin/clients', clientRoutes());
  app.route('/api/v1/admin/catalogue', catalogueRoutes());
  app.route('/api/v1/admin/packages', packageRoutes());
  app.route('/api/v1/admin/subscriptions', subscriptionRoutes());
  app.route('/api/v1/admin/careers', careersAdminRoutes());
  app.route('/api/v1/admin/assets', assetRoutes());
  app.route('/api/v1/admin/quotations', quotationRoutes());
  app.route('/api/v1/admin/documents', documentRoutes());
  app.route('/api/v1/admin/invoices', invoiceRoutes());
  app.route('/api/v1/admin/payments', paymentRoutes());
  app.route('/api/v1/admin/projects', projectRoutes());
  app.route('/api/v1/admin/expenses', expenseRoutes());
  app.route('/api/v1/admin/time', timeRoutes());
  app.route('/api/v1/admin/support', supportRoutes());
  app.route('/api/v1/admin/cms', cmsAdminRoutes());
  app.route('/api/v1/admin/content', contentAdminRoutes());
  app.route('/api/v1/admin/enquiries', enquiryAdminRoutes());
  app.route('/api/v1/admin/leads', leadAdminRoutes());
  app.route('/api/v1/admin', adminShellRoutes());
  app.route('/api/v1/public', publicEnquiryRoutes());
  app.route('/api/v1/public', publicNewsletterRoutes());
  app.route('/api/v1/public', publicCareersRoutes());
  app.route('/api/v1/public', publicQuotationRoutes());
  app.route('/api/v1/public', publicDocumentRoutes());

  app.notFound((c) => {
    const requestId = c.var.requestId ?? 'unknown';
    const { status, body } = toErrorResponse(new AppError('NOT_FOUND'), requestId);
    return c.json(body, status as 404);
  });

  app.onError((err, c) => {
    const requestId = c.var.requestId ?? 'unknown';
    const logger = c.var.ctx?.logger ?? createLogger({ requestId });
    if (err instanceof AppError) {
      if (err.status >= 500) logger.error('request failed', { code: err.code, detail: err.detail });
      else logger.info('request rejected', { code: err.code, detail: err.detail });
    } else {
      logger.error('unhandled error', { err: err instanceof ConfigError ? err.message : err });
    }
    const { status, body, headers } = toErrorResponse(err, requestId);
    const res = c.json(body, status as 500);
    const appEnv = c.var.ctx?.config.appEnv ?? 'production';
    for (const [k, v] of Object.entries({ ...securityHeaders(appEnv), ...PRIVATE_HEADERS, ...headers }))
      res.headers.set(k, v);
    res.headers.set('X-Request-Id', requestId);
    return res;
  });

  return app;
}
