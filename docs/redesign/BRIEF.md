# Kuzikode: Complete Website UI/UX Reconstruction (owner brief)

Status: **active**. This brief is the top authority for everything visual and interaction-related (public site, client
workspace, admin UI). For functionality, data, pricing and business rules, `docs/01-PRD.md`, `docs/12-COMMERCIAL-FEATURES.md`
and the existing code remain authoritative. **Section A** is the owner's brief, verbatim. **Section B** contains the owner's later
additions and the operating rules for the autonomous agent.

---

## A. Owner's brief (verbatim)

### 1. Mission

Perform a complete teardown and reconstruction of the existing Kuzikode website's user interface and user experience.

This is NOT a visual improvement, minor redesign, component restyling exercise or incremental UI update.

The existing interface should be treated as a starting point for understanding the project's functionality and content, not as a design foundation that must be preserved.

The objective is to deliver a premium, modern, professional technology-company experience with excellent desktop and mobile usability.

You are authorised to make independent design decisions and execute the entire project without routine user supervision.

Do not stop to request approval for design directions, component choices, layouts, animations, architecture of the frontend or implementation stages. Make sound professional decisions and carry the project through to completion.

### 2. Understand the company and website scope

Kuzikode is a technology company providing professional digital and software development services.

The public-facing website should communicate the company's identity, capabilities, expertise, credibility and value.

Its scope includes:

* Company identity and positioning.
* Website and software development.
* AI, machine learning and data intelligence.
* Automation and integrations.
* Cloud and technology consulting.
* Existing services and pricing.
* Portfolio and completed projects.
* Client enquiries and contact channels.
* Other existing company information and functionality.

Do not introduce future products as though they already exist.

The following are outside the scope of this redesign:

* Kuzikode Hosting.
* Kuzikode Business Suite.
* Kuzikode Connect.
* Future developer infrastructure and hosting platforms.
* Future domain management and business management products.

These may be introduced into the ecosystem later, but they must not become invented services or distract from the current company's actual offerings.

### 3. Mandatory design references: /inspiration-images

The repository contains a directory:

/inspiration-images

This directory contains visual references collected specifically for this redesign.

Every image in this directory MUST be inspected. Do not skip images, arbitrarily select a handful, or ignore references because they do not immediately resemble the existing website.

Your responsibilities:

1. Inventory every image in the directory.
2. Open and inspect each image individually.
3. Identify its distinctive UI/UX ideas, composition, visual patterns, interactions, typography, spacing, navigation, imagery, colour usage and responsive design ideas where applicable.
4. Extract at least one useful design idea from every image.
5. Record these ideas in a Markdown reference-analysis document.
6. Map the extracted ideas to appropriate pages, sections or components in the redesigned website.
7. Combine compatible ideas into a coherent and consistent visual identity.

Create an image-reference traceability document that makes it possible to verify that every supplied image was considered.

Do not copy websites blindly. Adapt the ideas intelligently to Kuzikode's identity, content and functionality.

An image may inspire:

* A hero composition.
* A navigation pattern.
* A service presentation.
* A pricing interaction.
* A portfolio layout.
* A typography treatment.
* An image composition.
* A background treatment.
* A transition or interaction.
* A responsive layout.
* A dashboard or panel interface.

The resulting website must feel like one deliberately designed product, not a collection of unrelated Pinterest designs.

### 4. Mandatory design skills

Inspect and use the following design resources where appropriate:

    npx impeccable install
    npx skills add Leonxlnx/taste-skill
    npx skills@latest add emilkowalski/skills
    npx skills add vercel-labs/agent-skills

Read and apply the relevant instructions from installed skills.

Do not assume installation succeeded without checking. If a skill or tool fails to install, report the failure accurately and continue with the available resources.

Use these skills alongside the supplied images, independent design judgement and frontend engineering expertise.

Do not allow generic AI-generated design patterns to dictate the outcome.

> Installed on 2026-11-12 in `.claude/skills/` (see section B.3). Verify they're present at the start of the work.

### 5. Reference websites

Inspect these websites using Playwright at desktop and mobile viewport sizes.

