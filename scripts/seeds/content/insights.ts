/**
 * Insights launch articles (docs/12 §C.4). Written for Zimbabwean SMEs: practical, accurate, no invented statistics,
 * no named clients. Payment facts match docs/06 (verified against Paynow's docs).
 */
export interface PostSeed {
  slug: string;
  title: string;
  excerpt: string;
  category: string; // post_categories slug
  tags: string[]; // post_tags slugs
  body: string;
  seoDescription: string;
}

export const POST_CATEGORIES: { slug: string; name: string }[] = [
  { slug: 'guides', name: 'Guides' },
  { slug: 'payments', name: 'Payments' },
  { slug: 'websites', name: 'Websites' },
  { slug: 'email-domains', name: 'Email & domains' },
];

export const POST_TAGS: { slug: string; name: string }[] = [
  { slug: 'ecocash', name: 'EcoCash' },
  { slug: 'online-payments', name: 'Online payments' },
  { slug: 'small-business', name: 'Small business' },
  { slug: 'web-design', name: 'Web design' },
  { slug: 'seo', name: 'SEO' },
  { slug: 'email', name: 'Email' },
  { slug: 'security', name: 'Security' },
  { slug: 'web-apps', name: 'Web apps' },
];

/** Launch articles are dated the platform's launch day. */
export const LAUNCH_PUBLISHED_AT = '2026-11-05T08:00:00.000Z';

