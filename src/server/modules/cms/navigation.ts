import type { RequestContext } from '../../context';
import { cached, getServiceCatalogue, getSettings, settingBool, settingText } from './service';

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export interface SiteNavigation {
  services: NavLink[];
  servicesExtra: NavLink[];
  about: NavLink[];
  careersInNav: boolean;
  footer: {
    blurb: string;
    services: NavLink[];
    company: NavLink[];
    legal: NavLink[];
    contact: {
      email?: string;
      phone?: string;
      whatsapp?: string;
      whatsappNumber?: string;
      location?: string;
      address?: string;
    };
    social: { label: string; href: string; icon: string }[];
    companyName: string;
    registration?: string;
  };
}

const SOCIAL: [key: string, label: string, icon: string][] = [
  ['social.linkedin', 'LinkedIn', 'linkedin'],
  ['social.facebook', 'Facebook', 'facebook'],
  ['social.x', 'X', 'x'],
  ['social.instagram', 'Instagram', 'instagram'],
  ['social.github', 'GitHub', 'github'],
  ['social.youtube', 'YouTube', 'youtube'],
];

export async function openRolesCount(ctx: RequestContext): Promise<number> {
  return cached(ctx, 'open-roles', async () => {
    const row = await ctx.db
      .prepare("SELECT count(*) AS n FROM job_postings WHERE status = 'open'")
      .first<{ n: number }>();
    return row?.n ?? 0;
  });
}

/** Header + footer navigation, built from the catalogue and settings (PRD §3). Blank settings are omitted. */
export async function siteNavigation(ctx: RequestContext): Promise<SiteNavigation> {
  const [catalogue, settings, roles] = await Promise.all([
    getServiceCatalogue(ctx),
    getSettings(ctx),
    openRolesCount(ctx),
  ]);
  const services = catalogue.map((c) => ({ label: c.name, href: `/services/${c.slug}`, description: c.summary }));
  const careersInNav = roles > 0 && settingBool(settings, 'careers.show_in_nav_when_open', true);
  const httpsOnly = (v: string | undefined) => (v && /^https:\/\//.test(v) ? v : undefined);
  const whatsapp = settingText(settings, 'contact.whatsapp_number');
  const registration = settingText(settings, 'company.registration_number');
  const legalName = settingText(settings, 'company.legal_name');
  return {
    services,
    servicesExtra: [
      {
        label: 'Industries',
        href: '/industries',
        description: 'Solutions for retail, finance, education, health and more.',
      },
      { label: 'How we work', href: '/how-we-work', description: 'Our process, engagement models and what to expect.' },
    ],
    about: [
      { label: 'About Kuzikode', href: '/about' },
      { label: 'How we work', href: '/how-we-work' },
      { label: 'Careers', href: '/careers' },
      { label: 'FAQ', href: '/faq' },
    ],
    careersInNav,
    footer: {
      blurb: settingText(settings, 'company.blurb') ?? '',
      services: catalogue.map((c) => ({ label: c.name, href: `/services/${c.slug}` })),
      company: [
        { label: 'About', href: '/about' },
        { label: 'Careers', href: '/careers' },
        { label: 'Insights', href: '/insights' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Pricing', href: '/pricing' },
      ],
      legal: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Terms of Use', href: '/legal/terms' },
        { label: 'Service Terms', href: '/legal/service-terms' },
        { label: 'Cookie notice', href: '/legal/cookies' },
        { label: 'Accessibility', href: '/legal/accessibility' },
      ],
      contact: {
        ...(settingText(settings, 'contact.email') ? { email: settingText(settings, 'contact.email')! } : {}),
        ...(settingText(settings, 'contact.phone') ? { phone: settingText(settings, 'contact.phone')! } : {}),
        ...(whatsapp ? { whatsapp: `https://wa.me/${whatsapp.replace(/\D/g, '')}`, whatsappNumber: whatsapp } : {}),
        ...(settingText(settings, 'contact.location') ? { location: settingText(settings, 'contact.location')! } : {}),
        ...(settingText(settings, 'contact.address') ? { address: settingText(settings, 'contact.address')! } : {}),
      },
      social: SOCIAL.flatMap(([key, label, icon]) => {
        const href = httpsOnly(settingText(settings, key));
        return href ? [{ label, href, icon }] : [];
      }),
      companyName: settingText(settings, 'company.name') ?? 'Kuzikode Intelligent Technologies',
      ...(registration
        ? { registration: `${legalName ?? settingText(settings, 'company.name')} · Reg. ${registration}` }
        : {}),
    },
  };
}
