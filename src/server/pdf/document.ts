/**
 * One renderer for every financial document (quotation, invoice, receipt, credit note). The per-document builders in
 * this folder map stored rows + frozen snapshots to a `DocumentModel`; nothing here reads the database or computes
 * money: all amounts arrive as already-formatted strings from stored minor units.
 */
import type { PDFImage } from 'pdf-lib';
import { COLOURS, CONTENT_WIDTH, Composer, MARGIN, hex, type Watermark } from './layout';

export type DocumentKind = 'quotation' | 'invoice' | 'receipt' | 'credit_note';

export const KIND_TITLE: Record<DocumentKind, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
  credit_note: 'Credit note',
};

export interface Party {
  label: string;
  name: string;
  lines: string[];
}

export interface Column {
  label: string;
  /** Share of the content width; the first column usually takes the rest. */
  width: number;
  align?: 'left' | 'right';
}

export interface TotalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface Section {
  heading: string;
  body: string;
}

export interface DocumentModel {
  kind: DocumentKind;
  /** Document number, or null for an unnumbered draft preview. */
  number: string | null;
  /** Optional headline under the kind label (e.g. the quotation title). */
  headline?: string | null;
  meta: { label: string; value: string }[];
  business: { name: string; lines: string[] };
  parties: Party[];
  intro?: string | null;
  table?: { caption?: string; columns: Column[]; rows: string[][] } | null;
  totals: TotalRow[];
  sections: Section[];
  footer?: string | null;
}

