/** The services overview (R6.2): divisions in order, each with its services in order; drag or move buttons reorder and save at once. */
import { LinkButton } from '../../primitives/button';
import { StatusPill } from '../../primitives';
import { PaneBox } from '../PaneBox';
import { STATUS_PILL } from '../website/lib';
import { Sortable } from '../website/parts';
import type { CatalogueDivision } from './useServices';

export function Status({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? { label: status, tone: 'neutral' as const };
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
}

export function CatalogueList({ divisions }: { divisions: CatalogueDivision[] }) {
  return (
    <div className="kz-astack">
      <PaneBox
        id="div-order"
        title="Divisions"
        meta="the order here is the order on the website"
        actions={
          <LinkButton href="/admin/services/divisions/new" variant="secondary" size="sm" lead="add">
            New division
          </LinkButton>
        }
        flush
      >
        <Sortable
          label="Divisions"
          items={divisions}
          saveUrl="/api/v1/admin/catalogue/categories/order"
          render={(d) => (
            <div className="kz-alist__main">
              <a href={`/admin/services/divisions/${d.id}`} className="kz-alist__t">
                {d.name}
              </a>
              <span className="kz-alist__m">
                <Status status={d.status} />
                {d.featured ? ' Featured · ' : ' '}
                {d.services.length} {d.services.length === 1 ? 'service' : 'services'}
              </span>
            </div>
          )}
        />
      </PaneBox>
      {divisions.map((d) => (
        <PaneBox
          key={d.id}
          id={`svc-${d.id}`}
          title={d.name}
          meta={`${d.services.length} ${d.services.length === 1 ? 'service' : 'services'}`}
          actions={
            <LinkButton
              href={`/admin/services/new?division=${encodeURIComponent(d.id)}`}
              variant="secondary"
              size="sm"
              lead="add"
            >
              Add service<span className="sr-only"> to {d.name}</span>
            </LinkButton>
          }
          flush
        >
          {d.services.length === 0 ? (
            <p className="kz-anone kz-anone--pad">No services yet.</p>
          ) : (
            <Sortable
              label={`${d.name} services`}
              items={d.services}
              saveUrl={`/api/v1/admin/catalogue/categories/${d.id}/services/order`}
              render={(s) => (
                <>
                  <div className="kz-alist__main">
                    <a href={`/admin/services/${s.id}`} className="kz-alist__t">
                      {s.name}
                    </a>
                    <span className="kz-alist__m">
                      <Status status={s.status} />
                      {s.featured ? ' Featured' : ''}
                    </span>
                  </div>
                  <span className="kz-alist__r">{s.price}</span>
                </>
              )}
            />
          )}
        </PaneBox>
      ))}
    </div>
  );
}
