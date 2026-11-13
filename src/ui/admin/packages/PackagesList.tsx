/**
 * Packages grouped by pricing tab, in comparison order, with price approval (R6.2). Prices are shown mono and right-aligned;
 * a notice counts the prices awaiting review. Presentation only: the data and the approval call are unchanged.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { StatusPill } from '../../primitives';
import { Button } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { PaneBox } from '../PaneBox';
import { STATUS_PILL } from '../website/lib';
import { Sortable } from '../website/parts';
import { TABS, useApprovePrices, type PackageRowView } from './usePackages';

export function ReviewBadge() {
  return <StatusPill tone="warn">Price awaiting review</StatusPill>;
}

export function PackagesList({
  packages,
  canReview,
  reviewOnly,
}: {
  packages: PackageRowView[];
  canReview: boolean;
  reviewOnly: boolean;
}) {
  const a = useApprovePrices();
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const flagged = packages.filter((p) => p.priceReviewRequired);
  const row = (p: PackageRowView) => {
    const st = STATUS_PILL[p.status] ?? { label: p.status, tone: 'neutral' as const };
    return (
      <>
        <div className="kz-alist__main">
          <a href={`/admin/packages/${p.id}`} className="kz-alist__t">
            {p.name}
          </a>
          <span className="kz-alist__m">
            {p.serviceName} <StatusPill tone={st.tone}>{st.label}</StatusPill>
            {p.mostPopular ? <StatusPill tone="lit">Most popular</StatusPill> : null}
            {p.priceReviewRequired ? <ReviewBadge /> : null}
          </span>
        </div>
        <span className="kz-alist__r">{p.price}</span>
        {p.priceReviewRequired && canReview ? (
          <div className="kz-arow-acts">
            <Button size="sm" variant="secondary" onClick={() => setConfirm([p.id])}>
              Approve price<span className="sr-only"> of {p.name}</span>
            </Button>
          </div>
        ) : null}
      </>
    );
  };
  return (
    <div className="kz-astack">
      <FormAlert message={a.error} />
      {flagged.length > 0 ? (
        <div className="kz-anotice">
          <p>
            <strong>
              {flagged.length} {flagged.length === 1 ? 'package price needs' : 'package prices need'} review.
            </strong>{' '}
            {canReview
              ? 'Check each price, then approve it.'
              : 'An administrator with price approval rights must approve them.'}
          </p>
          {canReview ? (
            <Button variant="secondary" onClick={() => setConfirm([])}>
              Approve all {flagged.length}
            </Button>
          ) : null}
        </div>
      ) : null}
      {reviewOnly ? (
        <PaneBox id="review-title" title="Awaiting review" meta={String(flagged.length)} flush={flagged.length > 0}>
          {flagged.length === 0 ? (
            <p className="kz-anone">Every price has been approved.</p>
          ) : (
            <ul className="kz-alist">
              {flagged.map((p) => (
                <li key={p.id}>{row(p)}</li>
              ))}
            </ul>
          )}
        </PaneBox>
      ) : (
        TABS.map((t) => {
          const items = packages.filter((p) => p.tab === t.value);
          return (
            <PaneBox
              key={t.value}
              id={`tab-${t.value}`}
              title={t.label}
              meta="order = column order in the /pricing comparison"
              flush={items.length > 0}
            >
              {items.length === 0 ? (
                <p className="kz-anone">No packages in this tab yet.</p>
              ) : (
                <Sortable
                  items={items}
                  saveUrl="/api/v1/admin/packages/order"
                  saveBody={{ tab: t.value }}
                  label={`${t.label} packages`}
                  render={row}
                />
              )}
            </PaneBox>
          );
        })
      )}
      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.length ? 'Approve this price?' : `Approve all ${flagged.length} prices?`}
        confirmLabel="Approve"
        onConfirm={() => a.approve(confirm ?? [])}
      >
        Approved prices stop showing as suggestions. The approval is recorded in the audit log.
      </ConfirmSheet>
    </div>
  );
}
