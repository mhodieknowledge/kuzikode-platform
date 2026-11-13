import { QrCode } from '../../auth/QrCode';
import { walletDeepLink } from '../../../shared/payment-methods';
import { LinkButton } from '../../primitives';
import { clock } from './parts';

/**
 * Wallet authorization code (e.g. InnBucks): the code large in mono, a QR drawn in our own page, the app link and the expiry.
 * Phones stack the QR over the code; wider screens set them side by side.
 */
export function WalletCode({
  code,
  expiresAt,
  methodCode,
  methodName,
}: {
  code: string;
  expiresAt: string | null;
  methodCode: string | null;
  methodName: string;
}) {
  const link = walletDeepLink(methodCode, code);
  return (
    <div className="kz-cocode">
      <div className="kz-cocode__qr">
        <QrCode value={code} size={168} label={`QR code for ${methodName} payment code ${code}`} />
      </div>
      <div className="kz-cocode__body">
        <p className="kz-cocode__k">Payment code</p>
        <p className="kz-cocode__v" data-testid="wallet-code">
          {code}
        </p>
        {expiresAt ? <p className="kz-cometa">Valid until {clock(expiresAt)} (Harare time)</p> : null}
        {link ? (
          <LinkButton href={link} className="kz-cocode__app">
            Open {methodName} app
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}
