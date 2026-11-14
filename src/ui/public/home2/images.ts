/**
 * Home photographs (REFINEMENTS §7, BRIEF B.4). Each slot looks up the owner's delivered file by the name requested in
 * docs/redesign/IMAGE-REQUESTS.md (home batch) and falls back to an owner photo already in the manifest until it arrives.
 * Phone crops are optional: without one the desktop file is cropped by CSS (object-position).
 */
import manifest from '../../../../design/images/manifest.json';

const has = (id: string) => id in manifest.images;
const slot = (wide: string, tall: string, interim: string) => ({
  id: has(wide) ? wide : interim,
  mobileId: has(tall) ? tall : undefined,
});

export const HOME_IMAGES = {
  /** Hero background: interim the dusk handover desk (how-we-work-band). */
  hero: slot('home-hero-wide', 'home-hero-tall', 'how-we-work-band'),
  /** "Why Kuzikode" band: the owner's shop-counter payment photo (delivered, batch 3); a phone crop may follow. */
  why: slot('home-band', 'home-band-tall', 'home-band'),
  /** Closing band behind the contact options: interim the studio desk from above (services-hero). */
  closing: slot('home-closing-wide', 'home-closing-tall', 'services-hero'),
};
