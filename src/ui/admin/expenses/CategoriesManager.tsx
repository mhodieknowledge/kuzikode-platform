/** Expense categories (R6.2): list rows with edit / delete (unused only) and a sheet for new and edited categories. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSheet } from '../form';
import { useCategories, type ExpenseCategory } from './useExpenses';

export function CategoriesManager({ categories, canManage }: { categories: ExpenseCategory[]; canManage: boolean }) {
  const a = useCategories();
  const [editing, setEditing] = useState<ExpenseCategory | 'new' | null>(null);
  const [active, setActive] = useState(true);
  const open = (c: ExpenseCategory | 'new') => {
    setActive(c === 'new' ? true : c.active === 1);
    setEditing(c);
  };
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="kz-astack">
      {canManage ? (
        <div>
          <Button lead="add" onClick={() => open('new')}>
            New category
          </Button>
        </div>
      ) : null}
      {editing ? null : <FormAlert message={a.error} />}
      <section className="kz-apane" aria-label="Categories">
        <ul className="kz-alist">
          {categories.map((c) => (
            <li key={c.id}>
              <div className="kz-alist__main">
                <span className="kz-alist__t">
                  {c.name}
                  {c.active ? '' : ' (inactive)'}
                </span>
                <span className="kz-alist__m">
                  {c.description ? `${c.description} · ` : ''}
                  {c.used} {c.used === 1 ? 'expense' : 'expenses'}
                </span>
              </div>
              {canManage ? (
                <div className="kz-arow-acts">
                  <Button size="sm" variant="secondary" onClick={() => open(c)}>
                    Edit
                  </Button>
                  {c.used === 0 ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => void a.remove(c)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <FormSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? `Edit ${current.name}` : 'New category'}
        formId="exp-cat"
        submitLabel="Save"
        busy={a.busy}
        error={a.error}
        onSubmit={(f) => void a.save(current, { name: f.get('name'), description: f.get('description'), active })}
      >
        <TextField
          label="Name"
          name="name"
          key={current?.id ?? 'new'}
          defaultValue={current?.name ?? ''}
          maxLength={80}
          error={a.err('name')}
        />
        <TextField
          label="Description"
          name="description"
          key={`d${current?.id ?? 'new'}`}
          defaultValue={current?.description ?? ''}
          maxLength={300}
          error={a.err('description')}
        />
        <CheckItem checked={active} onChange={(e) => setActive(e.target.checked)}>
          Active (can be chosen for new expenses)
        </CheckItem>
      </FormSheet>
    </div>
  );
}
