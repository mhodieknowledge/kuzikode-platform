/**
 * Upload validation (docs/07 §7): allow-list by extension AND content (magic bytes). No SVG from users.
 */

export type DetectedType = 'png' | 'jpeg' | 'webp' | 'avif' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'zip' | 'txt' | 'csv';

export const MIME: Record<DetectedType, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

const EXTENSIONS: Record<string, DetectedType> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  zip: 'zip',
  txt: 'txt',
  csv: 'csv',
};

export const IMAGE_TYPES: DetectedType[] = ['png', 'jpeg', 'webp', 'avif'];

export type UploadPurpose = 'image' | 'document' | 'deliverable' | 'cv' | 'receipt';

const MB = 1024 * 1024;
export const PURPOSES: Record<UploadPurpose, { types: DetectedType[]; maxBytes: number }> = {
  image: { types: IMAGE_TYPES, maxBytes: 5 * MB },
  document: { types: [...IMAGE_TYPES, 'pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'], maxBytes: 10 * MB },
  deliverable: { types: [...IMAGE_TYPES, 'pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'zip'], maxBytes: 10 * MB },
  cv: { types: ['pdf', 'docx'], maxBytes: 5 * MB },
  receipt: { types: [...IMAGE_TYPES, 'pdf'], maxBytes: 10 * MB },
};

export class UploadRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadRejected';
  }
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));

/** Names of entries in a ZIP's central directory (enough to tell OOXML documents apart). */
function zipEntryNames(b: Uint8Array): string[] {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const names: string[] = [];
  for (let n = 0; n < count && p + 46 <= b.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    names.push(ascii(b, p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function looksLikeText(b: Uint8Array): boolean {
  const sample = b.subarray(0, 64 * 1024);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(
      sample.length < b.length ? sample.subarray(0, sample.length - 4) : sample,
    );
    return true;
  } catch {
    return false;
  }
}

/** Identifies a file from its bytes. Returns null when the content isn't an allowed type. */
export function sniff(b: Uint8Array): DetectedType | 'zip-ooxml-unknown' | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp';
  if (ascii(b, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(b, 8, 12))) return 'avif';
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) {
    const names = zipEntryNames(b);
    if (names.includes('[Content_Types].xml')) {
      if (names.some((n) => n.startsWith('word/'))) return 'docx';
      if (names.some((n) => n.startsWith('xl/'))) return 'xlsx';
      if (names.some((n) => n.startsWith('ppt/'))) return 'pptx';
      return 'zip-ooxml-unknown';
    }
    return 'zip';
  }
  const head = ascii(b, 0, 512).trimStart().toLowerCase();
  if (
    head.startsWith('<svg') ||
    head.startsWith('<?xml') ||
    head.includes('<svg') ||
    head.startsWith('<!doctype') ||
    head.startsWith('<html')
  ) {
    return null;
  }
  if (looksLikeText(b)) return 'txt';
  return null;
}

export function extensionOf(filename: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(filename);
  return m ? m[1]!.toLowerCase() : '';
}

/** Cleans a user-supplied filename for storage/display (never used as an R2 key). */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .replace(/[^\w.\- ()]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'file';
}

export interface ValidatedUpload {
  type: DetectedType;
  mime: string;
  filename: string;
  size: number;
}

export function validateUpload(bytes: Uint8Array, filename: string, purpose: UploadPurpose): ValidatedUpload {
  const rules = PURPOSES[purpose];
  if (bytes.length === 0) throw new UploadRejected('The file is empty.');
  if (bytes.length > rules.maxBytes)
    throw new UploadRejected(`Files must be ${Math.round(rules.maxBytes / MB)} MB or smaller.`);
  const ext = extensionOf(filename);
  if (ext === 'svg' || ext === 'svgz')
    throw new UploadRejected('SVG files are not accepted. Upload a PNG, JPEG or WebP instead.');
  const declared = EXTENSIONS[ext];
  if (!declared) throw new UploadRejected('This file type is not accepted.');
  const detected = sniff(bytes);
  const matches =
    detected === declared ||
    (declared === 'csv' && detected === 'txt') ||
    (declared === 'zip' && detected === 'zip-ooxml-unknown');
  if (!matches) throw new UploadRejected('The file content does not match its extension.');
  if (!rules.types.includes(declared)) throw new UploadRejected('This file type is not accepted here.');
  return { type: declared, mime: MIME[declared], filename: safeFilename(filename), size: bytes.length };
}

/** Pixel dimensions for PNG, JPEG and WebP (null when unknown, e.g. AVIF). */
export function imageSize(b: Uint8Array, type: DetectedType): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (type === 'png') return { width: view.getUint32(16), height: view.getUint32(20) };
    if (type === 'webp') {
      const chunk = ascii(b, 12, 16);
      if (chunk === 'VP8X')
        return { width: 1 + (view.getUint32(24, true) & 0xffffff), height: 1 + (view.getUint32(27, true) & 0xffffff) };
      if (chunk === 'VP8 ')
        return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (chunk === 'VP8L') {
        const bits = view.getUint32(21, true);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    if (type === 'jpeg') {
      let p = 2;
      while (p + 9 < b.length) {
        if (b[p] !== 0xff) return null;
        const marker = b[p + 1]!;
        const len = view.getUint16(p + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: view.getUint16(p + 5), width: view.getUint16(p + 7) };
        }
        p += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}
