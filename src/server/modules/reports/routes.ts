import { Hono } from 'hono';
import { auditQuery, reportExportQuery, reportRangeQuery } from '../../../shared/schemas/reports';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { query } from '../../middleware/validate';
import { exportAuditCsv, exportModuleJson, exportTableCsv, listAudit } from '../audit/service';
import { exportReportCsv, reports, resolveRange } from './service';

const csv = (body: string, name: string) =>
  new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });

/** `/api/v1/admin/reports`, `/api/v1/admin/audit` and `/api/v1/admin/data-export` (P4.18). */
export function reportRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());

  r.get('/reports', requirePermission('reports.view'), async (c) =>
    c.json({ data: await reports(c.var.ctx, resolveRange(c.var.ctx, query(c, reportRangeQuery))) }),
  );
  r.get('/reports/export.csv', requirePermission('reports.export'), async (c) => {
    const q = query(c, reportExportQuery);
    const range = resolveRange(c.var.ctx, q);
    return csv(await exportReportCsv(c.var.ctx, q.report, range), `${q.report}-${range.from}-${range.to}.csv`);
  });

  r.get('/audit', requirePermission('audit.view'), async (c) =>
    c.json({ data: await listAudit(c.var.ctx, query(c, auditQuery)) }),
  );
  r.get('/audit/export.csv', requirePermission('audit.view'), async (c) => {
    const { page: _page, ...q } = query(c, auditQuery);
    return csv(await exportAuditCsv(c.var.ctx, q), `audit-log-${c.var.ctx.now().toISOString().slice(0, 10)}.csv`);
  });

  r.get('/data-export/:module', requirePermission('data.export'), async (c) => {
    const data = await exportModuleJson(c.var.ctx, c.req.param('module'));
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="kuzikode-${data.module}-${data.exportedAt.slice(0, 10)}.json"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });
  r.get('/data-export/:module/:table', requirePermission('data.export'), async (c) => {
    const table = c.req.param('table').replace(/\.csv$/, '');
    return csv(
      await exportTableCsv(c.var.ctx, c.req.param('module'), table),
      `kuzikode-${table}-${c.var.ctx.now().toISOString().slice(0, 10)}.csv`,
    );
  });
  return r;
}