export const POSTS: PostSeed[] = [
  {
    slug: 'accepting-ecocash-and-card-payments-on-your-website',
    title: 'Accepting EcoCash and card payments on your website',
    excerpt:
      'How online payments work in Zimbabwe, what a payment gateway does for you, and what to plan before you start taking money online.',
    category: 'payments',
    tags: ['ecocash', 'online-payments', 'small-business'],
    seoDescription:
      'A practical guide for Zimbabwean businesses to accepting EcoCash, OneMoney, InnBucks and card payments online through a payment gateway.',
    body: `<p>Customers increasingly expect to pay online: for an order, a booking or an invoice. In Zimbabwe that usually means mobile money such as EcoCash, OneMoney and InnBucks, as well as Visa, Mastercard and Zimswitch cards. This guide explains how it fits together and what to decide before you start.</p>
<h2>You need a payment gateway</h2>
<p>Your website should never collect card numbers or mobile money PINs itself. A <strong>payment gateway</strong> (for example Paynow or PesePay) sits between your site and the payment networks. Your site tells the gateway who is paying, how much and for what; the gateway handles the sensitive part and tells your site whether the payment succeeded.</p>
<p>To use a gateway you register a merchant account with it, provide your business details and bank account for settlement, and receive integration keys. The gateway sets your integration live once it is satisfied with your application. Until then you can build and test in its test mode.</p>
<h2>How a mobile money payment works</h2>
<ol>
<li>The customer chooses EcoCash or OneMoney on your checkout and enters their phone number.</li>
<li>Your site asks the gateway to start the payment. The customer's phone shows a prompt to approve it and enter their PIN.</li>
<li>The gateway sends your site a status update when the payment is paid, cancelled or failed. Your page can also check the status while the customer waits.</li>
<li>Only when the gateway confirms the payment do you mark the order or invoice as paid and send a receipt.</li>
</ol>
<p>InnBucks works slightly differently: the customer receives a code (often shown as a QR code) to approve in the InnBucks app.</p>
<h2>How a card payment works</h2>
<p>For cards, the customer usually enters their details on the gateway's own secure page and is then returned to your site. This keeps card data out of your systems. Some gateways can save a card as a token for faster repeat payments, without your site ever storing the card number.</p>
<h2>Things to get right</h2>
<ul>
<li><strong>Trust the confirmation, not the redirect.</strong> A customer arriving back on your "thank you" page does not prove they paid. Always wait for the gateway's confirmed status before releasing goods or marking an invoice paid.</li>
<li><strong>Handle duplicates.</strong> Gateways can send the same status update more than once. Your system should record each payment once, however many times it hears about it.</li>
<li><strong>Reconcile regularly.</strong> Compare what your system recorded with the gateway's reports and your bank statements, so nothing slips through.</li>
<li><strong>Be clear about currency.</strong> Show the currency on every price, invoice and receipt, and check which currencies each payment method supports for your account.</li>
<li><strong>Tell customers what to expect.</strong> A short message such as "Check your phone and approve the EcoCash prompt" reduces abandoned payments.</li>
<li><strong>Plan for more than one gateway.</strong> If your system is built so the gateway can be swapped or added to, you are not stuck if fees, features or availability change.</li>
</ul>
<h2>Fees and settlement</h2>
<p>Gateways charge per transaction and settle money to your bank account on their own schedule. Fees and terms differ by gateway and payment method, so compare the current terms from each gateway directly before you choose.</p>
<h2>Where to start</h2>
<p>If you already invoice customers, the simplest first step is a "Pay online" link on each invoice. If you sell products or bookings, the payment step is built into your checkout. Either way, start in the gateway's test mode, test each payment method you plan to offer, and only then go live.</p>
<p>We integrate Paynow, PesePay, EcoCash, OneMoney, InnBucks and cards into websites and business systems, with reconciliation built in. <a href="/start-a-project">Tell us about your project</a> if you would like help.</p>`,
  },
  {
    slug: 'what-a-business-website-should-include-in-2026',
    title: 'What a business website should include in 2026',
    excerpt:
      'The pages, features and basics that help a business website earn trust and turn visitors into enquiries, without unnecessary extras.',
    category: 'websites',
    tags: ['web-design', 'seo', 'small-business'],
    seoDescription:
      'A checklist of the pages, features and technical basics every business website in Zimbabwe should have in 2026.',
    body: `<p>A business website has one main job: help the right people understand what you do, trust you, and get in touch. Here is what that takes today.</p>
<h2>The pages that matter</h2>
<ul>
<li><strong>Home:</strong> who you help, what you offer and what to do next, all visible without scrolling far.</li>
<li><strong>Services or products:</strong> one clear section per offer, written in your customers' words, with what is included and how to start.</li>
<li><strong>About:</strong> who you are, where you work and why people can rely on you. Real photos of your team and premises help far more than stock images.</li>
<li><strong>Contact:</strong> a short form, phone number, email address, WhatsApp if you use it, your address or service area, and your hours.</li>
<li><strong>Privacy policy:</strong> required if you collect personal information through forms, and a sign of a careful business.</li>
</ul>
<h2>Built for phones first</h2>
<p>Many visitors will see your site on a phone, often on mobile data. Design for small screens first: readable text, large buttons, a menu that is easy to use with a thumb, and pages that load quickly on a modest connection. Optimised images make the biggest difference to speed.</p>
<h2>Easy to contact you</h2>
<p>Every page should make the next step obvious, whether that is "Request a quote", "Call us" or "Chat on WhatsApp". Forms should ask only for what you need, confirm that the message was received, and send it somewhere that someone checks every day.</p>
<h2>Found on Google</h2>
<ul>
<li>A clear title and description for every page.</li>
<li>Content that answers the questions your customers actually search for.</li>
<li>Your site connected to Google Search Console so you can see how people find it.</li>
<li>A Google Business Profile with the same name, address and phone number as your website.</li>
</ul>
<h2>Trust signals, honestly</h2>
<p>Testimonials, case studies and client logos help only when they are real and you have permission to show them. If you are new, focus on clear descriptions of your process, transparent pricing or packages, and fast replies. Never invent reviews or statistics: customers notice, and it damages trust.</p>
<h2>Secure and maintained</h2>
<ul>
<li>HTTPS on every page (the padlock in the browser).</li>
<li>Regular updates to the software behind the site, and backups you have actually tested restoring.</li>
<li>Spam protection on forms.</li>
<li>Someone responsible for keeping content current, such as prices, opening hours and staff.</li>
</ul>
<h2>Accessible to everyone</h2>
<p>Good contrast, proper headings, descriptive link text, labelled form fields and keyboard support make your site usable for people with disabilities. They also make it easier for everyone to use and for search engines to understand.</p>
<h2>Nice to have, when you need it</h2>
<p>A blog or news section, online booking, online payments and a customer portal are valuable when they serve a real need. Start with the essentials done well, then add features as your business grows.</p>
<p>Our website packages cover these essentials. <a href="/pricing">See what each one includes</a>, or <a href="/start-a-project">start a project</a>.</p>`,
  },
  {
    slug: 'business-email-on-your-own-domain',
    title: 'Business email on your own domain: why and how',
    excerpt:
      'Why an address like you@yourbusiness.co.zw builds trust, what you need to set one up, and the DNS records that keep your email out of spam folders.',
    category: 'email-domains',
    tags: ['email', 'security', 'small-business'],
    seoDescription:
      'Why your business should use email on its own domain, how to set it up, and what SPF, DKIM and DMARC records do.',
    body: `<p>An address such as <em>sales@yourbusiness.co.zw</em> tells customers they are dealing with an established business. It also keeps your business correspondence under your control, even when staff change.</p>
<h2>Why it is worth it</h2>
<ul>
<li><strong>Trust:</strong> customers and suppliers are more comfortable dealing with a business address than a free personal one.</li>
<li><strong>Control:</strong> the business owns the mailboxes. When someone leaves, you can keep their mailbox or redirect it instead of losing the history.</li>
<li><strong>Consistency:</strong> your website, email and documents all show the same name.</li>
<li><strong>Security:</strong> business email services let you enforce strong passwords and two-step verification for every user.</li>
</ul>
<h2>What you need</h2>
<ol>
<li><strong>A domain name</strong>, such as <em>yourbusiness.com</em> or <em>yourbusiness.co.zw</em>, registered in your organisation's name. Keep the login details for the registrar safe; whoever controls the domain controls your email.</li>
<li><strong>An email service</strong> that hosts mailboxes on your domain, such as Zoho Mail, Google Workspace or Microsoft 365. Plans differ in storage, apps and price per user.</li>
<li><strong>DNS records</strong> that tell the internet where your email lives and prove that messages really come from you.</li>
</ol>
<h2>The DNS records, in plain language</h2>
<ul>
<li><strong>MX records</strong> tell other mail servers where to deliver email for your domain.</li>
<li><strong>SPF</strong> lists the servers that are allowed to send email for your domain. Receiving servers check it to spot forgeries.</li>
<li><strong>DKIM</strong> adds a digital signature to each message your service sends. Receivers check the signature against a public key published in your DNS.</li>
<li><strong>DMARC</strong> tells receivers what to do when a message fails SPF and DKIM checks (for example, put it in spam or reject it) and can send you reports. Start in monitoring mode, then tighten it once you know all your legitimate senders pass.</li>
</ul>
<p>Without these records, your genuine messages are more likely to land in spam, and it is easier for someone to send fake email that appears to come from you.</p>
<h2>Moving from an existing address</h2>
<p>If you already use a free address or another provider, existing mail can usually be migrated to the new mailboxes. Plan a switch-over day, update your website, email signatures and documents, and keep the old address forwarding for a while so nothing is missed.</p>
<h2>Good habits once you are set up</h2>
<ul>
<li>Turn on two-step verification for every mailbox.</li>
<li>Use shared addresses such as accounts@ or info@ for roles, so mail is not tied to one person.</li>
<li>Remove access promptly when someone leaves.</li>
<li>Renew your domain before it expires. An expired domain stops your email working.</li>
</ul>
<p>We set up business email on your domain, including SPF, DKIM and DMARC, and can migrate your existing mail. <a href="/pricing#email">See our email and domain packages</a>.</p>`,
  },
  {
    slug: 'choosing-between-a-website-and-a-web-app',
    title: 'Choosing between a website and a web app',
    excerpt:
      'What separates a website from a web application, how to tell which one your project needs, and why the answer affects budget and timeline.',
    category: 'guides',
    tags: ['web-apps', 'web-design', 'small-business'],
    seoDescription:
      'The difference between a website and a web application, with questions to help you decide which your project needs.',
    body: `<p>"We need a website" can mean very different things. Some projects need a clear public website; others need a web application that people sign in to and use to get work done. Knowing which one you need makes it easier to plan the budget and timeline, and to compare quotations fairly.</p>
<h2>A website informs</h2>
<p>A website mainly presents information to visitors: who you are, what you offer and how to get in touch. Most visitors do not sign in. Content changes occasionally and is managed by your team through a content editor. Typical examples are company sites, service pages, portfolios and news sections. A contact form, a booking request or a small online store can all sit comfortably on a website.</p>
<h2>A web app does work</h2>
<p>A web application lets signed-in users create, update and manage their own data, often with different permissions for different roles. Think of a client portal, a loan management system, a school fees system, a dispatch board or an internal dashboard. It runs in the browser like a website, but behaves more like software.</p>
<h2>Questions that tell you which you need</h2>
<ul>
<li>Do people need to <strong>sign in</strong> to see information that belongs to them?</li>
<li>Will users <strong>create or change records</strong>, such as orders, applications, jobs or invoices?</li>
<li>Are there <strong>different roles</strong> that see and do different things?</li>
<li>Does it need to follow a <strong>process</strong>, with approvals, statuses or notifications?</li>
<li>Does it need to <strong>connect</strong> to other systems, such as accounting software, payment gateways or an existing database?</li>
</ul>
<p>If you answered yes to most of these, you are describing a web application. If not, a website is probably the right start.</p>
<h2>Why it matters for budget and time</h2>
<p>A website's scope is mostly content and design, so it can often be priced as a fixed package. A web app's scope depends on its rules, roles, data and integrations, so it needs a short discovery phase to agree what will be built before it can be quoted with confidence. Web apps also need ongoing care: security updates, backups and support for users.</p>
<h2>Often the answer is both</h2>
<p>Many organisations have a public website for marketing and a separate web app (or portal) for customers or staff. They can share the same branding and domain, and you can start with the website and add the application later.</p>
<h2>Start with the problem</h2>
<p>Describe the problem you want to solve and who will use the solution, rather than the technology. A good partner will recommend the simplest thing that works, and tell you when a package will do and when a custom build is worth it.</p>
<p><a href="/start-a-project">Tell us what you need</a> and we will recommend the right starting point.</p>`,
  },
];
