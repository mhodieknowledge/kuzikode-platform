import { describe, expect, it } from 'vitest';
import { htmlToText, sanitizeHtml } from '../../src/server/lib/html-sanitize';

const XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<svg onload=alert(1)><circle/></svg>',
  '<iframe src="https://evil.example"></iframe>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<div onmouseover="alert(1)">hover</div>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<form action="https://evil.example"><input name=x></form>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<img src="http://insecure.example/a.png">',
  '<p><object data="x.swf"></object></p>',
  '<base href="https://evil.example/">',
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
];

describe('sanitizeHtml', () => {
  it.each(XSS)('neutralises %s', (payload) => {
    const out = sanitizeHtml(payload).toLowerCase();
    expect(out).not.toMatch(
      /<script|onerror|onload|onmouseover|javascript:|vbscript:|data:text|<iframe|<svg|<object|<form|<input|style=|<base|<meta/,
    );
  });

  it('keeps allowed formatting and safe links', () => {
    const html =
      '<h2>Payments</h2><p>Pay with <strong>EcoCash</strong> or <em>card</em>. <a href="https://www.paynow.co.zw">Paynow</a> · <a href="/contact">Contact</a> · <a href="mailto:hello@example.com">Email</a></p><ul><li>One</li></ul>';
    const out = sanitizeHtml(html);
    expect(out).toContain('<h2>Payments</h2>');
    expect(out).toContain('<strong>EcoCash</strong>');
    expect(out).toContain('<a href="https://www.paynow.co.zw" rel="noopener noreferrer nofollow">Paynow</a>');
    expect(out).toContain('<a href="/contact">Contact</a>');
    expect(out).toContain('<a href="mailto:hello@example.com">');
    expect(out).toContain('<ul><li>One</li></ul>');
  });

  it('unwraps unknown tags but keeps their text, and drops attributes', () => {
    expect(sanitizeHtml('<div class="x"><span id="y">Hello</span> world</div>')).toBe('Hello world');
    expect(sanitizeHtml('<p class="lead" data-x="1">Hi</p>')).toBe('<p>Hi</p>');
  });

  it('escapes stray markup characters in text', () => {
    expect(sanitizeHtml('<p>5 > 3 & 2 < 4</p>')).toBe('<p>5 &gt; 3 &amp; 2 &lt; 4</p>');
  });

  it('adds empty alt and lazy loading to https images', () => {
    expect(sanitizeHtml('<img src="https://cdn.example/a.png">')).toBe(
      '<img src="https://cdn.example/a.png" alt="" loading="lazy">',
    );
  });

  it('extracts text', () => {
    expect(htmlToText('<h2>Title</h2><p>One &amp; two</p><script>x</script>')).toBe('Title One & two');
  });
});
