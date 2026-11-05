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
