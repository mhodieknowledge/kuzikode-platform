/**
 * FAQ seed (docs/12 §C, FAQ module). Answers describe only what the platform and the sales process actually do.
 */
export type FaqCategory = 'general' | 'pricing' | 'projects' | 'support' | 'careers';
export interface FaqSeed {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
}

export const FAQS: FaqSeed[] = [
  {
    id: 'faq_general_who',
    category: 'general',
    question: 'Who do you work with?',
    answer:
      'Small and medium businesses, NGOs, schools, clinics and other organisations in Zimbabwe and across Africa that need a website, an app or a business system.',
  },
  {
    id: 'faq_general_remote',
    category: 'general',
    question: 'Can you work with us if we are outside Zimbabwe?',
    answer: 'Yes. We work remotely with video calls, shared documents and the client portal, wherever you are based.',
  },
  {
    id: 'faq_general_start',
    category: 'general',
    question: 'How do we get started?',
    answer:
      'Use the Start a project form or the contact page to tell us what you need. We reply, usually within one business day, with questions or a written quotation.',
  },
  {
    id: 'faq_general_ownership',
    category: 'general',
    question: 'Who owns the website or software you build?',
    answer:
      'Once you have paid in full, you own the deliverables we created specifically for you, including the code and content. Third-party software keeps its own licence. Our service terms explain the details.',
  },
  {
    id: 'faq_projects_timeline',
    category: 'projects',
    question: 'How long does a project take?',
    answer:
      'It depends on the scope. Each package shows a typical delivery time, and every quotation includes a timeline with milestones. Timelines also depend on receiving content and decisions on time.',
  },
  {
    id: 'faq_projects_content',
    category: 'projects',
    question: 'Do you write the content and provide images?',
    answer:
      'You know your business best, so we usually work from your content. We can also write copy for an extra fee, and help you choose suitable images.',
  },
  {
    id: 'faq_projects_updates',
    category: 'projects',
    question: 'How will we know how the project is going?',
    answer:
      'We post updates every week in your client portal, where you can also see milestones, files, quotations and invoices.',
  },
  {
    id: 'faq_projects_changes',
    category: 'projects',
    question: 'What if we want changes during the project?',
    answer:
      'Small changes within the agreed scope are part of the revision rounds. Larger changes are quoted separately before we start them, so the budget never changes without your agreement.',
  },
  {
    id: 'faq_projects_existing',
    category: 'projects',
    question: 'Can you improve a system or website we already have?',
    answer:
      'Yes. We can review what you have, recommend whether to improve it or replace it, and move your data across if needed.',
  },
  {
    id: 'faq_support_after',
    category: 'support',
    question: 'What happens after launch?',
    answer:
      'Every project includes a support period. After that, you can choose a care plan, a support retainer or pay for help by the hour.',
  },
  {
    id: 'faq_support_request',
    category: 'support',
    question: 'How do I ask for help?',
    answer:
      'Clients can open a support request in the client portal and follow it there. You can also contact us by email or phone.',
  },
  {
    id: 'faq_support_hosting',
    category: 'support',
    question: 'Do you host websites and applications?',
    answer:
      'Yes. Our care plans include hosting, SSL, backups and uptime monitoring. We can also deploy to your own cloud account if you prefer.',
  },
  {
    id: 'faq_support_backups',
    category: 'support',
    question: 'Is my data backed up?',
    answer: 'Systems we host are backed up regularly, and we test that backups can be restored.',
  },
  {
    id: 'faq_careers_open',
    category: 'careers',
    question: 'Are you hiring?',
    answer: 'Open roles are listed on our careers page when we have them. You can apply online for each role.',
  },
  {
    id: 'faq_careers_cv',
    category: 'careers',
    question: 'Can I send my CV if there is no open role?',
    answer:
      'We only consider applications for advertised roles, so that every applicant gets a proper review. Check the careers page for openings.',
  },
  {
    id: 'faq_careers_privacy',
    category: 'careers',
    question: 'What happens to my application data?',
    answer:
      'We use it only to consider your application. CVs are deleted 12 months after the role closes, as described in our privacy policy.',
  },
  {
    id: 'faq_pricing_quote',
    category: 'pricing',
    question: 'Is the price on a package final?',
    answer:
      'Package prices are a clear starting point. We confirm the final scope and price in a written quotation before any work starts, so you know exactly what you are paying for.',
  },
  {
    id: 'faq_pricing_currency',
    category: 'pricing',
    question: 'Which currency do you charge in?',
    answer:
      'Our prices are in US dollars. If you need to pay in ZWG, ask for it when you request a quotation and we will confirm the amount on the quotation.',
  },
  {
    id: 'faq_pricing_payment_methods',
    category: 'pricing',
    question: 'How can I pay?',
    answer:
      'Invoices can be paid online on our checkout page with EcoCash, OneMoney, InnBucks or card (as available), or by bank transfer. You get a receipt by email as soon as a payment is confirmed.',
  },
  {
    id: 'faq_pricing_deposit',
    category: 'pricing',
    question: 'Do I pay everything upfront?',
    answer:
      'No. Projects are usually billed by milestone. Where a deposit is agreed in the quotation, work starts once it is received, and the balance is invoiced as milestones are approved.',
  },
  {
    id: 'faq_pricing_third_party',
    category: 'pricing',
    question: 'What about domains, mailboxes and other third-party costs?',
    answer:
      'Where a package includes a domain or mailboxes for the first year, that cost is in the package price. Renewals and other third-party costs are passed on as stated in the quotation.',
  },
  {
    id: 'faq_pricing_recurring',
    category: 'pricing',
    question: 'How do care plans and business email renew?',
    answer:
      'Recurring services are invoiced in advance for each month or year. Annual billing costs less than paying monthly. You can cancel before the next billing period starts.',
  },
  {
    id: 'faq_pricing_changes',
    category: 'pricing',
    question: 'What if I need something that is not in a package?',
    answer:
      'Add-ons such as extra pages, extra mailboxes or copywriting can be added to any package. For anything else, describe what you need and we will quote it separately before we start.',
  },
  {
    id: 'faq_pricing_vat',
    category: 'pricing',
    question: 'Do prices include VAT?',
    answer: 'Prices exclude VAT where applicable. Any tax that applies is shown as a separate line on the quotation and invoice.',
  },
];
