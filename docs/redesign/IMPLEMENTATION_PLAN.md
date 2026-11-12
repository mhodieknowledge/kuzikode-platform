# Implementation plan (R1.2, rewritten for the clean slate in R1.4)

**Rule (BRIEF B.0):** the UI is rebuilt from scratch in a new component tree. Nothing visible is restyled or reskinned. Only logic is
reused: server services, API routes, repositories, Zod schemas, auth, payments, page-frontmatter data loaders, submit handlers and
endpoint contracts, pure utilities, CMS content. Where an old React island mixes logic and markup, the logic is extracted into a hook
or module (`src/ui/**/use*.ts` or `src/shared/`) and new markup is written around it. Old presentation files are deleted when nothing
references them; the checklist in §8 tracks every one.

Stack: Astro 5 SSR + React islands + Tailwind 4 on Workers.

## 1. New tree

```
src/ui/
  tokens/            (CSS only: tokens.css, base.css: the R2.1 token layer moves here)
  icons/             Icon.astro, icon.tsx (Lucide wrapper), registry of named icons per meaning
  motion/            reveal.ts, scrollspy.ts, rail.ts, sheet.ts (vanilla, bundled, CSP-safe)
  primitives/        Button, Link, Field + Input/Select/Textarea/Checkbox/Radio/ChoiceTile, SegmentedControl, Tabs,
                     Accordion, Rail, Sheet, Dialog, Toast, Badge/StatusPill, ListRow, DataTable (list-row mode), Spinner,
                     EmptyState, Pagination, Menu, FileDrop, MoneyField, RichTextEditor shell  (.astro and/or .tsx twins)
  public/            shell (Header, MegaPanel, MobileMenu, Footer, WhatsApp), sections (Hero, DirectoryBoard, WorkspaceShowcase,
                     Approach, ProcessTimeline, WorkRail, ProductRow, TechMarquee, CtaPanel), pricing (FloorSelector, PackageCard,
                     PackageRail, CompareSheet, CompareTable, AddonList), work, insights, careers, forms (Contact, Wizard,
                     Consultation, Interest, Newsletter, Application, QuotationResponse), documents, checkout
  workspace/         shell (StatusBar, Dock, BottomDock, Window, CommandPalette, ThemeToggle), overview, projects, documents,
                     payments, services, support, account, auth
  admin/             shell (Sidebar, TopBar, Pane, CommandPalette, NotificationsBell, UserMenu), one folder per module
src/layouts/          rewritten from scratch: PublicLayout, WorkspaceLayout, AdminLayout, AuthLayout, DocumentLayout
```

`src/components/` is legacy. Nothing new is added there; it empties as R3–R6 progress and is deleted by the end of R6.

## 2. Tokens (R2.1, done) and what changes
The token layer (`src/styles/tokens.css`, `global.css`) was written new for the Directory world. Its **compatibility aliases** exist
only so legacy screens remain usable while they wait for their rebuild; they are not a strategy. They move to `src/ui/tokens/` and the
aliases are deleted when the last legacy screen is deleted (R6.2 exit check: `grep` finds no alias name).

## 3. Primitives (R2.3): all new
| Primitive (new, `src/ui/primitives/`) | Logic reused from |
|---|---|
| Button / Link (pill primary with arrow knob, secondary, quiet, danger, icon) | none |
| Field, Input, Select, Textarea, Checkbox, Radio, ChoiceTile, MoneyField, FileDrop | validation/formatting helpers in `src/shared/money.ts`, upload contract of `ui/FileUpload.tsx` (extracted to a hook) |
| SegmentedControl, Tabs, Accordion, Rail, Sheet, Dialog, Toast | none (new behaviour) |
| Badge / StatusPill | status → label maps in `src/shared/*` |
| DataTable (desktop table + list-row mode) | sort/filter/pagination state from `ui/DataTable.tsx`, `FilterBar.tsx`, `Pagination.tsx` extracted to `useTable` |
| Menu, Spinner, EmptyState | none |
| RichTextEditor shell | editor logic from `ui/RichTextEditor.tsx` extracted |
| api client | `ui/api.ts` moved as is (pure logic) |

## 4. Public (R3–R4): all new
| Page | New components | Logic reused |
|---|---|---|
| Layout + shell | PublicLayout, Header, MegaPanel, MobileMenu, Footer, WhatsApp, Announcement | settings/nav loaders, announcement query |
| Home | Hero (route list + board), DirectoryBoard, WorkspaceShowcase, Approach, ProcessTimeline, WorkRail, ProductRow, TechMarquee, CtaPanel | `getPage`, `sectionOf`, services/portfolio/products loaders, new pure helper `divisionFromPrice` |
| Services, division | DirectoryBoard (index), DivisionHero, SubServiceTabs, PackageRail, IncludedStrip, DeliveryBars, FaqAccordion, StickyActionBar | service + catalogue loaders, new helper `includedInEvery` |
| Pricing | FloorSelector, PackageCard, PackageSelector + PackageRail, CompareSheet, CompareTable, AddonList | `getPricingCatalogue`, `comparisonRows`, `formatPriceTag` |
| Work, case study | WorkIndex, EmptyWork, CaseStudy | portfolio loaders |
| About, How we work, Industries, Technologies | Statement, ValuesList, ProcessTimeline, IndustryRows | CMS loaders |
| Contact, Start a project, Consultation | ContactPage, ChannelTiles, ContactForm, ProjectWizard, ConsultationForm | submit handlers/endpoint contracts and Turnstile logic extracted from `forms/*.tsx` into hooks |
| Insights, Careers, FAQ, Products, legal, search, 404/500 | new page components | loaders; Interest/Application form logic extracted |
| Documents and checkout | DocumentSheet, QuotationView, InvoiceView, CheckoutFlow, MethodTiles, MobileMoneyStep, ReceiptSummary | checkout state machine from `payments/CheckoutPage.tsx` extracted to `useCheckout`; `CardReturn`, `QuotationResponse` logic extracted |