Primary mobile UI/UX reference: https://www.webdev.co.zw/
Study its mobile experience, navigation, section composition, typography, spacing, image positioning and responsive behaviour.

Pricing and service presentation reference: https://vetech.co.zw/
Study how services, packages, features, pricing and calls to action are presented.

These websites are sources of inspiration, not templates to copy.

You may also research: https://www.awwwards.com/ · https://www.landing.love/categories/agency/ · https://curated.design/inspiration/agency/ ·
https://www.behance.net/ · https://www.siteinspire.com/ · https://www.hoverstat.es/

### 6. Visual identity and design direction

The website must look like a serious, established and capable technology company.

Prioritise: strong visual hierarchy; excellent typography; deliberate composition; professional colour usage; well-balanced
whitespace; high-quality imagery; distinctive section layouts; carefully designed interactions; consistent iconography; strong
visual consistency across all pages.

Avoid: generic AI/SaaS templates; repetitive cards throughout the entire website; excessive gradients and glowing effects; random
decorative images; unnecessary empty space; oversized sections without purpose; poorly aligned content; unprofessional typography;
generic stock-photo compositions; decorative elements that do not contribute to the design.

Compare the available candidate colour palettes and choose one coherent direction that best suits the company's positioning and
supplied visual references. Do not combine all the palettes indiscriminately.

### 7. Complete teardown of the existing UI

Audit the entire existing frontend. Identify and replace weak or outdated: page layouts; navigation; headers and footers; hero
sections; content sections; cards and grids; pricing layouts; buttons and calls to action; forms; icons; typography; responsive
behaviour; transitions and interactions; client-facing panels and dashboard interfaces.

Do not preserve an existing component simply because it already exists. Reuse functionality and useful underlying code where
appropriate, but rebuild the presentation when necessary. The new interface should feel intentionally designed from the ground up.

### 8. Mobile-first engineering: critical requirement

Mobile responsiveness is one of the biggest weaknesses of the existing implementation.

The current approach of simply stacking desktop components vertically on mobile is unacceptable.

Mobile must be designed as its own complete experience, not treated as a compressed desktop layout.

For every page and important component, independently consider mobile composition. Pay particular attention to: mobile navigation
and menu interactions; hero composition and text positioning; typography scaling and readability; image cropping and positioning;
touch-friendly controls; consistent spacing; section transitions; responsive grids; horizontal carousels; pricing navigation and
comparisons; buttons and calls to action; forms and input usability; icons and visual indicators; content density; overflow and
alignment; mobile footer composition.

Use horizontal scrolling, swipeable presentations, selectors, segmented controls and other suitable interaction patterns where they
improve the experience. Do not blindly convert every multi-column desktop layout into a long vertical stack.

Important actions must remain visible and understandable. Do not hide essential information just to make a mobile screen look cleaner.

Test at several realistic mobile viewport sizes, not just one.

### 9. Icons and visual communication

The current interface lacks appropriate icons in important places. Introduce a consistent, professional icon system.

Use icons purposefully for: navigation; service categories; feature explanations; technology capabilities; contact methods; actions
and buttons; status indicators; dashboard navigation; important information and visual cues.

Choose suitable icon families and maintain consistent sizing, stroke weight and visual treatment. Avoid random emoji usage as a
substitute for professional iconography. Icons should improve understanding and navigation, not simply decorate the interface.

### 10. Motion and interaction design

The website must feel polished and responsive. Introduce purposeful, smooth animations throughout the experience, for example:
subtle fade transitions when switching between horizontal carousel items or groups; smooth horizontal carousel movement; animated
navigation indicators; subtle hover and focus interactions; section reveal animations when scrolling; carefully controlled entrance
transitions; smooth dropdown and menu interactions; animated tab and segmented-control transitions; image transitions when changing
showcased projects; refined button feedback and micro-interactions.

For horizontal carousels, avoid abrupt content replacement. Use coordinated fades, movement and appropriate transitions when
changing slides or categories.

Animations should be fast, deliberate and consistent. Do not make the interface feel slow or distracting. Respect reduced-motion
accessibility preferences and ensure interactions remain usable without animation.

