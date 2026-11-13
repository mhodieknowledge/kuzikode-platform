/**
 * List managers of Admin → Content (R6.2): article categories, FAQ, testimonials and technologies. Each is a list of rows with
 * edit and delete (the delete asks first) and a sheet for new and edited records. Accessible names ("Edit question: …",
 * "Delete testimonial", "Edit category <name>") are the e2e contract.
 */
import { useState, type ReactNode } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSheet } from '../form';
import { contentApi } from '../website/lib';
import { DeleteAction, ManagerList } from '../website/parts';
import { useCrud } from '../website/useCrud';
import { FAQ_CATEGORIES, sortOrderOf } from './useContent';

function RowDelete({ label, path, description }: { label: string; path: string; description: string }) {
  return (
    <DeleteAction
      size="sm"
      variant="secondary"
      buttonLabel="Delete"
      buttonAriaLabel={`Delete ${label}`}
      title={`Delete ${label}?`}
      description={description}
      confirmLabel="Delete"
      call={() => contentApi(path, { method: 'DELETE' })}
    />
  );
}

function NewButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button lead="add" onClick={onClick} {...(disabled ? { disabled } : {})}>
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------- categories

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  posts: number;
}

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const a = useCrud(contentApi, '/post-categories');
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="kz-astack">
      <ManagerList label="Categories" title="Categories" empty="No categories yet.">
        {categories.map((c) => (
          <li key={c.id}>
            <div className="kz-alist__main">
              <span className="kz-alist__t">{c.name}</span>
              <span className="kz-alist__m">{c.posts} articles</span>
            </div>
            <div className="kz-arow-acts">
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Edit category ${c.name}`}
                onClick={() => setEditing(c)}
              >
                Edit
              </Button>
              {c.posts === 0 ? (
                <RowDelete
                  label={`category ${c.name}`}
                  path={`/post-categories/${c.id}`}
                  description="The category is removed."
                />
              ) : null}
            </div>
          </li>
        ))}
      </ManagerList>
      <div>
        <Button variant="secondary" lead="add" onClick={() => setEditing('new')}>
          New category
        </Button>
      </div>
      {editing ? null : <FormAlert message={a.error} />}
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title={current ? 'Edit category' : 'New category'}
          formId="ct-category"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.save(current?.id, {
              name: f.get('name'),
              slug: f.get('slug'),
              sortOrder: sortOrderOf(f.get('sortOrder')),
            })
          }
        >
          <TextField label="Name" name="name" defaultValue={current?.name ?? ''} maxLength={60} error={a.err('name')} />
          <TextField
            label="Address"
            hint="Lowercase with hyphens, e.g. guides."
            name="slug"
            defaultValue={current?.slug ?? ''}
            maxLength={80}
            error={a.err('slug')}
          />
          <TextField
            label="Order"
            name="sortOrder"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={current?.sort_order ?? 0}
            error={a.err('sortOrder')}
          />
        </FormSheet>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- FAQ

export interface FaqRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  service_id: string | null;
  service_name: string | null;
  sort_order: number;
  published: number;
}

export function FaqManager({ faqs, services }: { faqs: FaqRow[]; services: { id: string; name: string }[] }) {
  const a = useCrud(contentApi, '/faqs');
  const [editing, setEditing] = useState<FaqRow | 'new' | null>(null);
  const [published, setPublished] = useState(true);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="kz-astack">
      <div>
        <NewButton
          onClick={() => {
            setPublished(true);
            setEditing('new');
          }}
        >
          New question
        </NewButton>
      </div>
      {FAQ_CATEGORIES.map((cat) => {
        const rows = faqs.filter((f) => f.category === cat.value);
        return rows.length ? (
          <section key={cat.value} className="kz-apane" aria-label={cat.label}>
            <div className="kz-apane__head">
              <h2 className="kz-apane__title">{cat.label}</h2>
              <span className="kz-apane__meta">{rows.length}</span>
            </div>
            <ul className="kz-alist">
              {rows.map((f) => (
                <li key={f.id}>
                  <div className="kz-alist__main">
                    <span className="kz-alist__t">{f.question}</span>
                    <span className="kz-alist__m">
                      {f.published ? 'Published' : 'Hidden'}
                      {f.service_name ? ` · ${f.service_name}` : ''}
                    </span>
                  </div>
                  <div className="kz-arow-acts">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit question: ${f.question}`}
                      onClick={() => {
                        setPublished(f.published === 1);
                        setEditing(f);
                      }}
                    >
                      Edit
                    </Button>
                    <RowDelete
                      label="question"
                      path={`/faqs/${f.id}`}
                      description="The question is removed from the website."
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      {faqs.length === 0 ? <p className="kz-anone">No questions yet.</p> : null}
      {editing ? null : <FormAlert message={a.error} />}
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title={current ? 'Edit question' : 'New question'}
          formId="ct-faq"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.save(current?.id, {
              category: f.get('category'),
              question: f.get('question'),
              answer: f.get('answer'),
              serviceId: f.get('serviceId'),
              sortOrder: sortOrderOf(f.get('sortOrder')),
              published,
            })
          }
        >
          <SelectField
            label="Category"
            name="category"
            defaultValue={current?.category ?? 'general'}
            error={a.err('category')}
          >
            {FAQ_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Question"
            name="question"
            defaultValue={current?.question ?? ''}
            maxLength={200}
            error={a.err('question')}
          />
          <TextareaField
            label="Answer"
            name="answer"
            rows={4}
            defaultValue={current?.answer ?? ''}
            maxLength={2000}
            error={a.err('answer')}
          />
          <SelectField
            label="Related service"
            hint="Optional."
            name="serviceId"
            defaultValue={current?.service_id ?? ''}
            error={a.err('serviceId')}
          >
            <option value="">None</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Order"
            name="sortOrder"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={current?.sort_order ?? 0}
            error={a.err('sortOrder')}
          />
          <CheckItem checked={published} onChange={(e) => setPublished(e.target.checked)}>
            Show on the website
          </CheckItem>
        </FormSheet>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- testimonials

export interface TestimonialRow {
  id: string;
  client_id: string;
  client_name: string;
  project_id: string | null;
  project_name: string | null;
  author_name: string;
  author_role: string | null;
  quote: string;
  consent_date: string;
  published: number;
  sort_order: number;
}

export function TestimonialsManager({
  items,
  clients,
  projects,
  today,
}: {
  items: TestimonialRow[];
  clients: { id: string; name: string }[];
  projects: { id: string; client_id: string; name: string }[];
  today: string;
}) {
  const a = useCrud(contentApi, '/testimonials');
  const [editing, setEditing] = useState<TestimonialRow | 'new' | null>(null);
  const [clientId, setClientId] = useState('');
  const [consent, setConsent] = useState(false);
  const [published, setPublished] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const open = (row: TestimonialRow | 'new') => {
    setClientId(row === 'new' ? '' : row.client_id);
    setConsent(row !== 'new');
    setPublished(row === 'new' ? false : row.published === 1);
    setEditing(row);
  };
  return (
    <div className="kz-astack">
      <div>
        <NewButton onClick={() => open('new')} disabled={clients.length === 0}>
          New testimonial
        </NewButton>
        {clients.length === 0 ? (
          <p className="kz-hint">Add the client record first: every testimonial must come from a real client.</p>
        ) : null}
      </div>
      <ManagerList
        label="Testimonials"
        empty="No testimonials. The website hides the testimonials block until one is published."
      >
        {items.map((t) => (
          <li key={t.id}>
            <div className="kz-alist__main">
              <span className="kz-alist__t">“{t.quote}”</span>
              <span className="kz-alist__m">
                {t.author_name}
                {t.author_role ? `, ${t.author_role}` : ''} · {t.client_name}
                {t.project_name ? ` · ${t.project_name}` : ''} · consent {t.consent_date} ·{' '}
                {t.published ? 'Published' : 'Hidden'}
              </span>
            </div>
            <div className="kz-arow-acts">
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Edit testimonial from ${t.author_name}`}
                onClick={() => open(t)}
              >
                Edit
              </Button>
              <RowDelete
                label="testimonial"
                path={`/testimonials/${t.id}`}
                description="The testimonial is removed from the website."
              />
            </div>
          </li>
        ))}
      </ManagerList>
      {editing ? null : <FormAlert message={a.error} />}
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title={current ? 'Edit testimonial' : 'New testimonial'}
          formId="ct-testimonial"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.save(current?.id, {
              clientId,
              projectId: f.get('projectId'),
              authorName: f.get('authorName'),
              authorRole: f.get('authorRole'),
              quote: f.get('quote'),
              consentObtained: consent,
              consentDate: f.get('consentDate'),
              published,
              sortOrder: sortOrderOf(f.get('sortOrder')),
            })
          }
        >
          <SelectField
            label="Client"
            value={clientId}
            onChange={(x) => setClientId(x.target.value)}
            error={a.err('clientId')}
          >
            <option value="">Choose a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            key={clientId}
            label="Project"
            hint="Optional."
            name="projectId"
            defaultValue={current?.client_id === clientId ? (current?.project_id ?? '') : ''}
            error={a.err('projectId')}
          >
            <option value="">None</option>
            {projects
              .filter((p) => p.client_id === clientId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </SelectField>
          <TextField
            label="Person quoted"
            name="authorName"
            defaultValue={current?.author_name ?? ''}
            maxLength={100}
            error={a.err('authorName')}
          />
          <TextField
            label="Their role"
            name="authorRole"
            defaultValue={current?.author_role ?? ''}
            maxLength={100}
            error={a.err('authorRole')}
          />
          <TextareaField
            label="Quote"
            hint="Their words, unedited apart from spelling."
            name="quote"
            rows={4}
            defaultValue={current?.quote ?? ''}
            maxLength={800}
            error={a.err('quote')}
          />
          <CheckItem checked={consent} onChange={(e) => setConsent(e.target.checked)}>
            The client agreed in writing to this quote being published
          </CheckItem>
          {a.err('consentObtained') ? <FormAlert message={a.err('consentObtained') ?? null} /> : null}
          <TextField
            label="Date consent was given"
            name="consentDate"
            type="date"
            max={today}
            defaultValue={current?.consent_date ?? ''}
            error={a.err('consentDate')}
          />
          <TextField
            label="Order"
            name="sortOrder"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={current?.sort_order ?? 0}
            error={a.err('sortOrder')}
          />
          <CheckItem checked={published} onChange={(e) => setPublished(e.target.checked)}>
            Show on the website
          </CheckItem>
        </FormSheet>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- technologies

export interface TechRow {
  id: string;
  name: string;
  category: string;
  logo_svg_path: string | null;
  sort_order: number;
  published: number;
}

export function TechnologiesManager({ items }: { items: TechRow[] }) {
  const a = useCrud(contentApi, '/technologies');
  const [editing, setEditing] = useState<TechRow | 'new' | null>(null);
  const [published, setPublished] = useState(true);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="kz-astack">
      <div>
        <NewButton
          onClick={() => {
            setPublished(true);
            setEditing('new');
          }}
        >
          New technology
        </NewButton>
      </div>
      <ManagerList label="Technologies" empty="No technologies listed.">
        {items.map((t) => (
          <li key={t.id}>
            <div className="kz-alist__main">
              <span className="kz-alist__t">{t.name}</span>
              <span className="kz-alist__m">
                {t.category}
                {t.published ? '' : ' · Hidden'}
              </span>
            </div>
            <div className="kz-arow-acts">
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Edit ${t.name}`}
                onClick={() => {
                  setPublished(t.published === 1);
                  setEditing(t);
                }}
              >
                Edit
              </Button>
              <RowDelete
                label={t.name}
                path={`/technologies/${t.id}`}
                description="It is removed from the technologies strip."
              />
            </div>
          </li>
        ))}
      </ManagerList>
      {editing ? null : <FormAlert message={a.error} />}
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title={current ? 'Edit technology' : 'New technology'}
          formId="ct-tech"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.save(current?.id, {
              name: f.get('name'),
              category: f.get('category'),
              logoSvgPath: f.get('logoSvgPath'),
              sortOrder: sortOrderOf(f.get('sortOrder')),
              published,
            })
          }
        >
          <TextField label="Name" name="name" defaultValue={current?.name ?? ''} maxLength={40} error={a.err('name')} />
          <TextField
            label="Group"
            hint="For example Languages, Frameworks, Cloud."
            name="category"
            defaultValue={current?.category ?? ''}
            maxLength={40}
            error={a.err('category')}
          />
          <TextField
            label="Logo"
            hint="Optional site path to a monochrome SVG, e.g. /tech/react.svg."
            name="logoSvgPath"
            defaultValue={current?.logo_svg_path ?? ''}
            maxLength={200}
            error={a.err('logoSvgPath')}
          />
          <TextField
            label="Order"
            name="sortOrder"
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={current?.sort_order ?? 0}
            error={a.err('sortOrder')}
          />
          <CheckItem checked={published} onChange={(e) => setPublished(e.target.checked)}>
            Show on the website
          </CheckItem>
        </FormSheet>
      ) : null}
    </div>
  );
}
