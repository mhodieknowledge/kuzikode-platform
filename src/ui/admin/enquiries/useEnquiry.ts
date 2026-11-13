/** Enquiry actions (R6.2), logic carried over unchanged from the pre-R6.2 EnquiryActions island. */
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

export type EnquiryStatus = 'new' | 'triaged' | 'spam' | 'closed';

export function useEnquiryActions(enquiryId: string) {
  const a = useAdminAction();
  const setStatus = (next: 'new' | 'spam' | 'closed') =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/enquiries/${enquiryId}/status`, { body: { status: next } });
      reload();
    });
  const createLead = (assignedTo: string) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { leadId: string } }>(`/api/v1/admin/enquiries/${enquiryId}/lead`, {
        body: { assignedTo: assignedTo || null },
      });
      window.location.assign(`/admin/leads/${res.data.leadId}`);
    });
  return { ...a, setStatus, createLead };
}
