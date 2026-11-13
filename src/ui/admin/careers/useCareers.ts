/**
 * Logic of the Careers admin islands (R6.2 group 4), carried over unchanged from the pre-redesign CareersAdmin: the posting save
 * body (salary only when set, list fields from lines, select options trimmed), posting status actions, the applicant pipeline
 * (move, bulk reject), the applicant panel (stage, rating, notes, email, erase) and the email templates.
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';
import { effectiveSlug, lines, splitCsv } from '../website/lib';

export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
export const PIPELINE = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'] as const;
export const stageOptions = PIPELINE.map((s) => ({ value: s, label: STATUS_LABELS[s] as string }));

export interface Question {
  id: string;
  label: string;
  type: 'short_text' | 'long_text' | 'yes_no' | 'select';
  required: boolean;
  options?: string[];
}

export interface PostingFormValues {
  id?: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship' | 'attachment';
  workplace: 'onsite' | 'hybrid' | 'remote';
  salaryMinMinor: number | null;
  salaryMaxMinor: number | null;
  salaryCurrency: string | null;
  salaryPeriod: 'hour' | 'month' | 'year' | null;
  showSalary: boolean;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHaves: string[];
  offer: string[];
  howToApply: string | null;
  questions: Question[];
  opensAt: string | null;
  closesAt: string | null;
}

export type ListText = Record<'responsibilities' | 'requirements' | 'niceToHaves' | 'offer', string>;

export const blankQuestion = (): Question => ({
  id: `q${Date.now().toString(36)}`,
  label: '',
  type: 'short_text',
  required: false,
});

/** The body sent for a posting, shaped exactly as the pre-redesign editor did. */
export function postingBody(v: PostingFormValues, listText: ListText, slugTouched: boolean, salaryCurrency: string) {
  const { id: _id, ...rest } = v;
  const hasSalary = v.salaryMinMinor != null || v.salaryMaxMinor != null;
  return {
    ...rest,
    slug: effectiveSlug(v.slug, slugTouched, v.title),
    salaryCurrency: hasSalary ? salaryCurrency : null,
    salaryPeriod: hasSalary ? (v.salaryPeriod ?? 'month') : null,
    responsibilities: lines(listText.responsibilities),
    requirements: lines(listText.requirements),
    niceToHaves: lines(listText.niceToHaves),
    offer: lines(listText.offer),
    questions: v.questions.map((q) => ({
      ...q,
      ...(q.type === 'select' ? { options: (q.options ?? []).filter(Boolean) } : { options: undefined }),
    })),
  };
}

export function usePostingSave(id?: string) {
  const a = useAdminAction();
  const save = (body: unknown) =>
    a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/careers/postings/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/careers/${id}?saved=1`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/careers/postings', { body });
        window.location.assign(`/admin/careers/${res.data.id}?saved=1`);
      }
    });
  return { ...a, save };
}

export type PostingStatus = 'draft' | 'open' | 'closed' | 'archived';

/** Status actions available for a posting in each state. */
export const postingOptions = (status: PostingStatus): PostingStatus[] =>
  status === 'draft'
    ? ['open', 'archived']
    : status === 'open'
      ? ['closed']
      : status === 'closed'
        ? ['open', 'archived']
        : ['draft'];

export const postingActionLabel = (status: PostingStatus): Record<PostingStatus, string> => ({
  open: status === 'closed' ? 'Reopen' : 'Open for applications',
  closed: 'Close posting',
  archived: 'Archive posting',
  draft: 'Restore as draft',
});

export const postingActionHelp: Record<PostingStatus, string> = {
  open: 'It appears on /careers (from its opening time) and accepts applications until it closes.',
  closed: 'It stops accepting applications. Applicants are kept for the retention period.',
  archived: 'It disappears from the website.',
  draft: 'It becomes an editable draft again.',
};

export function usePostingActions(id: string) {
  const a = useAdminAction();
  const post = (path: string, body: unknown) =>
    a.run(async () => {
      const res = await apiFetch<{ data?: { id?: string } }>(`/api/v1/admin/careers/postings/${id}/${path}`, { body });
      window.location.assign(res.data?.id ? `/admin/careers/${res.data.id}?saved=1` : `/admin/careers/${id}`);
    });
  return { ...a, post };
}

export interface ApplicantCard {
  id: string;
  reference: string;
  name: string;
  posting: string | null;
  status: string;
  rating: number | null;
  tags: string[];
  assignee: string | null;
  createdAt: string;
  erased: boolean;
}

export function usePipeline() {
  const a = useAdminAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const move = (id: string, to: string) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/careers/applications/${id}`, { method: 'PATCH', body: { status: to } });
      setStatus(`Moved to ${STATUS_LABELS[to]}.`);
      reload();
    });
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  const reject = (sendRegret: boolean) =>
    a.run(async () => {
      await apiFetch('/api/v1/admin/careers/applications/reject', { body: { ids: selected, sendRegret } });
      reload();
    });
  return { ...a, selected, toggle, status, move, reject };
}

export const TEMPLATE_OPTIONS = [
  { value: 'received', label: 'Application received' },
  { value: 'interview', label: 'Interview invitation' },
  { value: 'regret', label: 'Regret (not progressing)' },
  { value: 'offer', label: 'Offer' },
];

export interface EmailDraft {
  template: string;
  subject: string;
  body: string;
}

export function useApplicant(
  id: string,
  init: { status: string; rating: number | null; tags: string[]; assignedTo: string | null },
) {
  const a = useAdminAction();
  const [v, setV] = useState({
    status: init.status,
    rating: init.rating,
    tags: init.tags.join(', '),
    assignedTo: init.assignedTo ?? '',
  });
  const [note, setNote] = useState('');
  const [email, setEmail] = useState<EmailDraft | null>(null);
  const api = `/api/v1/admin/careers/applications/${id}`;
  const save = () =>
    a.run(async () => {
      await apiFetch(api, {
        method: 'PATCH',
        body: { status: v.status, rating: v.rating, tags: splitCsv(v.tags), assignedTo: v.assignedTo || null },
      });
      reload();
    });
  const addNote = () =>
    a.run(async () => {
      await apiFetch(`${api}/notes`, { body: { body: note } });
      reload();
    });
  const openEmail = (template: string) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { subject: string; body: string } }>(
        `${api}/email-draft?template=${template}`,
      );
      setEmail({ template, ...res.data });
    });
  const sendEmail = (f: FormData) =>
    a.run(async () => {
      if (!email) return;
      await apiFetch(`${api}/email`, {
        body: { template: email.template, subject: f.get('subject'), body: f.get('body') },
      });
      reload();
    });
  const erase = () =>
    a.run(async () => {
      await apiFetch(`${api}/erase`, { body: {} });
      reload();
    });
  return { ...a, v, setV, note, setNote, email, setEmail, save, addNote, openEmail, sendEmail, erase };
}

export type CandidateTemplates = Record<
  'received' | 'interview' | 'regret' | 'offer',
  { subject: string; body: string }
>;

export function useTemplates(initial: CandidateTemplates) {
  const a = useAdminAction();
  const [t, setT] = useState(initial);
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(false);
    return a.run(async () => {
      await apiFetch('/api/v1/admin/careers/templates', { method: 'PUT', body: t });
      setSaved(true);
    });
  };
  return { ...a, t, setT, saved, save };
}
