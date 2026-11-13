import { describe, expect, it } from 'vitest';
import {
  fileSize,
  milestoneMeta,
  PROJECT_ACTION_LABEL,
  PROJECT_STATUS_TONE,
  taskMeta,
} from '../../src/ui/admin/projects/labels';
import { PROJECT_STATUSES } from '../../src/shared/projects';
import { SUPPORT_STATUSES } from '../../src/shared/support';
import { billingLabel, workLabel } from '../../src/ui/admin/time/labels';
import { toMinutes } from '../../src/ui/admin/time/useTime';
import { isUrgent, messageKind, SUPPORT_TONE } from '../../src/ui/admin/support/labels';
import { dayOrNever, roleNames, rolesChanged, stampOrNever, STAFF_STATUS_TONE } from '../../src/ui/admin/users/labels';
import { percentToBp, sectionBody } from '../../src/ui/admin/settings/useSettings';
import { logoProblem } from '../../src/ui/admin/settings/LogoUploader';

describe('projects (R6.2 group 3)', () => {
  it('has a tone for every status', () => {
    for (const s of PROJECT_STATUSES) expect(PROJECT_STATUS_TONE[s], s).toBeDefined();
  });
  it('labels audit actions and falls back to the key through the caller', () => {
    expect(PROJECT_ACTION_LABEL['project.task_moved']).toBe('Task moved');
  });
  it('formats file sizes', () => {
    expect(fileSize(10)).toBe('1 KB');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
  it('words task and milestone meta lines', () => {
    expect(taskMeta({ assignee_name: null, due_date: null, priority: 'normal' }, undefined)).toBe('Unassigned');
    expect(taskMeta({ assignee_name: 'Tino', due_date: '2026-01-05', priority: 'high' }, 'Design')).toBe(
      'Tino · due 2026-01-05 · high · Design',
    );
    expect(milestoneMeta({ due_date: null, client_visible: 0, invoice_number: null })).toBe('No due date · internal');
    expect(milestoneMeta({ due_date: '2026-02-01', client_visible: 1, invoice_number: 'INV-1' })).toBe(
      'Due 2026-02-01 · visible to the client · INV-1',
    );
  });
});

describe('time (R6.2 group 3)', () => {
  it('words work and billing', () => {
    expect(workLabel({ task_title: null, description: null })).toBe('Project work');
    expect(workLabel({ task_title: 'Import', description: 'Catalogue' })).toBe('Import: Catalogue');
    expect(workLabel({ task_title: null, description: 'Call' })).toBe('Call');
    expect(billingLabel({ invoice_id: 'i', invoice_number: null, billable: 1 })).toBe('Billed · draft');
    expect(billingLabel({ invoice_id: 'i', invoice_number: 'INV-9', billable: 1 })).toBe('Billed · INV-9');
    expect(billingLabel({ invoice_id: null, invoice_number: null, billable: 1 })).toBe('Unbilled');
    expect(billingLabel({ invoice_id: null, invoice_number: null, billable: 0 })).toBe('Not billable');
  });
  it('turns hours and minutes into whole minutes', () => {
    expect(toMinutes('1', '30')).toBe(90);
    expect(toMinutes('', '45')).toBe(45);
    expect(toMinutes('0.5', '')).toBe(30);
  });
});

describe('support (R6.2 group 3)', () => {
  it('has a tone for every status and flags high and urgent only', () => {
    for (const s of SUPPORT_STATUSES) expect(SUPPORT_TONE[s], s).toBeDefined();
    expect(isUrgent('urgent')).toBe(true);
    expect(isUrgent('high')).toBe(true);
    expect(isUrgent('normal')).toBe(false);
  });
  it('tells notes, client and staff messages apart', () => {
    expect(messageKind({ is_internal_note: 1, user_type: 'staff' })).toBe('note');
    expect(messageKind({ is_internal_note: 0, user_type: 'client' })).toBe('client');
    expect(messageKind({ is_internal_note: 0, user_type: 'staff' })).toBe('staff');
  });
});

describe('users (R6.2 group 3)', () => {
  it('has a tone per status', () => {
    expect(Object.keys(STAFF_STATUS_TONE).sort()).toEqual(['active', 'disabled', 'invited']);
  });
  it('detects role changes regardless of order', () => {
    expect(rolesChanged(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(rolesChanged(['a'], ['a', 'b'])).toBe(true);
  });
  it('words roles and dates', () => {
    expect(roleNames(['x', 'y'], new Map([['x', 'Xylo']]))).toBe('Xylo, y');
    expect(roleNames([], new Map())).toBe('—');
    expect(dayOrNever(null)).toBe('Never');
    expect(stampOrNever(null)).toBe('Never');
    expect(dayOrNever('2026-03-05T10:00:00Z')).toContain('2026');
  });
});

describe('settings (R6.2 group 3)', () => {
  it('parses a tax percentage to basis points', () => {
    expect(percentToBp('2.5')).toBe(250);
    expect(percentToBp('15,5')).toBe(1550);
    expect(percentToBp('abc')).toBe(-1);
  });
  it('builds a section body by field type', () => {
    const f = new FormData();
    f.set('a', 'x');
    f.set('n', '7');
    const body = sectionBody(
      [
        { key: 'a', type: 'text' },
        { key: 'n', type: 'int' },
        { key: 'b', type: 'bool' },
      ],
      f,
      { b: true },
    );
    expect(body).toEqual({ a: 'x', n: 7, b: true });
  });
  it('pre-checks the logo file', () => {
    expect(logoProblem({ name: 'logo.png', size: 1000 })).toBeNull();
    expect(logoProblem({ name: 'logo.gif', size: 1000 })).toMatch(/Choose a/);
    expect(logoProblem({ name: 'logo.webp', size: 3 * 1024 * 1024 })).toMatch(/2 MB/);
  });
});
