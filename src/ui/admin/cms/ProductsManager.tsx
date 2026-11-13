/** Website products (R6.2): list rows with edit, and a sheet for new and edited products. Labels are the e2e contract. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSheet } from '../form';
import { cmsApi } from '../website/lib';
import { ManagerList } from '../website/parts';
import { useCrud } from '../website/useCrud';

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  status: 'in_development' | 'beta' | 'available';
  interest_form_enabled: number;
  sort_order: number;
  published: number;
}

const PRODUCT_STATUS = [
  { value: 'in_development', label: 'In development' },
  { value: 'beta', label: 'Beta' },
  { value: 'available', label: 'Available' },
];

export function ProductsManager({ products }: { products: ProductRow[] }) {
  const a = useCrud(cmsApi, '/products');
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [flags, setFlags] = useState({ interest: false, published: false });
  const current = editing && editing !== 'new' ? editing : null;
  const open = (p: ProductRow | 'new') => {
    setFlags(
      p === 'new'
        ? { interest: false, published: false }
        : { interest: p.interest_form_enabled === 1, published: p.published === 1 },
    );
    setEditing(p);
  };
  return (
    <div className="kz-astack">
      <div>
        <Button lead="add" onClick={() => open('new')}>
          New product
        </Button>
      </div>
      <ManagerList label="Products" empty="No products yet.">
        {products.map((p) => (
          <li key={p.id}>
            <div className="kz-alist__main">
              <span className="kz-alist__t">{p.name}</span>
              <span className="kz-alist__m">
                /{p.slug} · {PRODUCT_STATUS.find((s) => s.value === p.status)?.label} ·{' '}
                {p.published ? 'shown on the website' : 'hidden'}
              </span>
            </div>
            <div className="kz-arow-acts">
              <Button size="sm" variant="secondary" aria-label={`Edit ${p.name}`} onClick={() => open(p)}>
                Edit
              </Button>
            </div>
          </li>
        ))}
      </ManagerList>
      {editing ? null : <FormAlert message={a.error} />}
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title={current ? `Edit ${current.name}` : 'New product'}
          formId="cms-product"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.save(current?.id, {
              slug: f.get('slug'),
              name: f.get('name'),
              tagline: f.get('tagline'),
              description: f.get('description'),
              status: f.get('status'),
              sortOrder: Number(f.get('sortOrder') ?? 0) || 0,
              interestFormEnabled: flags.interest,
              published: flags.published,
            })
          }
        >
          <TextField label="Name" name="name" defaultValue={current?.name ?? ''} maxLength={80} error={a.err('name')} />
          <TextField
            label="Address"
            name="slug"
            defaultValue={current?.slug ?? ''}
            maxLength={80}
            error={a.err('slug')}
          />
          <TextField
            label="Tagline"
            name="tagline"
            defaultValue={current?.tagline ?? ''}
            maxLength={160}
            error={a.err('tagline')}
          />
          <TextareaField
            label="Description"
            name="description"
            rows={4}
            defaultValue={current?.description ?? ''}
            maxLength={5000}
            error={a.err('description')}
          />
          <SelectField
            label="Status"
            name="status"
            defaultValue={current?.status ?? 'in_development'}
            error={a.err('status')}
          >
            {PRODUCT_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
          <CheckItem checked={flags.interest} onChange={(e) => setFlags({ ...flags, interest: e.target.checked })}>
            Offer the 'keep me posted' form
          </CheckItem>
          <CheckItem checked={flags.published} onChange={(e) => setFlags({ ...flags, published: e.target.checked })}>
            Show on the website
          </CheckItem>
        </FormSheet>
      ) : null}
    </div>
  );
}
