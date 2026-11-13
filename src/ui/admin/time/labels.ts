/** Time list helpers shared by the time pages and the project's Time tab (R6.2 group 3). Pure, unit-tested. */

/** "Task: description", or "Project work" when the entry has neither. */
export const workLabel = (e: { task_title: string | null; description: string | null }): string =>
  [e.task_title, e.description].filter(Boolean).join(': ') || 'Project work';

/** Billing state of an entry as the lists word it. */
export function billingLabel(e: {
  invoice_id: string | null;
  invoice_number: string | null;
  billable: number;
}): string {
  if (e.invoice_id) return `Billed${e.invoice_number ? ` · ${e.invoice_number}` : ' · draft'}`;
  return e.billable ? 'Unbilled' : 'Not billable';
}
