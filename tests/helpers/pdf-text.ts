/**
 * Minimal text extraction for PDFs written by pdf-lib with standard fonts: inflates every FlateDecode stream and
 * decodes the hex strings drawn with `Tj`. Good enough to assert what a document says; not a general PDF parser.
 * Works in Node and workerd (DecompressionStream).
 */
const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

// WinAnsi bytes 0x80–0x9f that differ from Latin-1.
const WINANSI: Record<number, string> = {
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x85: '…',
};

/** All text drawn in the PDF, one `Tj` per line, in drawing order. */
export async function pdfText(pdf: Uint8Array): Promise<string> {
  const raw = latin1(pdf);
  const out: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    let stop = end;
    if (raw[stop - 1] === '\n') stop--;
    if (raw[stop - 1] === '\r') stop--;
    const inflated = await inflate(pdf.subarray(start, stop));
    re.lastIndex = end + 'endstream'.length;
    if (!inflated) continue;
    const content = latin1(inflated);
    for (const t of content.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
      const hex = t[1]!;
      let s = '';
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        s += WINANSI[code] ?? String.fromCharCode(code);
      }
      out.push(s);
    }
  }
  return out.join('\n');
}

export const isPdf = (b: Uint8Array) => latin1(b.subarray(0, 5)) === '%PDF-';
