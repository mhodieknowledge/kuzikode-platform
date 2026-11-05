/** JSON for an inline `<script type="application/ld+json">`: escapes `<` and the U+2028/U+2029 separators. */
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(LS, '\\u2028').replace(PS, '\\u2029');
}
