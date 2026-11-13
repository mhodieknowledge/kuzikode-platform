import { describe, expect, it } from 'vitest';
import { splitForPhone, workspaceItems } from '../../src/ui/workspace/nav';

const all = { projects: true, quotations: true, finance: true, support: true };

describe('workspace navigation', () => {
  it('lists every area in dock order, account last', () => {
    expect(workspaceItems(all).map((i) => i.key)).toEqual([
      'overview',
      'projects',
      'quotations',
      'invoices',
      'payments',
      'services',
      'support',
      'account',
    ]);
  });

  it('leaves out areas the role cannot see', () => {
    const keys = workspaceItems({ projects: false, quotations: false, finance: true, support: false }).map(
      (i) => i.key,
    );
    expect(keys).toEqual(['overview', 'invoices', 'payments', 'services', 'account']);
  });

  it('puts four destinations in the phone dock and the rest (with account) in More', () => {
    const { dock, more } = splitForPhone(workspaceItems(all));
    expect(dock.map((i) => i.key)).toEqual(['overview', 'projects', 'invoices', 'support']);
    expect(more.map((i) => i.key)).toEqual(['quotations', 'payments', 'services', 'account']);
  });

  it('fills the phone dock from what exists when areas are missing', () => {
    const { dock, more } = splitForPhone(
      workspaceItems({ projects: false, quotations: true, finance: false, support: true }),
    );
    expect(dock.map((i) => i.key)).toEqual(['overview', 'support', 'quotations']);
    expect(more.map((i) => i.key)).toEqual(['account']);
  });
});
