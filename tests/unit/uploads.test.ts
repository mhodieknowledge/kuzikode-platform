import { describe, expect, it } from 'vitest';
import { imageSize, safeFilename, sniff, UploadRejected, validateUpload } from '../../src/server/lib/uploads';
import { docx, exe, jpeg, pdf, png, svg, text, xlsx, zip } from '../helpers/file-fixtures';

describe('sniff', () => {
  it('identifies allowed types by content', () => {
    expect(sniff(png())).toBe('png');
    expect(sniff(jpeg())).toBe('jpeg');
    expect(sniff(pdf())).toBe('pdf');
    expect(sniff(docx())).toBe('docx');
    expect(sniff(xlsx())).toBe('xlsx');
    expect(sniff(zip(['a.txt']))).toBe('zip');
    expect(sniff(text())).toBe('txt');
  });

  it('never accepts SVG/HTML or binaries as text', () => {
    expect(sniff(svg())).toBeNull();
    expect(sniff(new TextEncoder().encode('<!doctype html><script>x</script>'))).toBeNull();
    expect(sniff(exe())).toBeNull();
  });
});

describe('validateUpload', () => {
  it('accepts matching content and extension', () => {
    expect(validateUpload(png(), 'logo.PNG', 'image')).toMatchObject({ type: 'png', mime: 'image/png' });
    expect(validateUpload(docx(), 'CV.docx', 'cv').type).toBe('docx');
    expect(validateUpload(text(), 'export.csv', 'document').mime).toBe('text/csv; charset=utf-8');
  });

  it.each([
    ['spoofed extension: PNG named .pdf', png(), 'file.pdf', 'document'],
    ['executable renamed .pdf', exe(), 'invoice.pdf', 'document'],
    ['SVG by extension', svg(), 'logo.svg', 'image'],
    ['SVG content named .png', svg(), 'logo.png', 'image'],
    ['PDF where only images allowed', pdf(), 'x.pdf', 'image'],
    ['ZIP disguised as .docx', zip(['a.txt']), 'cv.docx', 'cv'],
    ['unknown extension', text(), 'run.sh', 'document'],
    ['no extension', png(), 'image', 'image'],
  ] as const)('rejects %s', (_label, bytes, name, purpose) => {
    expect(() => validateUpload(bytes, name, purpose)).toThrow(UploadRejected);
  });

  it('enforces size limits per purpose', () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(png());
    expect(() => validateUpload(big, 'x.png', 'image')).toThrow(/5 MB/);
    expect(() => validateUpload(new Uint8Array(0), 'x.png', 'image')).toThrow(/empty/);
  });

  it('cleans filenames', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\me\\My <CV>.pdf')).toBe('My _CV_.pdf');
  });
});

describe('imageSize', () => {
  it('reads PNG and JPEG dimensions', () => {
    expect(imageSize(png(1200, 630), 'png')).toEqual({ width: 1200, height: 630 });
    expect(imageSize(jpeg(640, 480), 'jpeg')).toEqual({ width: 640, height: 480 });
  });
});