export interface RenderOptions {
  watermark: Watermark;
  accentColour?: string | null;
  logo?: { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null;
  createdAt: Date;
}

export async function renderDocument(model: DocumentModel, opts: RenderOptions): Promise<Uint8Array<ArrayBuffer>> {
  const title = `${KIND_TITLE[model.kind]} ${model.number ?? '(draft)'}`;
  const c = await Composer.create({
    title,
    subject: `${KIND_TITLE[model.kind]} from ${model.business.name}`,
    author: model.business.name,
    keywords: [model.kind, ...(model.number ? [model.number] : [])],
    ...(opts.accentColour ? { accent: hex(opts.accentColour) } : {}),
    watermark: opts.watermark,
    footerLeft: model.footer ?? model.business.name,
    footerRef: model.number ?? 'Draft',
    createdAt: opts.createdAt,
  });

  let logo: PDFImage | null = null;
  if (opts.logo) {
    try {
      logo =
        opts.logo.mime === 'image/png' ? await c.doc.embedPng(opts.logo.bytes) : await c.doc.embedJpg(opts.logo.bytes);
    } catch {
      logo = null; // A damaged logo must never block a financial document: fall back to the vector mark.
    }
  }

  header(c, model, logo);
  parties(c, model.parties);
  if (model.intro) {
    c.y -= 4;
    c.paragraph(model.intro, { size: 9.5, colour: COLOURS.ink800 });
  }
  if (model.table && model.table.rows.length) table(c, model.table);
  totals(c, model.totals);
  for (const s of model.sections) {
    if (!s.body.trim()) continue;
    c.heading(s.heading);
    c.paragraph(s.body, { size: 9, colour: COLOURS.ink800 });
  }
  return c.finish();
}

function header(c: Composer, m: DocumentModel, logo: PDFImage | null): void {
  const top = c.y;
  const left = MARGIN.left;
  let brandBottom = top;
  if (logo) {
    const { height } = c.image(logo, left, top, 160, 44);
    brandBottom = top - height - 8;
  } else {
    c.brandMark(left, top + 2, 30);
    c.text(m.business.name, left + 38, top + 2, { size: 13, bold: true, colour: COLOURS.ink950 });
    brandBottom = top - 34;
  }
  let y = brandBottom;
  for (const line of m.business.lines) {
    for (const l of c.wrap(line, 8.5, 230)) {
      c.text(l, left, y, { size: 8.5, colour: COLOURS.ink600 });
      y -= 12;
    }
  }

  // Right column: kind, number, headline, meta rows.
  const right = MARGIN.left + CONTENT_WIDTH;
  let ry = top;
  c.text(KIND_TITLE[m.kind].toUpperCase(), right, ry, { size: 20, bold: true, colour: COLOURS.ink950, align: 'right' });
  ry -= 26;
  c.text(m.number ?? 'Draft (not yet numbered)', right, ry, {
    size: 10.5,
    bold: true,
    colour: c.accent,
    align: 'right',
  });
  ry -= 16;
  if (m.headline) {
    for (const l of c.wrap(m.headline, 9.5, 240)) {
      c.text(l, right, ry, { size: 9.5, colour: COLOURS.ink800, align: 'right' });
      ry -= 13;
    }
  }
  ry -= 4;
  for (const row of m.meta) {
    c.text(row.value, right, ry, { size: 9, bold: true, colour: COLOURS.ink950, align: 'right' });
    c.text(row.label, right - 110, ry, { size: 9, colour: COLOURS.ink600, align: 'right' });
    ry -= 13;
  }
  c.y = Math.min(y, ry) - 18;
  c.rule();
  c.y -= 18;
}

function parties(c: Composer, list: Party[]): void {
  if (!list.length) return;
  const colWidth = (CONTENT_WIDTH - 24) / Math.max(list.length, 2);
  const top = c.y;
  let lowest = top;
  list.forEach((p, i) => {
    const x = MARGIN.left + i * (colWidth + 24);
    let y = top;
    c.text(p.label.toUpperCase(), x, y, { size: 8, bold: true, colour: COLOURS.ink600 });
    y -= 14;
    for (const l of c.wrap(p.name, 10.5, colWidth, true)) {
      c.text(l, x, y, { size: 10.5, bold: true, colour: COLOURS.ink950 });
      y -= 14;
    }
    for (const line of p.lines) {
      for (const l of c.wrap(line, 9, colWidth)) {
        c.text(l, x, y, { size: 9, colour: COLOURS.ink800 });
        y -= 12.5;
      }
    }
    lowest = Math.min(lowest, y);
  });
  c.y = lowest - 14;
}

function table(c: Composer, t: NonNullable<DocumentModel['table']>): void {
  const totalShare = t.columns.reduce((s, col) => s + col.width, 0);
  const widths = t.columns.map((col) => (col.width / totalShare) * CONTENT_WIDTH);
  const xs: number[] = [];
  widths.reduce((x, w) => (xs.push(x), x + w), MARGIN.left);
  const pad = 6;
  const size = 9;
  const leading = 12.5;

  const drawHead = () => {
    c.rect(MARGIN.left, c.y, CONTENT_WIDTH, 20, COLOURS.canvas);
    t.columns.forEach((col, i) => {
      const x = col.align === 'right' ? xs[i]! + widths[i]! - pad : xs[i]! + pad;
      c.text(col.label, x, c.y - 6, { size: 8, bold: true, colour: COLOURS.ink600, align: col.align ?? 'left' });
    });
    c.y -= 20;
  };

  c.ensure(20 + leading * 2 + 2 * pad);
  drawHead();
  c.onNewPage = () => {
    c.text(`${t.caption ?? 'Items'} (continued)`, MARGIN.left, c.y, { size: 8, colour: COLOURS.ink600 });
    c.y -= 16;
    drawHead();
  };
  for (const row of t.rows) {
    let cells = row.map((cell, i) => c.wrap(cell, size, widths[i]! - 2 * pad));
    // A row moves whole to the next page; only a row that doesn't fit on a fresh page is split line by line.
    let fresh = false;
    for (;;) {
      const height = Math.max(1, ...cells.map((l) => l.length)) * leading + 2 * pad;
      if (c.y - height >= MARGIN.bottom) {
        drawRow(cells, height);
        break;
      }
      const room = Math.floor((c.y - MARGIN.bottom - 2 * pad) / leading);
      if (fresh && room >= 1) {
        drawRow(
          cells.map((l) => l.slice(0, room)),
          room * leading + 2 * pad,
        );
        cells = cells.map((l) => l.slice(room));
      }
      c.addPage();
      c.onNewPage?.();
      fresh = true;
    }
  }
  c.onNewPage = null;

  function drawRow(cells: string[][], height: number) {
    cells.forEach((lines, i) => {
      const col = t.columns[i]!;
      const x = col.align === 'right' ? xs[i]! + widths[i]! - pad : xs[i]! + pad;
      lines.forEach((l, j) => {
        c.text(l, x, c.y - pad - j * leading, {
          size,
          colour: i === 0 ? COLOURS.ink950 : COLOURS.ink800,
          align: col.align ?? 'left',
        });
      });
    });
    c.y -= height;
    c.rule();
  }
}

function totals(c: Composer, rows: TotalRow[]): void {
  if (!rows.length) return;
  const width = 230;
  const x = MARGIN.left + CONTENT_WIDTH - width;
  const right = MARGIN.left + CONTENT_WIDTH;
  c.y -= 10;
  c.ensure(rows.length * 18 + 10);
  for (const r of rows) {
    if (r.strong) {
      c.rect(x, c.y + 3, width, 22, COLOURS.brand50);
      c.text(r.label, x + 8, c.y - 3, { size: 10.5, bold: true, colour: COLOURS.ink950 });
      c.text(r.value, right - 8, c.y - 3, { size: 10.5, bold: true, colour: COLOURS.ink950, align: 'right' });
      c.y -= 24;
    } else {
      c.text(r.label, x + 8, c.y, { size: 9, colour: COLOURS.ink600 });
      c.text(r.value, right - 8, c.y, { size: 9, colour: COLOURS.ink950, align: 'right' });
      c.y -= 16;
    }
  }
  c.y -= 6;
}
