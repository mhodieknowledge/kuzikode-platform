/**
 * Applicants as a list or a pipeline board (R6.2), with "Move to" on each card and bulk reject (+ regret email). The board is a
 * swipe track of stage columns; the e2e finds it as the "Pipeline" list with one "<Stage> (n)" item per column.
 */
import { Star } from 'lucide-react';
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { StatusPill } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSheet } from '../form';
import { ApplicantControls } from './ApplicantControls';
import { PIPELINE, STATUS_LABELS, usePipeline, type ApplicantCard } from './useCareers';

function Rating({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="kz-wsr__rating" aria-label={`Rated ${value} of 5`}>
      <Star size={12} aria-hidden="true" /> {value}
    </span>
  );
}

export function ApplicantsPipeline({
  items,
  view,
  canManage,
}: {
  items: ApplicantCard[];
  view: 'list' | 'board';
  canManage: boolean;
}) {
  const p = usePipeline();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [regret, setRegret] = useState(true);
  const body = (c: ApplicantCard) => (
    <>
      <div className="kz-wsr__top">
        <a href={`/admin/careers/applications/${c.id}`} className="kz-aboard__t">
          {c.name}
        </a>
        <Rating value={c.rating} />
      </div>
      <p className="kz-aboard__m">
        {c.reference}
        {c.posting ? ` · ${c.posting}` : ''}
        {c.assignee ? ` · ${c.assignee}` : ''}
      </p>
      {c.tags.length ? (
        <p className="kz-dt__tags">
          {c.tags.map((t) => (
            <span key={t} className="kz-tag">
              {t}
            </span>
          ))}
        </p>
      ) : null}
      {canManage && !c.erased ? (
        <ApplicantControls
          card={c}
          selected={p.selected.includes(c.id)}
          onMove={(to) => void p.move(c.id, to)}
          onSelect={(on) => p.toggle(c.id, on)}
        />
      ) : null}
    </>
  );
  return (
    <div className="kz-astack">
      {rejectOpen ? null : <FormAlert message={p.error} />}
      <p className="sr-only" role="status">
        {p.status}
      </p>
      {canManage ? (
        <div>
          <Button variant="secondary" disabled={p.selected.length === 0} onClick={() => setRejectOpen(true)}>
            Reject selected ({p.selected.length})
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <section className="kz-apane">
          <div className="kz-apane__body">
            <p className="kz-anone">No applicants match.</p>
          </div>
        </section>
      ) : view === 'board' ? (
        <div className="kz-aboard kz-aboard--track" role="list" aria-label="Pipeline">
          {PIPELINE.map((s) => {
            const col = items.filter((c) => c.status === s);
            return (
              <section
                key={s}
                role="listitem"
                aria-label={`${STATUS_LABELS[s]} (${col.length})`}
                className="kz-aboard__col"
                data-stage={s}
              >
                <p className="kz-aboard__h" aria-hidden="true">
                  {STATUS_LABELS[s]}
                  <span className="kz-aboard__n">{col.length}</span>
                </p>
                {col.length === 0 ? (
                  <p className="kz-aboard__none">none</p>
                ) : (
                  <ul className="kz-aboard__list">
                    {col.map((c) => (
                      <li key={c.id} className="kz-aboard__card kz-wsr__card">
                        {body(c)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <section className="kz-apane" aria-label="Applicants">
          <ul className="kz-alist kz-wsr__applicants">
            {items.map((c) => (
              <li key={c.id}>
                <div className="kz-alist__main kz-wsr__card">{body(c)}</div>
                <StatusPill tone={c.status === 'hired' ? 'ok' : c.status === 'new' ? 'lit' : 'neutral'}>
                  {STATUS_LABELS[c.status]}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
      <FormSheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`Reject ${p.selected.length} ${p.selected.length === 1 ? 'applicant' : 'applicants'}?`}
        formId="careers-reject"
        submitLabel="Reject"
        danger
        busy={p.busy}
        error={p.error}
        onSubmit={() => void p.reject(regret)}
      >
        <p className="kz-adlg__desc">They move to Rejected. The regret email uses your saved template.</p>
        <CheckItem checked={regret} onChange={(e) => setRegret(e.target.checked)}>
          Send the regret email
        </CheckItem>
      </FormSheet>
    </div>
  );
}