### 11. Client-facing panels and dashboard experience

Understand the purpose of the existing panels before redesigning them.

The main client-facing panel is intended for clients whose websites, software or digital solutions Kuzikode designs and develops.
It should communicate a professional technology workspace where clients can interact with their projects and relevant services.
Do not confuse this with an internal company administration interface.

There may be other existing administrative or operational interfaces containing functionality such as email management and other
company operations. Understand their purpose and preserve their existing functionality.

**Panel design language: Linux-inspired.** Explore a refined desktop-environment aesthetic: clean window and workspace layouts;
well-organised side navigation; refined terminal-inspired typography where appropriate; subtle system-status indicators;
professional command-centre presentation; functional information density; consistent window, panel and navigation patterns;
carefully designed dark and light surfaces where appropriate.

The inspiration should come from the clarity, flexibility and technical character of Linux desktop environments. Do not make the
panels look like an actual operating-system clone, cluttered terminal, hacker interface or retro computer theme. They must remain
intuitive, modern, accessible and professional.

Preserve the distinction between the public marketing website, client workspace and internal administrative tools.

### 12. Services and pricing

Preserve all existing service information. Do not invent new services or remove legitimate existing offerings.

Pricing is especially important. **Do not change, invent, estimate or redefine any existing prices, packages, features,
inclusions, exclusions or conditions.** First inspect the current implementation and identify the authoritative existing pricing
information. Improve only its presentation.

Desktop: clear package hierarchy; well-balanced comparisons; features and inclusions presented clearly; make the recommended or
relevant package easy to understand where supported by the existing content.

Mobile: avoid excessively long vertically stacked pricing cards; consider swipeable horizontal cards, package selectors, segmented
controls or other suitable responsive patterns; ensure users can still access all package details and compare offerings.

### 13. Images and content composition

Images must be integrated deliberately. Use them in appropriate contexts: hero compositions; full-width visual sections; editorial
layouts; project showcases; layered compositions; background treatments; service illustrations; relevant supporting content.

Pay attention to cropping, aspect ratios, overlays, positioning and responsive image behaviour. Do not insert images simply to fill
empty space.

### 14. Markdown documentation and planning

Create the necessary project-specific Markdown documents before and during implementation, for example: DESIGN_AUDIT.md,
DESIGN_DIRECTION.md, REFERENCE_IMAGE_ANALYSIS.md, IMAGE_TRACEABILITY.md, UI_UX_RECONSTRUCTION_PLAN.md, RESPONSIVE_DESIGN_SPEC.md,
MOTION_AND_INTERACTION_SPEC.md, PANEL_DESIGN_SPEC.md, IMPLEMENTATION_PLAN.md, QA_REPORT.md. Adapt the filenames and structure to the
existing repository (put them in `docs/redesign/`).

Inspect existing Markdown documentation. Remove obsolete or conflicting design briefs and outdated frontend design instructions where
appropriate. Do not indiscriminately delete technical documentation, setup instructions, licences, legal information or operational
documentation. Keep the documentation useful and consistent with the actual implementation.

### 15. Autonomous multi-agent execution

You are authorised to manage the entire redesign autonomously. Your workflow should include:

1. Audit the repository and existing application.
2. Inventory and inspect every supplied inspiration image.
3. Inspect installed skills and relevant design resources.
4. Inspect reference websites using Playwright.
5. Document the design direction and implementation plan.
6. Identify frontend areas that can be worked on independently.
7. Create specialised agent sessions or delegate tasks where appropriate.
8. Implement the new design system and frontend.
9. Rebuild the pages and components.
10. Integrate the work and resolve inconsistencies.
11. Test desktop and mobile behaviour.
12. Inspect the actual rendered website.
13. Refine weak sections and interactions.
14. Complete final quality assurance.

Delegate work where doing so improves speed and quality, but maintain central coordination. Do not leave partially completed agent
work unintegrated. Do not ask me to approve each stage or make routine design decisions. You are responsible for making the decisions
and delivering the finished result. Only request intervention if genuinely blocked by something that cannot reasonably be resolved
independently, such as missing credentials or an essential external dependency.

