/**
 * Server search behind the admin command palette (logic of the P4.1 palette, extracted in R6.1): from two characters, a 200 ms
 * debounced, abortable GET to /api/v1/admin/search over clients, invoices, quotations and projects.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export interface AdminSearchResult {
  kind: 'client' | 'invoice' | 'quotation' | 'project';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export const SEARCH_KIND: Record<AdminSearchResult['kind'], string> = {
  client: 'Client',
  invoice: 'Invoice',
  quotation: 'Quotation',
  project: 'Project',
};

export const MIN_TERM = 2;
const NONE: AdminSearchResult[] = [];

export function useAdminSearch(q: string) {
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const term = q.trim();
  useEffect(() => {
    if (term.length < MIN_TERM) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      apiFetch<{ data: AdminSearchResult[] }>(`/api/v1/admin/search?q=${encodeURIComponent(term)}`, {
        signal: ctl.signal,
      })
        .then((r) => setResults(r.data))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [term]);
  return { results: term.length >= MIN_TERM ? results : NONE, loading, searching: term.length >= MIN_TERM };
}
