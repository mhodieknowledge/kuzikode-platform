/**
 * PDF layout kit over pdf-lib (docs/02: pure JS, runs on workerd, standard fonts only). A `Composer` owns the pages
 * and a top-down cursor; blocks ask for vertical space and get a fresh page when they don't fit. Page furniture
 * (brand bar, footer with page numbers, TEST/DRAFT watermark) is drawn once all pages exist, so "Page x of y" is exact.
 *
 * Text is drawn with Helvetica (WinAnsi). Characters outside that set are replaced, never thrown on, because client
 * names and descriptions are free text.
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = { top: 56, bottom: 64, left: 48, right: 48 } as const;
export const CONTENT_WIDTH = A4.width - MARGIN.left - MARGIN.right;

/** docs/05 tokens. */
export const COLOURS = {
  ink950: hex('#0A0F1C'),
  ink800: hex('#1C2333'),
  ink600: hex('#475066'),
  ink400: hex('#8A93A6'),
  line: hex('#E4E7EE'),
  canvas: hex('#F7F8FA'),
  brand600: hex('#2747E8'),
  brand50: hex('#EEF1FF'),
  danger600: hex('#C2362F'),
} as const;

export function hex(value: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return rgb(0.153, 0.278, 0.91);
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export type Watermark = 'TEST' | 'DRAFT' | null;

export interface ComposerOptions {
  title: string;
  subject: string;
  author: string;
  keywords?: string[];
  accent?: RGB;
  watermark?: Watermark;
  /** Left side of the footer on every page. */
  footerLeft?: string;
  /** Repeated next to the page number, e.g. the document number. */
  footerRef?: string;
  /** Fixed creation date keeps output deterministic for a given input. */
  createdAt: Date;
}

export class Composer {
  readonly doc: PDFDocument;
  readonly fonts: Fonts;
  readonly accent: RGB;
  page!: PDFPage;
  /** Distance from the bottom of the page to the next line's top edge. */
  y = 0;
  private readonly charset: Set<number>;
  private readonly opts: ComposerOptions;
  /** Called on every new page after the first (e.g. repeat a table header). */
  onNewPage: (() => void) | null = null;

  private constructor(doc: PDFDocument, fonts: Fonts, opts: ComposerOptions) {
    this.doc = doc;
    this.fonts = fonts;
    this.opts = opts;
    this.accent = opts.accent ?? COLOURS.brand600;
    this.charset = new Set(fonts.regular.getCharacterSet());
    this.addPage();
  }

  static async create(opts: ComposerOptions): Promise<Composer> {
    const doc = await PDFDocument.create();
    doc.setTitle(opts.title, { showInWindowTitleBar: true });
    doc.setSubject(opts.subject);
    doc.setAuthor(opts.author);
    doc.setCreator('Kuzikode Platform');
    doc.setProducer('Kuzikode Platform (pdf-lib)');
    doc.setKeywords(opts.keywords ?? []);
    doc.setCreationDate(opts.createdAt);
    doc.setModificationDate(opts.createdAt);
    doc.setLanguage('en-GB');
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    return new Composer(doc, fonts, opts);
  }

  addPage(): void {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN.top;
  }

  /** Ensures `height` points fit above the bottom margin, starting a new page (and running `onNewPage`) when not. */
  ensure(height: number): boolean {
    if (this.y - height >= MARGIN.bottom) return false;
    this.addPage();
    this.onNewPage?.();
    return true;
  }

  /** Replaces characters the standard font cannot encode and normalises whitespace that would print as boxes. */
  clean(text: string): string {
    let out = '';
    for (const ch of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')) {
      const cp = ch.codePointAt(0)!;
      if (ch === '\n' || this.charset.has(cp)) out += ch;
      else if (cp === 0x00a0 || cp === 0x202f || cp === 0x2009) out += ' ';
      else if (cp === 0x2212) out += '-';
      else if (cp >= 0x300 && cp <= 0x36f)
        continue; // combining marks
      else {
        const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
        out += base && [...base].every((c) => this.charset.has(c.codePointAt(0)!)) ? base : '?';
      }
    }
    return out;
  }

  width(text: string, size: number, bold = false): number {
    return (bold ? this.fonts.bold : this.fonts.regular).widthOfTextAtSize(this.clean(text), size);
  }

  /** Greedy word wrap; long words are broken by character. Explicit newlines are kept. */
  wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const lines: string[] = [];
    for (const para of this.clean(text).split('\n')) {
      const words = para.split(/ +/).filter((w) => w.length > 0);
      if (words.length === 0) {
        lines.push('');
        continue;
      }
      let line = '';
      for (let word of words) {
        while (font.widthOfTextAtSize(word, size) > maxWidth) {
          // Break an over-long token (URLs, references) at the widest prefix that fits.
          let cut = word.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
          if (line) {
            lines.push(line);
            line = '';
          }
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Draws one line with its top edge at `top` (baseline computed from the font size). */
  text(
    text: string,
    x: number,
    top: number,
    o: { size?: number; bold?: boolean; colour?: RGB; align?: 'left' | 'right'; page?: PDFPage } = {},
  ): void {
    const size = o.size ?? 9.5;
    const font = o.bold ? this.fonts.bold : this.fonts.regular;
    const t = this.clean(text);
    const w = font.widthOfTextAtSize(t, size);
    (o.page ?? this.page).drawText(t, {
      x: o.align === 'right' ? x - w : x,
      y: top - size * 0.8,
      size,
      font,
      color: o.colour ?? COLOURS.ink800,
    });
  }

  /** Wrapped paragraph at the cursor; breaks across pages line by line. */
  paragraph(
    text: string,
    o: { size?: number; bold?: boolean; colour?: RGB; x?: number; width?: number; leading?: number } = {},
  ): void {
    const size = o.size ?? 9.5;
    const leading = o.leading ?? size * 1.45;
    const x = o.x ?? MARGIN.left;
    for (const line of this.wrap(text, size, o.width ?? CONTENT_WIDTH, o.bold)) {
      this.ensure(leading);
      if (line)
        this.text(line, x, this.y, { size, ...(o.bold ? { bold: true } : {}), colour: o.colour ?? COLOURS.ink800 });
      this.y -= leading;
    }
  }

  /** Small uppercase section label with a gap above it; keeps at least `keepWith` points of content on its page. */
  heading(label: string, keepWith = 40): void {
    this.y -= 14;
    this.ensure(14 + keepWith);
    this.text(label.toUpperCase(), MARGIN.left, this.y, { size: 8, bold: true, colour: COLOURS.ink600 });
    this.y -= 14;
  }

  rule(colour: RGB = COLOURS.line, x = MARGIN.left, width = CONTENT_WIDTH): void {
    this.page.drawLine({
      start: { x, y: this.y },
      end: { x: x + width, y: this.y },
      thickness: 0.75,
      color: colour,
    });
  }

  rect(x: number, top: number, width: number, height: number, colour: RGB): void {
    this.page.drawRectangle({ x, y: top - height, width, height, color: colour });
  }

  /** The hand-built Kuzikode mark (public/brand/logo-mark.svg, 32×32 viewBox) at `size` points. */
  brandMark(x: number, top: number, size: number): void {
    const s = size / 32;
    const at = { x, y: top, scale: s };
    this.page.drawRectangle({ x: x + 5 * s, y: top - 28 * s, width: 6.5 * s, height: 24 * s, color: COLOURS.ink950 });
    this.page.drawSvgPath('M14 14.4 22.6 4H29.2L20.6 14.4Z', { ...at, color: this.accent });
    this.page.drawSvgPath('M14 17.6H20.6L29.2 28H22.6Z', { ...at, color: COLOURS.ink950 });
  }

  image(img: PDFImage, x: number, top: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const width = img.width * scale;
    const height = img.height * scale;
    this.page.drawImage(img, { x, y: top - height, width, height });
    return { width, height };
  }

  /** Draws the brand bar, footer, page numbers and watermark on every page, then serialises. */
  async finish(): Promise<Uint8Array<ArrayBuffer>> {
    const pages = this.doc.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      page.drawRectangle({ x: 0, y: A4.height - 6, width: A4.width, height: 6, color: this.accent });
      const top = MARGIN.bottom - 22;
      page.drawLine({
        start: { x: MARGIN.left, y: top + 8 },
        end: { x: A4.width - MARGIN.right, y: top + 8 },
        thickness: 0.5,
        color: COLOURS.line,
      });
      const left = this.opts.footerLeft ? (this.wrap(this.opts.footerLeft, 7.5, CONTENT_WIDTH - 150)[0] ?? '') : '';
      if (left) this.text(left, MARGIN.left, top, { size: 7.5, colour: COLOURS.ink600, page });
      const ref = this.opts.footerRef ? `${this.opts.footerRef}  ·  ` : '';
      this.text(`${ref}Page ${i + 1} of ${total}`, A4.width - MARGIN.right, top, {
        size: 7.5,
        colour: COLOURS.ink600,
        align: 'right',
        page,
      });
      if (this.opts.watermark) this.watermark(page, this.opts.watermark);
    });
    // Copy into a plain ArrayBuffer-backed array (Response bodies and R2 puts reject SharedArrayBuffer views).
    return new Uint8Array(await this.doc.save({ useObjectStreams: true }));
  }

  private watermark(page: PDFPage, label: Exclude<Watermark, null>): void {
    const size = label === 'TEST' ? 132 : 110;
    const font = this.fonts.bold;
    const w = font.widthOfTextAtSize(label, size);
    const angle = 35;
    const rad = (angle * Math.PI) / 180;
    // Centre the rotated text on the page.
    const cx = A4.width / 2;
    const cy = A4.height / 2;
    const x = cx - (w / 2) * Math.cos(rad) + size * 0.35 * Math.sin(rad);
    const y = cy - (w / 2) * Math.sin(rad) - size * 0.35 * Math.cos(rad);
    page.drawText(label, {
      x,
      y,
      size,
      font,
      color: label === 'TEST' ? COLOURS.danger600 : COLOURS.ink400,
      opacity: 0.12,
      rotate: degrees(angle),
    });
    if (label === 'TEST') {
      const note = 'TEST DOCUMENT · NOT VALID FOR PAYMENT OR TAX PURPOSES';
      const nw = this.fonts.bold.widthOfTextAtSize(note, 7);
      page.drawText(note, {
        x: (A4.width - nw) / 2,
        y: A4.height - 20,
        size: 7,
        font: this.fonts.bold,
        color: COLOURS.danger600,
      });
    }
  }
}