## 5. Workspace (R5) and admin (R6): all new
- Workspace: new WorkspaceLayout (status bar, dock, bottom dock, windows, palette, theme). Portal pages rewritten to compose new
  components; logic from `portal/*.tsx` (account, saved cards, support forms, project messages, attempt status) extracted to hooks.
- Admin: new AdminLayout (felt sidebar, top bar, panes). Each `admin/*Admin.tsx` module (≈ 15 000 lines across islands) is split:
  data/state/actions → `src/ui/admin/<module>/use<Module>.ts` (unchanged API calls and validation), markup → new components. Done
  module by module in R6.2 with that module's e2e spec green after each.
- Auth (portal + admin): new split layout; logic from `auth/AuthForms.tsx` extracted (`useSignIn`, `usePasswordReset`, `useMfa`, …).

## 6. Testing per task
- `npm run verify` + the affected e2e specs (full e2e before each push of a page group).
- Visual loop: `SHOOT=<pages> SHOOT_SET=core npx playwright test -c playwright.visual.config.ts` (all 10 viewports for major pages),
  read screenshots, fix, re-shoot; `SHOOT_REDUCED=1` once per component family.
- **Freshness check (B.0):** each rebuilt page's new screenshot is put beside its before-shot (`docs/screenshots/redesign/before/`);
  if it reads as the same layout in new colours, it is redesigned.
- New tests: pricing accuracy (R4.3), unit tests for extracted hooks' pure parts and new helpers, mobile menu / segmented control /
  rail keyboard and touch behaviour (e2e), reduced motion (e2e). e2e specs keep their `data-*` hooks and accessible names; where a
  visible label changes, the spec changes in the same commit with the reason.

## 7. Order of work
R1.4 → R2.1 (done; tokens) → R2.2 icons → R2.3 primitives → R2.4 gallery → R3 shell → R4.1–R4.8 → R5.1–R5.4 → R6.1–R6.2 →
R7 → R8. One task = one or a few commits, each with verify green, pushed to `main`.

## 8. Legacy presentation removed (checklist)

Ticked when the file is deleted (or, for the logic-only files marked *logic*, moved/rewritten into `src/ui` or `src/shared`).

| Legacy file | Replaced by | Deleted in |
|---|---|---|
| layouts/PublicLayout.astro | new PublicLayout | [ ] R3.1 |
| layouts/AppLayout.astro | new base layout | [ ] R3.1 |
| layouts/PortalLayout.astro | WorkspaceLayout | [ ] R5.1 |
| layouts/AdminLayout.astro | new AdminLayout | [ ] R6.1 |
| layouts/AuthLayout.astro | new AuthLayout | [ ] R5.4 |
| layouts/DocumentLayout.astro | new DocumentLayout | [ ] R4.8 |
| components/BaseHead.astro, JsonLd.astro (*logic*) | src/ui/public/head | [ ] R3.1 |
| components/Logo.astro | src/ui/brand/Logo.astro (new) | [ ] R3.1 |
| components/ResponsiveImage.astro | src/ui/primitives/Picture.astro (new) | [ ] R4.1 |
| public/SiteHeader.astro, AnnouncementBar.astro, WhatsAppButton.astro, Icon.astro | public shell, icons | [ ] R3.1 |
| public/SiteFooter.astro | Footer | [ ] R3.2 |
| public/sections/Hero, ServicesGrid, Features, Process, PhotoPair, WorkGallery, ProductsGrid, TechnologiesStrip, CtaBand, SectionHeading, Statement, Values, Testimonials, ListSection, RichText, WorkGrid | new public sections | [ ] R4.1–R4.5 (each deleted with its last user) |
| public/pricing/PackageCard.astro, ComparisonTable.astro | pricing components | [ ] R4.3 |
| public/insights/InsightsListing, PostCard, PostCover | insights components | [ ] R4.7 |
| forms/ContactForm, StartProjectWizard, ConsultationForm, Turnstile | new forms + hooks | [ ] R4.6 |
| forms/InterestForm, NewsletterForm, ApplicationForm | new forms + hooks | [ ] R4.7 (newsletter with R3.2) |
| forms/QuotationResponse, documents/QuotationDocument, InvoiceDocument | documents | [ ] R4.8 |
| payments/CheckoutPage, CheckoutSummary, CardReturn | checkout | [ ] R4.8 |
| portal/StatusPill, AttemptStatus, PortalAccount, ProjectMessageForm, SavedCards, SupportForms | workspace | [ ] R5.2–R5.4 |
| auth/AuthForms | workspace/admin auth | [ ] R5.4 |
| admin/UserMenu, NotificationsBell, CommandPalette, actions | admin shell | [ ] R6.1 |
| admin/*Admin.tsx (22 modules), LineItemEditor, BarChart, CmsTabs, ContentTabs, SettingsNav, SettingsSections, PaymentGateways, AccountActions | admin modules | [ ] R6.2 |
| ui/* (Badge, Button, Card, Choice, DataTable, Dialog, Field, FileUpload, FilterBar, Input, Menu, MoneyInput, Pagination, QrCode, RichTextEditor, Spinner, States, Toast, cn, index; api.ts *logic*) | src/ui/primitives | [ ] R6.2 (last users are admin modules) |
| dev/KitchenSink.tsx, pages/dev/ui.astro | new dev gallery | [x] R2.4 |
| Token aliases in tokens.css / global.css | — | [ ] R6.2 exit |