### 16. Technical boundaries

This is primarily a frontend UI/UX reconstruction. Preserve existing: backend functionality; APIs and integrations; database
structures; authentication and authorisation; payments; business logic; existing service and pricing data; existing working features.

Do not unnecessarily rewrite or break these systems. You may refactor frontend architecture, components, styles and related frontend
code as required. If a frontend change requires a backend adjustment, investigate carefully and make only the necessary changes. Do not
sacrifice working functionality for visual appearance.

### 17. Visual quality assurance

A successful build is not proof of a successful redesign. Use Playwright and actual browser rendering to inspect the completed website.

Test: every major page; desktop layouts; tablet layouts; multiple mobile sizes; navigation; carousels; transitions; forms; pricing
interactions; client-facing panels; administrative interfaces; existing functional workflows.

Look specifically for: overflow; broken layouts; poor image crops; inconsistent spacing; missing icons; unreadable text; weak
hierarchy; awkward mobile stacking; broken animations; inaccessible controls; inconsistent design patterns.

Take screenshots, inspect them and make further improvements where necessary. Repeat the visual inspection and refinement process
until the result meets the intended quality standard.

### 18. Definition of done

The project is complete only when:

* Every supplied inspiration image has been inspected and accounted for.
* Relevant design skills have been applied.
* The website has a coherent and distinctive visual identity.
* The previous weak UI has been comprehensively replaced.
* Desktop and mobile experiences are both professionally composed.
* Mobile layouts are genuinely responsive, not merely vertically stacked.
* Important interfaces use appropriate icons.
* Motion and transitions are polished and purposeful.
* Pricing and services remain accurate.
* Client-facing panels have a cohesive Linux-inspired design language.
* Existing backend and business functionality still work.
* Browser-based visual QA has been completed.
* Remaining visual and responsive defects have been addressed.

Final objective: Deliver a website and client workspace that look and feel like products built by a serious, premium technology
company. The result must demonstrate strong design judgement, frontend engineering ability and attention to detail without requiring
me to supervise the process.

---

## B. Owner additions and operating rules for the agent

