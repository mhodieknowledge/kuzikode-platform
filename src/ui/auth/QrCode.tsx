import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/**
 * QR code drawn as an SVG path in our own page (no external chart service; docs/07 2FA enrolment). Error correction M, a
 * 4-module quiet zone, always dark on white so every authenticator app reads it (also on the dark workspace theme).
 */
export function QrCode({ value, size = 184, label }: { value: string; size?: number; label: string }) {
  const { path, modules } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { path: d, modules: n + 8 };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      className="kz-qr"
    >
      <rect width={modules} height={modules} fill="#fff" />
      <path d={path} fill="#141412" />
    </svg>
  );
}
