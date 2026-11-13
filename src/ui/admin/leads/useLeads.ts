/**
 * Lead pipeline logic (R6.2), carried over unchanged from the pre-R6.2 LeadsAdmin island: the create / edit request body,
 * activity logging, completing a follow-up and converting a lead into a client. The server validates and authorises all.
 */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export interface StaffOption {
  id: string;
  name: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';

export interface LeadFormValues {
  id?: string;
  title: string;
  source: 'website' | 'referral' | 'manual' | 'social' | 'other';
  status: LeadStatus;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  assignedTo: string | null;
  estimatedValueMinor: number | null;
  currency: string | null;
  nextFollowUpOn: string | null;
  lostReason: string | null;
  notes: string | null;
  serviceIds: string[];
}

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];
export const LEAD_SOURCE_OPTIONS = [
  { value: 'manual', label: 'Added by staff' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Other' },
];
export const ACTIVITY_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow_up', label: 'Follow-up reminder' },
];

/** The lead API body from the form's fields and the controlled state (unchanged field names). */
export function leadBody(
  f: FormData,
  s: { status: LeadStatus; value: number | null; currency: string; serviceIds: string[] },
) {
  return {
    title: f.get('title'),
    source: f.get('source'),
    status: s.status,
    contactName: f.get('contactName'),
    email: f.get('email'),
    phone: f.get('phone'),
    organisation: f.get('organisation'),
    assignedTo: f.get('assignedTo') || null,
    estimatedValueMinor: s.value,
    currency: s.value != null ? s.currency : null,
    nextFollowUpOn: f.get('nextFollowUpOn') || null,
    lostReason: s.status === 'lost' ? f.get('lostReason') : undefined,
    notes: f.get('notes'),
    serviceIds: s.serviceIds,
  };
}

export function useLeadSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (body: ReturnType<typeof leadBody>) =>
    a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/leads/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/leads/${id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/leads', { body });
        window.location.assign(`/admin/leads/${res.data.id}`);
      }
    });
  return { ...a, save };
}

export function useLeadActivity(leadId: string) {
  const a = useAdminAction();
  const log = (type: string, body: FormDataEntryValue | null, dueOn: string) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/leads/${leadId}/activities`, {
        body: { type, body, ...(type === 'follow_up' && dueOn ? { dueOn } : {}) },
      });
      reload();
    });
  const complete = (activityId: string) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/leads/${leadId}/activities/${activityId}/complete`, { body: {} });
      reload();
    });
  const convert = () =>
    a.run(async () => {
      const res = await apiFetch<{ data: { clientId: string } }>(`/api/v1/admin/leads/${leadId}/convert`, { body: {} });
      window.location.assign(`/admin/clients/${res.data.clientId}`);
    });
  return { ...a, log, complete, convert };
}