### B.0 CLEAN SLATE: rebuild from zero, never restyle (owner's explicit rule, overrides any plan)
The owner's words: *"We are not fixing but starting afresh completely. Just the UI/UX."*
- **The visual layer is rebuilt from scratch.** Every page, layout, section and component the user sees (public site, client
  workspace, admin, documents/checkout, emails' web views) gets **new markup, new structure and new styles** designed from the new
  direction. **"Restyle", "reskin", "re-theme", "adapt the existing component" are not allowed** as a strategy. Don't open an old
  component and change its classes. Write the new one.
- **Build the new UI in a new tree:** `src/ui/` (design system primitives, icons, motion utilities), `src/ui/public/`,
  `src/ui/workspace/`, `src/ui/admin/`, and new layouts (`src/layouts/v2/` or replace the files with new contents written from scratch).
  Pages are rewritten to compose the new components. The page's **information architecture and section order come from the new
  specs, not from the old page.**
- **What may be reused (logic only, never presentation):** server services, API routes, DB/repositories, Zod schemas, auth,
  payments, data loaders in page frontmatter, form submit handlers and endpoint contracts, validation, pure utility functions,
  i18n/content strings from the CMS. If an old React island mixes logic and markup, extract the logic into a hook or module and write
  new markup around it.
- **Delete the old presentation code** (old components, old layouts, old CSS/tokens) once nothing references it. By the end of R6,
  `src/components/` legacy UI must be gone (or contain only code that was rewritten under the new system). Track this in
  `IMPLEMENTATION_PLAN.md` with a "legacy removed" checklist.
- **Test for freshness:** for each rebuilt page, put the old "before" screenshot next to the new one. If a visitor could recognise it as
  the same layout with new colours, it isn't done. Redesign it.
- Behaviour, data, URLs, form fields, pricing values and functional flows stay identical (the e2e and pricing-accuracy tests prove it).

### B.0b COLOUR: no generic blue (owner's explicit rule)
The owner's words: *"I don't like the original colour accents… I don't like the original colour that's most used by most vibe-coded
websites."* So:
- **Banned as the brand/primary/accent colour:** blue, cobalt, royal/electric blue, indigo, violet, purple, periwinkle (roughly hue
  200°–290°), including the old `#2747E8` and the R1.1 cobalt `#1F44E0`/`#2F57FF`. **Navy-led layouts** (navy hero, navy panels,
  navy footer as the identity) are also out, because that is the same look. Blue may appear only inside photographs and in functional
  status colour if truly needed (prefer neutral or other hues for "info").
- **Choose ONE direction from the owner's references** (or a refined take on the same idea), e.g.: **black/near-black + lime**
  (IMG_5054/5055/5065 Creatix), **deep green + emerald/mint** (IMG_5056 Xenon Bank), **monochrome editorial + one distinctive accent**
  (IMG_5066/5053, e.g. a warm accent such as amber, ochre, terracotta or a Zimbabwe-inspired earth tone), or **teal** (IMG_5015).
  Neutrals (near-black, warm/cool greys, paper and off-white) carry most surfaces; the single accent is used with restraint.
- Must pass WCAG AA contrast in light and dark surfaces, and work for the Linux-inspired workspace as well as the public site.
- Record the comparison and choice in `DESIGN_DIRECTION.md` (replace the cobalt section) and in `DECISIONS.md`.

### B.0b+ MULTI-ACCENT PREMIUM PALETTE (owner, 2026-11-12, refines B.0b)
The owner: *"The most premium UIs have different accent colours that work together, like in my examples, we had 3, but you can even go
above."* The single green family chosen in R1.5 ("sign green + verge + mint") is one accent in three shades and reads as road
signage, not premium. Replace it with a **disciplined multi-accent system (3–5 accents)**:
- **Base carries 80–90% of every screen:** a rich neutral (near-black / warm ink, bone or warm off-white, refined greys). Accents
  appear in small, deliberate doses. That restraint is what makes it feel premium.
- **Accents are tuned as one family:** similar chroma and lightness (check in OKLCH), all passing WCAG AA where used for text or controls.
  None from the banned blue/indigo/violet range (B.0b); teal and cyan are allowed.
- **Every accent has a job:** e.g. one per service division (cycled consistently on cards, icons, the division page), colour-coding of
  pricing tiers, data viz and status in the client workspace, and **one accent reserved for the primary action**.
- **Compare at least 3 multi-accent palettes on the chosen concept** (render the home hero + services + pricing at 390 and 1440 for each,
  as boards), then pick one and record why in DESIGN_DIRECTION.md. Include these candidates:
  1. **Zimbabwe-earth (recommended by the owner's planning session):** near-black + bone base, with **deep emerald**, **saffron/gold**,
     **clay/terracotta red** and **teal**, refined (not flag-bright), echoing the national colours without being literal.
  2. **Creatix-inspired:** black + bone with **lime**, **coral** and **cyan** accents (IMG_5054/5055/5065).
  3. One palette of the agent's own derived from the references.

### B.0e PREMIUM HERO (owner, 2026-11-12)
"The hero needs to be premium." On every breakpoint the hero must have: proportionate, confident typography (B.1a limits on phones);
**a high-quality image or a crafted product/workspace composition with real depth** (layering, crisp hairlines, fine detail, a sense of
craft); one strong primary CTA (+ at most one quiet secondary); subtle purposeful motion (text reveal, gentle image parallax or shift,
reduced-motion safe). On phones it is **visual-led**, never a solid colour block with text. It must clearly differ from the old hero and
from the generic "big headline + two buttons" template. Judge it with the B.0d board and reviewer: *"Does this look like a premium,
established technology company?"*

### B.0c REMOVE the "Start a project" wizard (owner's explicit rule)
The owner's words: *"Remove that start-a-project thing. This is a website where we offer our web design services etc. with pricing,
not for people to come and start projects."*
- **Delete from the public experience:** the `/start-a-project` page, the `StartProjectWizard` component, the header/nav "Start a
  project" button, and every "Start a project" or "Get started" link to the wizard (pricing cards, industries, home, footer, search
  results, sitemap, /dev/ui). Remove wizard-only frontend code (`src/shared/wizard.ts` if nothing else needs it).
- **301-redirect** `/start-a-project` (and any query variants) to `/contact` so old links and shared URLs keep working.
- **Replace the calls to action** with the site's real purpose: services and pricing. Primary CTAs become e.g. **"Get a quote"**,
  **"Request this package"** or **"Talk to us"**, all leading to the **contact/enquiry form** with the service or package preselected
  (a query parameter the contact form reads), plus WhatsApp where configured. The header's primary action becomes "Get a quote" or
  "Contact".
- **Backend stays safe:** keep the enquiries API and data. Existing enquiries of kind `wizard` remain readable in admin (old data).
  Only remove the wizard-specific endpoint/schema if nothing else uses it, and keep tests green (update or remove the wizard e2e/integration
  tests with a note in DECISIONS.md). Consultation booking and the contact form stay.

### B.0d VISUAL CONCEPT GATE and ANTI-GENERIC RULES (owner, 2026-11-12)
The owner reviewed the first build (navy hero, blue pill buttons with round arrow knobs, pill tab bar) and called it **"a dead UI…
not referencing my images and not using any skills"**. It was the generic AI-SaaS look. Therefore:

**1. Images are design inputs, not text notes.** Before designing any page, section or component, **open (Read) the actual
reference image files** mapped to it in `IMAGE_TRACEABILITY.md`, and name in the commit/PR notes which images and which specific
traits (composition, type scale, crop, rhythm, interaction) the design takes from them. Text summaries alone are not enough.

**2. Concept gate before any foundation code (R1.5).** Build **3 genuinely different full home-page concepts** (desktop and mobile)
as static HTML/CSS prototypes in `design/concepts/<a|b|c>/`. Each is composed from named reference images and uses a non-blue palette
(B.0b). Render each with Playwright at 390 and 1440 and make a **comparison board** image per concept: concept screenshots next to
the reference images that inspired it. Critique each with `impeccable` (critique/craft-floor) and the `design-taste-frontend` checker,
and score them against the anti-generic list below. Pick the strongest and push the boards to `docs/screenshots/redesign/concepts/`.
Then send the owner a push notification with the links (FYI only, don't wait for a reply). The tokens and components are derived
**from the chosen concept**, not invented first.

**3. Banned generic patterns** (unless a reference image clearly calls for it, in which case cite it):
pill-shaped buttons everywhere; a circular arrow "knob" inside buttons; navy/dark hero + bright blue CTA; centred hero with two
buttons and a subtitle; pill tab bars as the main navigation device; eyebrow labels above every heading; uniform 3-column card grids
repeated down the page; icon-in-rounded-square feature grids; gradient blobs, glows, glassmorphism; generic "trusted by" strips;
stock smiling-team photos; identical section rhythm on every page; default Tailwind/shadcn look.

**4. Distinctiveness test (every page, R4–R6).** Make a side-by-side board: new screenshot (390 + 1440), its reference images, and the
old "before" screenshot. A fresh reviewer subagent (`impeccable-finish-reviewer`, given only the board, BRIEF B.0b/B.0d and the
direction) must answer: *Would a design lead call this generic or template-like?* and *Does it visibly use the referenced ideas?* If it
fails either question, redo the page before ticking the task. Store boards in `docs/screenshots/redesign/boards/`.

### B.1 Mobile is the priority, and both are 100%
More than 75% of visitors use phones. Design and verify **mobile first**, at several real sizes, on every UI change. Desktop must
still be 100% on point; neither may be an afterthought.

### B.1a MOBILE HARD LIMITS (owner, 2026-11-12: "similar hero from before and weirdly large fonts on mobile; I'm emphasising mobile view")
Measured problem in concept "Route" at 390 px: H1 40 px over 4 lines (11-word headline), section titles ~32 px, the hero again a
full-bleed solid-colour block with a headline, a paragraph and a stack of 6 bordered rows (the old hero structure in a new colour), and a
button label wrapping onto two lines. These limits are **mandatory** at 360–430 px wide and enforced by an automated test:

| Element (phones 360–430 px) | Limit |
|---|---|
| H1 | **28–34 px**, weight ≤ 700, line-height 1.05–1.15, **max 3 lines**. Write a **short mobile headline (≤ 7 words)** if the desktop one is longer |
| H2 / section title | **22–26 px**, max 3 lines |
| H3 / card title | 17–20 px |
| Body | 15–16 px, line-height 1.5–1.6. Captions/meta 12–13 px |
| Buttons | 15–16 px text, **never wrap** (one line), height ≥ 44 px |
| Side padding | 16–20 px. Section spacing 48–72 px (not 100 px+) |
| Mono/label text | 11–13 px, used sparingly |

**Hero (phones):** the first screen (390×844) must show the headline, a one-line value statement, the primary CTA **and a visual**
(photo, product/workspace UI fragment or a designed composition). **Banned:** the old hero structure, i.e. a full-bleed solid-colour
block holding only a big headline + paragraph + a vertical list of boxes. Hero height ≤ ~85 svh. Compare your first screen side by side
with the old "before" home and with webdev.co.zw mobile. If a visitor would say "same layout, new colour", redo it.

**No long stacks:** more than 3 similar items in a row on mobile become a **horizontal swipe track with the next card peeking**
(scroll-snap), a segmented control, or a compact 2-column grid. Never a column of 6 bordered boxes.

**Automated guard (add in R2.x, run in CI):** a Playwright spec visits every public page at 360, 390 and 430 px and fails if: any H1 is
> 34 px or > 3 lines; any H2 > 26 px; body text < 15 px; any button label wraps; horizontal overflow exists; the first viewport of the
home page lacks a CTA or an image/visual element.

### B.2 Playwright visual loop (mandatory on every UI change)
- Viewports: **360×740, 375×667, 390×844, 412×915, 430×932** (phones), **768×1024, 1024×1366** (tablets), **1280×800, 1440×900,
  1920×1080** (desktop).
- For each changed page or component: screenshot at least 375, 390, 430, 768 and 1440 (all ten for major pages), **Read the
  screenshots**, list the defects you see, fix them, and re-shoot until clean. Check horizontal overflow programmatically
  (`document.documentElement.scrollWidth > innerWidth` must be false), check tap targets (44 px or more), and also test with
  `prefers-reduced-motion: reduce`.
- Exercise interactions in the browser (menus, carousels and swipes, tabs and segmented controls, pricing selectors, forms, panel
  navigation) and record short notes in `docs/redesign/QA_REPORT.md`.
- Save curated before/after screenshots to `docs/screenshots/redesign/` (small, compressed). Don't commit raw screenshot dumps.

### B.3 Installed skills (use them)
In `.claude/skills/`: **impeccable** (start with it for direction, critique, audit and polish; its engine runs `impeccable detect`;
helper agents live in `.claude/agents/`), **design-taste-frontend** (anti-slop rules plus the browser finish gate), **emilkowalski**:
`emil-design-eng`, `animate`, `choreograph`, `improve-animations`, `review-animations`, `find-animation-opportunities`,
`remove-animations`, `animation-performance`, `animation-vocabulary`, `gestures`, `mobile-native`, `apple-design`, `break-ui`,
`pick-ui-library`, and **vercel**: `web-design-guidelines`, `vercel-react-best-practices`, `vercel-composition-patterns`,
`vercel-react-view-transitions`, `writing-guidelines`. Also `pen-design` (optional mockups). Record which skills shaped which decisions
in `DESIGN_DIRECTION.md`. Note: the stack is Astro + React islands on Cloudflare Workers. Ignore any skill advice that assumes Next.js
or Vercel hosting.

### B.4 Images: request them from the owner, never block on them
Existing site images may not fit the new direction. Reuse the ones that do. For the rest:
1. Design every section so it works **with a strong interim treatment** (typography, a composition from existing imagery,
   CSS/SVG graphic, gradient-free texture). **Never a placeholder box, never lorem, never a broken image.**
2. Write precise generation prompts into **`docs/redesign/IMAGE-REQUESTS.md`** (format in that file): slot id, page and section,
   purpose, aspect ratio(s) for desktop and mobile crops, file name, and a complete self-contained prompt that matches the chosen visual
   direction. Batch them (aim for 5–15 per batch), mark the batch "ready for owner", commit, and **send the owner a push notification**
   (PushNotification tool, if available) saying a batch of image prompts is ready, with the GitHub link to the file.
3. **Keep building.** Never wait for images.
4. The owner generates them in the Gemini app and delivers them to **either** `design/inbox/` in the repo (small batches) **or** the
   Cloudflare R2 bucket **`images`** under the prefix **`incoming/`** (large batches). Read only: never delete or modify anything in that
   bucket. At the **start of every session** check both places (`git pull`, then list R2 objects with prefix `incoming/` via the
   Cloudflare API) and process any new files: inspect each image (Read it), check quality (hands, faces, text artefacts, crop),
   optimise with `scripts/images/process.mjs` (adapt it to read slot metadata from IMAGE-REQUESTS.md instead of the removed
   PROMPT-PACK.md), place it, and mark the request "delivered". Remove processed files from `design/inbox/`. Track processed R2 keys in
   `design/images/manifest.json` so nothing is imported twice.
5. Honesty: AI-generated people are illustrative only. Never label them as Kuzikode staff, founders, clients or testimonial authors.
   No fake logos, client names or statistics.

### B.4a IMAGERY ALLOCATION: SVG for services, photos only where they make impact (owner, 2026-11-12)
The owner: *"Revert those image prompts in most sections, e.g. service types. It's neater to draw SVGs. Images should appear in heroes,
mid-page hero backgrounds and styled sections."*
- **Custom SVG illustrations (drawn in code, no photos)** for: service divisions and service types, sub-services, features and benefits,
  process steps, industries, technologies, pricing-tier visuals, empty states, 404/500, and workspace/admin illustrations. **One
  illustration system:** a single drawing style (e.g. geometric line + fill compositions, or crafted isometric UI fragments), a consistent
  stroke weight and corner logic, the multi-accent palette with **each division keeping its own accent** (B.0b+), and subtle, reduced-motion-safe
  hover/scroll animation where it adds meaning. **Banned:** generic clip-art, unDraw/Humaaans-style people, mismatched stock icon packs
  pretending to be illustrations, emoji. Inline SVG or optimised SVG files with `aria-hidden` (or a title when informative). Specify the
  system in `DESIGN_DIRECTION.md` and show it on the /dev/ui gallery.
- **Photographs only for high-impact placements:** (1) page heroes (home, about, services index, work and careers where it fits), (2)
  **mid-page full-bleed image bands/backgrounds** behind text (1–2 per long page, with designed overlays for legibility on mobile and desktop),
  (3) **styled editorial sections** (About story, How we work, careers culture), (4) real portfolio screenshots. Nowhere else.
- **Image requests:** mark every per-service/division photo request in `IMAGE-REQUESTS.md` as `superseded: SVG instead (B.4a)`, and write a
  **new, smaller batch (≈ 6–10 images)** only for the placements above, matching the chosen multi-accent palette and premium hero rules (B.0e),
  with desktop + mobile crop guidance. Notify the owner. Interim treatments still apply until the photos arrive.

### B.5 Delegation
Parallelise inside your session with **subagents** (the Agent tool, including the impeccable agents) for independent areas (e.g.
the reference-image analysis split into batches, page groups, the panel design). The orchestrating session reviews and integrates
everything before pushing. Don't run several build sessions in parallel against `main`: it causes merge conflicts and burns the
owner's Claude Pro usage limits twice as fast.

### B.6 Pricing source of truth
Before touching pricing UI, write in `DESIGN_AUDIT.md` exactly where prices come from (D1 seeds / package tables / admin-managed
data) and add a Playwright or integration test that asserts every displayed package price, feature and inclusion equals the stored data.
Presentation only. Never edit the data.

### B.7 Scope guard
Kuzikode Hosting, Business Suite, Connect, developer infrastructure, domain and business-management products are out of scope.
If the existing site already shows Business Suite as "In Development", keep it modest and clearly labelled, and never promote it as a
service.
