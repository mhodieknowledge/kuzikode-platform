/** Page actions of the CMS page editor (R6.2): preview, live link, discard and publish, each destructive step behind a confirmation. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button, LinkButton } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { usePublish } from './useCms';

export function PublishBar({
  pageKey,
  previewHref,
  liveHref,
}: {
  pageKey: string;
  previewHref: string;
  liveHref: string;
}) {
  const a = usePublish(pageKey);
  const [confirm, setConfirm] = useState<null | 'publish' | 'discard'>(null);
  return (
    <>
      <LinkButton variant="secondary" href={previewHref} target="_blank" rel="noopener">
        Preview drafts
      </LinkButton>
      <LinkButton variant="quiet" href={liveHref} target="_blank" rel="noopener">
        View live page
      </LinkButton>
      <Button variant="secondary" onClick={() => setConfirm('discard')}>
        Discard changes
      </Button>
      <Button onClick={() => setConfirm('publish')}>Publish page</Button>
      {a.error ? <FormAlert message={a.error} /> : null}
      <ConfirmSheet
        open={confirm === 'publish'}
        onClose={() => setConfirm(null)}
        title="Publish this page?"
        confirmLabel="Publish"
        onConfirm={() => a.publish()}
      >
        All saved drafts on this page go live now and the site cache is refreshed.
      </ConfirmSheet>
      <ConfirmSheet
        open={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        title="Discard unpublished changes?"
        confirmLabel="Discard"
        danger
        onConfirm={() => a.discard()}
      >
        Every section goes back to what is live now.
      </ConfirmSheet>
    </>
  );
}
