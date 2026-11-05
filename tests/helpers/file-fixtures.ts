/** Minimal byte fixtures for upload tests (no binary files committed). */
const enc = new TextEncoder();

export function png(width = 2, height = 3): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

export function jpeg(width = 640, height = 480): Uint8Array<ArrayBuffer> {
  // SOI, APP0 (len 16), SOF0 (len 17)
  const b = new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0,
    16,
    ...new Array(14).fill(0),
    0xff,
    0xc0,
    0,
    17,
    8,
    0,
    0,
    0,
    0,
    3,
    ...new Array(12).fill(0),
  ]);
  const v = new DataView(b.buffer);
  v.setUint16(25, height);
  v.setUint16(27, width);
  return b;
}

export const pdf = (): Uint8Array<ArrayBuffer> =>
  enc.encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n') as Uint8Array<ArrayBuffer>;
export const svg = (): Uint8Array<ArrayBuffer> =>
  enc.encode(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>',
  ) as Uint8Array<ArrayBuffer>;
export const exe = (): Uint8Array<ArrayBuffer> =>
  new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);
export const text = (s = 'name,amount\nA,1\n'): Uint8Array<ArrayBuffer> => enc.encode(s) as Uint8Array<ArrayBuffer>;

/** Stored (uncompressed) ZIP with the given entry names and empty contents. */
export function zip(names: string[]): Uint8Array<ArrayBuffer> {
  const parts: number[] = [];
  const central: number[] = [];
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  for (const name of names) {
    const nb = [...enc.encode(name)];
    const offset = parts.length;
    parts.push(
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(0),
      ...u32(0),
      ...u16(nb.length),
      ...u16(0),
      ...nb,
    );
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(0),
      ...u32(0),
      ...u16(nb.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nb,
    );
  }
  const cdOffset = parts.length;
  const out = [
    ...parts,
    ...central,
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(names.length),
    ...u16(names.length),
    ...u32(central.length),
    ...u32(cdOffset),
    ...u16(0),
  ];
  return new Uint8Array(out);
}

export const docx = () => zip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
export const xlsx = () => zip(['[Content_Types].xml', 'xl/workbook.xml']);
