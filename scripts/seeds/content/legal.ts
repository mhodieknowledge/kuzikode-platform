/**
 * Draft legal pages (PRD §3.7, docs/12 §C.13). Plain, honest drafts for the owner's lawyer to review (BLOCKERS.md).
 * They never claim the company is registered and describe only what the platform actually does.
 */
import type { PageSeed } from './cms';

const UPDATED = '<p><em>Last updated: 5 November 2026. This document is a draft awaiting legal review.</em></p>';

export const LEGAL_PAGES: PageSeed[] = [
  {
    key: 'legal-privacy',
    title: 'Privacy Policy',
    seoTitle: 'Privacy Policy · Kuzikode Technologies',
    seoDescription: 'How Kuzikode Technologies collects, uses, stores and protects personal information.',
    sections: [
      {
        key: 'body',
        type: 'rich_text',
        content: {
          title: 'Privacy Policy',
          html: `${UPDATED}
<p>This policy explains how Kuzikode Technologies ("Kuzikode", "we") handles personal information collected through this website, our client portal and our services. We process personal information in line with Zimbabwe's Cyber and Data Protection Act [Chapter 12:07] and good international practice.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Enquiries and project requests:</strong> your name, email address, optional phone number and organisation, the service you are interested in, an optional budget range, your message and any file you choose to attach.</li>
<li><strong>Client portal accounts:</strong> your name, email address, optional phone number, a securely hashed password, sign-in history (date, time, IP address and browser) and, if you turn it on, two-factor authentication settings.</li>
<li><strong>Clients:</strong> billing and contact details, quotations, invoices, payments, project information and messages exchanged with us.</li>
<li><strong>Job applications:</strong> the details and documents you submit, including your CV, and the answers you give to application questions.</li>
<li><strong>Newsletter:</strong> your email address and the date you confirmed your subscription.</li>
<li><strong>Security and operations:</strong> technical logs (for example IP addresses, which we store in a hashed form for abuse prevention) that keep the website secure and working.</li>
</ul>
<h2>How we use it</h2>
<p>We use personal information to reply to enquiries, prepare quotations, deliver and support the services you ask for, issue invoices and receipts, process payments, operate the client portal, consider job applications, send newsletters you have asked for, keep our systems secure and meet our legal obligations. We do not sell personal information and we do not use it for advertising profiles.</p>
<h2>Who we share it with</h2>
<p>We use carefully chosen service providers to run the platform: Cloudflare (hosting, storage and security checks), Resend (sending email) and payment gateways such as Paynow (processing payments you make). Payment gateways receive the details needed to process your payment; Kuzikode never sees or stores your card number or mobile money PIN. Some providers may process data outside Zimbabwe; where they do, we rely on their contractual and security commitments. We share information with authorities only when the law requires it.</p>
<h2>How long we keep it</h2>
<ul>
<li>Enquiries that do not become projects: up to 24 months, then deleted or anonymised.</li>
<li>Client and financial records (quotations, invoices, payments, receipts): for as long as the law requires us to keep accounting records.</li>
<li>Job applications: 12 months after the position closes, after which CVs are deleted and applications are anonymised.</li>
<li>Newsletter subscriptions: until you unsubscribe.</li>
<li>Email delivery logs: up to 12 months. Session records: up to 30 days after they expire.</li>
</ul>
<h2>Security</h2>
<p>We protect information with encryption in transit, hashed passwords, role-based access for our staff, two-factor authentication for privileged accounts, audit logs and regular backups.</p>
<h2>Your rights</h2>
<p>You can ask to see the personal information we hold about you, ask us to correct it, object to how we use it, or ask us to delete it where we are not required to keep it. You can unsubscribe from the newsletter at any time using the link in every email. To make a request, use the <a href="/contact">contact page</a> and choose "General question". We will reply within 30 days.</p>
<h2>Cookies</h2>
<p>We use only strictly necessary cookies. See our <a href="/legal/cookies">cookie notice</a>.</p>
<h2>Changes</h2>
<p>We will update this page when our practices change and show the date of the latest version at the top.</p>`,
        },
      },
    ],
  },
  {
    key: 'legal-terms',
    title: 'Terms of Use',
    seoTitle: 'Terms of Use · Kuzikode Technologies',
    seoDescription: 'The terms that apply when you use the Kuzikode Technologies website and client portal.',
    sections: [
      {
        key: 'body',
        type: 'rich_text',
        content: {
          title: 'Terms of Use',
          html: `${UPDATED}
<p>These terms apply to your use of this website and the Kuzikode client portal. By using them you agree to these terms. Work we do for clients is covered by our <a href="/legal/service-terms">Service Terms</a> and the quotation you accept.</p>
<h2>Using the website</h2>
<p>You may browse the website and share links to it. You must not misuse it: for example, by trying to gain unauthorised access, interfering with its operation, sending spam through our forms or copying content in bulk.</p>
<h2>Client portal accounts</h2>
<p>Portal accounts are created by invitation. Keep your password private and tell us straight away if you think someone else has used your account. You are responsible for actions taken with your account. We may suspend access to protect you, us or other clients.</p>
<h2>Content and intellectual property</h2>
<p>The website's text, design, logo and code belong to Kuzikode Technologies or are used with permission. Some images on the website are illustrative and do not show Kuzikode staff or clients. You may not reuse our content without written permission, except for quoting short passages with a link back.</p>
<h2>Information on the website</h2>
<p>We work to keep the information here accurate, but it is general information, not a binding offer. Package descriptions and indicative prices are confirmed only in a written quotation.</p>
<h2>Links</h2>
<p>We are not responsible for the content of websites we link to.</p>
<h2>Liability</h2>
<p>We provide the website "as is". To the extent the law allows, we are not liable for indirect or consequential loss arising from your use of the website. Nothing in these terms limits liability that cannot be limited by law.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of Zimbabwe.</p>
<h2>Changes</h2>
<p>We may update these terms. The date at the top shows the latest version.</p>`,
        },
      },
    ],
  },
  {
    key: 'legal-service-terms',
    title: 'Service Terms',
    seoTitle: 'Service Terms · Kuzikode Technologies',
    seoDescription: 'Payment, milestone, revision, ownership, support and cancellation terms for Kuzikode projects.',
    sections: [
      {
        key: 'body',
        type: 'rich_text',
        content: {
          title: 'Service Terms',
          html: `${UPDATED}
<p>These terms apply to services Kuzikode Technologies provides under a quotation you accept. If a quotation says something different, the quotation applies.</p>
<h2>Quotations and scope</h2>
<p>Each quotation describes the scope, deliverables, price, currency, milestones and validity period. Work outside that scope is quoted separately before we start it.</p>
<h2>Payment</h2>
<ul>
<li>Invoices show the amount, currency and due date. You can pay online on our checkout page (EcoCash, OneMoney, InnBucks or card, as available) or by bank transfer.</li>
<li>Projects are usually billed by milestone. Where a deposit is agreed, work starts once it is received.</li>
<li>Recurring services (such as care plans, hosting or business email) are invoiced in advance for each period.</li>
<li>If an invoice is overdue we may pause work until it is settled. We will tell you before we do.</li>
</ul>
<h2>Third-party costs</h2>
<p>Domain registrations, mailboxes, app store fees and similar third-party costs are passed on as stated in the quotation and are subject to the provider's terms.</p>
<h2>Revisions and approvals</h2>
<p>The number of revision rounds is set out in the quotation or package. You approve each milestone in writing (email or the client portal). Further rounds are quoted separately.</p>
<h2>Your responsibilities</h2>
<p>You provide content, access and decisions on time and confirm that you have the rights to the material you give us. Delays on either side move the timeline accordingly.</p>
<h2>Ownership</h2>
<p>When you have paid in full, you own the deliverables we created specifically for you, including the code and content we wrote. Third-party software, libraries and fonts stay under their own licences. We may reuse general know-how and non-client-specific components.</p>
<h2>Support</h2>
<p>Each project includes the support period stated in the quotation. After that, support is available under a care plan, retainer or at our hourly rate.</p>
<h2>Confidentiality</h2>
<p>We keep your business information confidential and use it only to provide the services.</p>
<h2>Cancellation</h2>
<p>Either party may end a project by written notice. You pay for work completed and costs committed up to that date; we hand over the work you have paid for. Recurring services can be cancelled before the next billing period.</p>
<h2>Liability</h2>
<p>Our total liability for a project is limited to the amount you paid for it, except where the law does not allow such a limit.</p>`,
        },
      },
    ],
  },
  {
    key: 'legal-cookies',
    title: 'Cookie notice',
    seoTitle: 'Cookie notice · Kuzikode Technologies',
    seoDescription: 'The strictly necessary cookies used on the Kuzikode Technologies website and portal.',
    sections: [
      {
        key: 'body',
        type: 'rich_text',
        content: {
          title: 'Cookie notice',
          html: `${UPDATED}
<p>We use only cookies that are strictly necessary for the website and portal to work securely. We do not use advertising or tracking cookies, so there is nothing to opt out of.</p>
<table>
<thead><tr><th scope="col">Cookie</th><th scope="col">Purpose</th><th scope="col">Duration</th></tr></thead>
<tbody>
<tr><td>__Host-kz_portal</td><td>Keeps you signed in to the client portal.</td><td>Up to 30 days, or until you sign out</td></tr>
<tr><td>__Host-kz_admin</td><td>Keeps Kuzikode staff signed in to the admin area.</td><td>Up to 12 hours, or until sign-out</td></tr>
<tr><td>Cloudflare security cookies</td><td>Set by our hosting provider to protect forms from abuse and bots.</td><td>Session to 30 minutes</td></tr>
</tbody>
</table>
<p>If we add website analytics, we will use a privacy-friendly, cookie-free service and update this notice.</p>`,
        },
      },
    ],
  },
  {
    key: 'legal-accessibility',
    title: 'Accessibility statement',
    seoTitle: 'Accessibility statement · Kuzikode Technologies',
    seoDescription: 'Our commitment to an accessible website and client portal.',
    sections: [
      {
        key: 'body',
        type: 'rich_text',
        content: {
          title: 'Accessibility statement',
          html: `<p><em>Last updated: 5 November 2026.</em></p>
<p>We want everyone to be able to use our website and client portal, including people who use screen readers, keyboard navigation, magnification or voice control.</p>
<h2>Our standard</h2>
<p>We design and test against the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA.</p>
<h2>What we do</h2>
<ul>
<li>Semantic page structure with landmarks, headings and a skip link.</li>
<li>Labels and clear error messages for every form field.</li>
<li>Full keyboard support with a visible focus indicator.</li>
<li>Colour contrast that meets AA, and status information shown in text, not colour alone.</li>
<li>Pages that work on small screens and slow connections, and respect reduced-motion settings.</li>
<li>Automated accessibility checks on every page as part of our release process.</li>
</ul>
<h2>Known limitations</h2>
<p>Card details are entered on our payment partner's secure page, which we do not control. If you have difficulty there, choose another payment method or contact us.</p>
<h2>Feedback</h2>
<p>If something is hard to use, please tell us through the <a href="/contact">contact page</a>. We aim to reply within two business days.</p>`,
        },
      },
    ],
  },
];
