# Reference image analysis

All 29 files in `/inspiration-images` (the empty `readme.md` is not an image) were opened and inspected one by one on 2026-11-12, in three
batches by subagents, then reviewed together by the orchestrating session (contact sheets of the key images were re-read directly).
Each entry records composition, typography, colour, navigation, interaction, responsive ideas, imagery and concrete ideas for
Kuzikode. The per-image decision and target live in [IMAGE_TRACEABILITY.md](IMAGE_TRACEABILITY.md); the chosen direction in
[DESIGN_DIRECTION.md](DESIGN_DIRECTION.md).

**Common pattern across the set:** blue is the dominant hue (periwinkle → cobalt → electric blue) on either clean light grounds or
deep navy; pricing references (5058, 5060, 5070, 5071, 5072) agree on a filled recommended plan, a period toggle and a comparison
table; mobile references (5057, 5063, 5056, 5066) agree on text-first heroes, inset rounded sections and edge-peeking horizontal rails.
**Recurring trap:** most marketing templates lean on fabricated proof (stats, logo walls, Trustpilot, awards, CEO signatures). None of
that is usable here (PRODUCT.md: evidence on hand).

## Images 1–10 (IMG_5013 – IMG_5051)

### IMG_5013.jpeg — Periwinkle "Select a payment method" checkout card
- **What it is:** Desktop checkout screen for an event ticket (I/O-style), a single large rounded card floating on a patterned periwinkle background. Bill summary bar on top, method list left, live card form right.
- **Composition:** One rounded container (~24px radius) with generous inner padding. Top: logo left, pill CTA right. Then a full-width outlined "Your bill" strip (label left, line items in one row). Below, a 2-column split: heading + stacked method rows + pill submit on the left, a big blue credit-card-shaped form on the right. Centered small footer line.
- **Typography:** Two-family pairing: a geometric/grotesk sans (DM Sans-like) for big headings, ~44px medium, tight leading; a monospace (Space Mono/DM Mono-like) for body, labels, prices and buttons, small sizes, normal case. Strong scale contrast heading vs. mono body. The mono gives a "receipt/terminal" feel.
- **Colour:** Light, monochrome blue. Background pattern #B9C2F2/#C9D0F5, card surface #ECEDF2 (near-neutral grey), primary blue #3557E0, card panel gradient #4A6CF0 → #3B5BEF, selected row fill #B8C3F3, outlines 1px #3557E0.
- **Navigation:** n/a (logo + single pill CTA only).
- **Interaction/motion cues:** Selectable list rows with chevrons, the selected row is filled; the right panel swaps per method (card form shown). Implied tab-like method switching.
- **Responsive/mobile ideas:** Method rows are already full-width tap targets (~56px tall) that stack naturally; on phone the card panel would move below the list. The bill strip should collapse to a two-line summary.
- **Imagery/iconography:** No photos. Thin outline hexagon logo, small brand chips (payment logos in white tiles), subtle swirl/ellipse line art inside the card panel, scallop pattern background.
- **Ideas for Kuzikode:**
  - Invoice payment page (client portal): a bill strip at the top ("Invoice INV-0042 · Website package · USD 450") in mono, then method rows for Paynow / EcoCash / OneMoney / card as full-width selectable rows with gateway chips.
  - Use a mono face for invoice numbers, amounts and reference codes across the portal (good fit for a software company; fixes digit alignment).
  - Pill outline buttons with 1px brand stroke as a secondary button style.
- **Verdict:** Adapt: the bill strip + selectable method rows + mono for money fit our Paynow checkout; drop the decorative pattern background and skeuomorphic card.

### IMG_5014.jpeg — AceCoinPay modal checkout with receipt-ticket summary
- **What it is:** Desktop payment modal (fintech, Dribbble-style) over a Windows 11 bloom wallpaper. Form on left, a vertical "ticket" order summary on the right with a floating card graphic.
- **Composition:** Wide modal, ~60/40 split. Left: logo + countdown timer in segmented digit tiles, then label/description rows with inputs aligned right (label column + input column). Full-width bright blue Pay button. Right: grey rounded panel styled as a tear-off receipt (notches on the sides, dashed separator) with key/value rows and the total big at the bottom.
- **Typography:** Clean sans (Inter/SF-like). Labels semibold ~14px dark, helper text ~11px grey beneath. Total uses large bold integer with small decimals ("549.99" with smaller ".99"). Numbers centered inside small inputs.
- **Colour:** Light. White #FFFFFF surface, panel #F2F5FA, primary blue #1463F5, dark navy text #1B2440, timer tiles #1E2A44, muted grey #8A93A6.
- **Navigation:** n/a (close X only).
- **Interaction/motion cues:** Session countdown timer, inline "Edit" link, verified checkmark on card field, password/keypad icon in fields, focused field gets a blue border and light-blue fill.
- **Responsive/mobile ideas:** The label-with-helper-text then input pattern stacks well on phones; the receipt panel should become a collapsible "Order summary" header above the form on mobile.
- **Imagery/iconography:** Floating white card mock with chip and contactless icon; small filled icons inside fields; receipt notch shapes.
- **Ideas for Kuzikode:**
  - Portal invoice detail: render the summary as a "receipt" panel (notched edges, dashed divider, key/value rows, big total with smaller cents) — nice brand moment for invoices and receipts.
  - Paynow pending state: a calm status timer/poll indicator ("waiting for EcoCash confirmation") using digit tiles.
  - Field pattern: bold label + one-line helper under it, focus state = brand border + tinted fill.
- **Verdict:** Adapt: the receipt panel and focus states; reject the countdown pressure and card mockup (we don't take raw card data).

### IMG_5015.jpeg — Classic 3-step checkout with stepper and teal CTA
- **What it is:** Desktop e-commerce payment step (ildesign shot). White card on pale blue-grey, horizontal stepper on top, logo radio tiles, compact form, totals table, full-width teal button.
- **Composition:** Centered card, header band with 3-step progress (done check / current number / upcoming grey), divider, then a narrower centered content column (~520px): radio + logo tile row, 2-column inline label/input grid, checkbox, grey totals box, CTA.
- **Typography:** Plain sans (Open Sans-like), small sizes, uppercase tracked step labels and button label ("CONFIRM PAYMENT"), bold totals row in caps.
- **Colour:** Light. Background #E3ECEF, card #FFFFFF, CTA teal/mint #1FE6B6, stepper accent #2EC4A0, totals box #F6F7F8, borders #D9DDE0, text #5A5F66.
- **Navigation:** Stepper acts as progress navigation.
- **Interaction/motion cues:** Stepper states, radio selection on logo tiles, info tooltip on CVC, select dropdowns.
- **Responsive/mobile ideas:** Stepper should collapse to "Step 2 of 3" + progress bar on phones; the inline label-left grid must become stacked labels.
- **Imagery/iconography:** Real payment brand logos in bordered tiles, thin outline check in stepper.
- **Ideas for Kuzikode:**
  - Quote request / project brief wizard: 3-step stepper (Your details → Project scope → Review & send) with done/current/upcoming states.
  - Checkout totals box (subtotal, VAT if applicable, total) in a tinted block directly above the pay button.
- **Verdict:** Adapt the stepper and totals block only; reject the dated small-caps styling, low-contrast grey text and inline-label grid (fails mobile and AA).

### IMG_5016.jpeg — Green "PAYMO" card-over-panel payment concept
- **What it is:** Desktop/concept payment screen for a Nigerian (Naira) mobile-money style service: a green card overlapping a light panel with totals and a phone-number field, on a saturated concentric-circle green background.
- **Composition:** Layered depth: oversized rounded light panel, a card hanging off its left edge with heavy shadow, totals + phone input + checkbox + small pill button on the right. Decorative network-node line art.
- **Typography:** Rounded geometric sans (Nunito/Quicksand-like), light grey labels, medium values, large total; low contrast throughout.
- **Colour:** Saturated green. Background #4FB000 → #3E9A00 radial rings, card #2F8A00 → #3FA10A, accent neon #3BFF3B (VISA mark), panel #ECECEC, text grey #8C8C8C, button #2F7D0A.
- **Navigation:** n/a.
- **Interaction/motion cues:** Static; parallax-able layered card implied.
- **Responsive/mobile ideas:** Phone-number-first payment (country code + number) is the right primary input for African mobile money; on phones the card graphic should be dropped entirely.
- **Imagery/iconography:** Plexus/network node illustration (clichéd "tech" motif), Greek-key pattern corner.
- **Ideas for Kuzikode:**
  - EcoCash/OneMoney Paynow express checkout: lead with a large phone-number input (+263 prefix) and a clear total breakdown (subtotal, gateway fee, total) — matches how Zimbabweans actually pay.
  - Show fees transparently as a separate line item before total.
- **Verdict:** Reject the visual (low-contrast grey text, plexus cliché, loud green); adopt only the phone-number-first mobile money flow and fee line.

### IMG_5017.jpeg — "ninth" split-screen sign-up with step cards
- **What it is:** Desktop onboarding/sign-up for a fintech-ish product: left half a blue gradient hero panel with headline and 3 step cards, right half a clean form.
- **Composition:** 50/50 split inside a white rounded frame on charcoal. Left panel bottom-aligned content: pill badge, big headline, subline, row of 3 equal step cards (active one white, others frosted translucent). Right: centered title, stacked fields in soft grey fills, 2-col row for name/username, password rules, primary button, "or" divider, Google button, legal text.
- **Typography:** Modern grotesk (Inter Display / General Sans-like), headline ~48px regular-medium with tight tracking, white on blue; form labels 13px semibold; small grey helper.
- **Colour:** Left gradient #1F3FBF → #4FA9F5 → #5CD0FF with deep #1A2A9A corner; form button #1D4ED8; field fill #F5F6F8; text #111318; frame bg #2A2A2A.
- **Navigation:** n/a (logo only).
- **Interaction/motion cues:** Step cards (current highlighted), inline valid checkmark on username, password visibility toggle, frosted glass cards.
- **Responsive/mobile ideas:** On phone the blue panel should shrink to a short header band (logo + "Step 1 of 3"), form full-width; filled grey fields (no borders) read well on small screens with 48px height.
- **Imagery/iconography:** No photos; soft blurred gradient as imagery; minimal logo mark.
- **Ideas for Kuzikode:**
  - Client portal login / invite-acceptance page: split layout with a brand gradient panel listing the 3 onboarding steps (Accept invite → Set password → View your project), form right; stacked on phone.
  - Filled input style (soft grey fill, no border, brand ring on focus) for portal forms.
  - Inline validation ticks and password rules shown before submit.
- **Verdict:** Adopt for the portal auth/onboarding screens (split panel + step cards), with our own brand gradient and no emoji.

### IMG_5018.jpeg — Minimal two-column checkout (address + payment + summary)
- **What it is:** Desktop checkout in a shadcn/Tailwind UI style: bordered white cards on near-white, form cards left, sticky order summary right.
- **Composition:** 12-col grid, ~7/5 split. Left: "Shipping Address" card and "Payment Method" card stacked; right: "Order Summary" card with thumbnail, line items, divider, total, full-width button. 3-up row of city/state/zip, 3-up payment-method tiles with icons.
- **Typography:** Clean sans (Inter/Geist), 20px semibold card titles, 14px labels, grey placeholders; amounts in monospace (right-aligned, tabular).
- **Colour:** Light. Page #F8F9FB, cards #FFFFFF with 1px #E5E7EB borders, primary indigo #5146E5 (button gradient #6157F0 → #4B3FE0), text #111827, muted #6B7280.
- **Navigation:** n/a.
- **Interaction/motion cues:** Selectable method tiles (selected = 2px indigo border + indigo icon/label), dropdown selects.
- **Responsive/mobile ideas:** Summary card should move to top as a collapsible bar on phones, with the CTA sticky at the bottom; 3-up method tiles still fit at 360px wide as icon-over-label tiles.
- **Imagery/iconography:** Lucide-style 1.5px stroke icons (card, wallet, dollar); single product thumbnail.
- **Ideas for Kuzikode:**
  - Package checkout (pricing → pay): left form card (billing details), right sticky summary card (package name, deposit vs. full amount, total), CTA in summary.
  - Payment method tiles: icon-over-label tiles for "Paynow (EcoCash/OneMoney)", "Card via Paynow", "Bank transfer", selected = brand border.
  - Monospace tabular figures for all money columns in invoices and admin tables.
- **Verdict:** Adopt as the baseline structure for checkout and portal forms (it is the most usable layout in the batch); brand it with our palette.

### IMG_5048.jpeg — STRATECH engineering firm homepage (navy, serif hero)
- **What it is:** Desktop homepage mock for an engineering/construction company (AI-generated, lorem ipsum visible). Navy theme with night skyline photography.
- **Composition:** Full-bleed photo hero with left-aligned serif headline, subline, small CTA; three image-top service cards overlap the hero bottom edge; then a light split section (About photo left / Expertise 2x2 icon grid right); then navy "Featured Projects" section with heading + intro on one row and 3 image cards.
- **Typography:** Serif display (Cormorant/Libre Caslon-like, regular weight, ~56px) for the hero headline, sans (Inter-like) for nav, cards and body. Title Case section headings.
- **Colour:** Dark-dominant. Navy #0F2457 / #13306E, deep blue #1A3A8A, CTA blue #1E6BD6, light section #EEF1F6, white text.
- **Navigation:** Horizontal top nav, active item underlined, solid blue "Contact" button right.
- **Interaction/motion cues:** Card "Discover More" buttons; overlapping cards imply scroll reveal.
- **Responsive/mobile ideas:** Overlapping card row would become a horizontal snap carousel or stacked list on phones; the hero photo needs a darker gradient scrim for text.
- **Imagery/iconography:** Blue-graded twilight cityscape photography (stock-like), outline duotone line icons.
- **Ideas for Kuzikode:**
  - Home hero: cards overlapping the hero's bottom edge is a strong rhythm device — use it for the 4 service pillars (Software, Web, AI & Automation, Cloud).
  - Section heading + one-line intro on the same row on desktop (heading left, copy right), stacked on mobile.
- **Verdict:** Adapt the hero-overlap card rhythm only; reject the generic skyline stock photography, serif-on-photo corporate look and filler copy.

### IMG_5049.jpeg — SKYSTRUCTURE infrastructure homepage with stat row
- **What it is:** Desktop homepage mock (AI-generated, lorem) for an infrastructure firm, same navy-serif genre as 5048.
- **Composition:** Full-bleed photo hero; below, a 3-column band that rises into the hero (About / Expertise 2x2 / Recent Projects stacked thumbnails), with the middle column raised higher as a featured card; then a light "Company Overview" split with three bordered stat tiles and an office photo.
- **Typography:** Bold serif display (~64px, heavy) hero; sans for UI; stat numbers in a light serif ("+350").
- **Colour:** Navy #0D1F4D → #1B3C86, CTA #2F7BEA, light #F1F3F7, white.
- **Navigation:** Top nav with underline active state and pill "Get Started" button.
- **Interaction/motion cues:** Raised centre column suggests emphasis; static otherwise.
- **Responsive/mobile ideas:** Three-column band stacks into three sections; stat tiles become a 3-up compact row or horizontal scroll.
- **Imagery/iconography:** Glass-tower and interior stock photography, thin blue outline icons.
- **Ideas for Kuzikode:**
  - Stat tile row pattern is fine structurally, but only with real numbers we can defend (e.g. delivery time, response SLA, packages from USD X) — never invented "+350 projects".
  - Raised middle card as a "recommended" emphasis on the pricing tiers.
- **Verdict:** Reject the main idea (fabricated stats, stock skyline, corporate genre are off-brand for a young Zimbabwean studio); keep only the raised-centre emphasis for pricing.

### IMG_5050.jpeg — CodeNova IT solutions homepage (dark navy, photo-heavy)
- **What it is:** Desktop homepage for an IT services company: utility top bar, nav, dark hero with tech-gears photo, floating stat card with person, about split with stat badge, dark services grid of 4 photo cards.
- **Composition:** Utility bar (address, email, hours, socials) → white nav bar → dark rounded hero (left copy, right image, stat card cut into bottom-right corner) → light about section (photo with overlapping "1M+" stat card and carousel arrows, text right with pill tag, checklist, two credential items) → dark services section (centered pill label + title, 4-up cards) → next section.
- **Typography:** Sans (Inter/Roboto), bold ~32px headings, underlined keyword in the hero headline, small pill "eyebrow" labels (white on dark / dark on white).
- **Colour:** Navy-black #0A1128 / #0B1630, accent blue #2B6CE6, light #F2F4F7, white cards.
- **Navigation:** Utility bar + horizontal nav with filled active pill, phone CTA on the right.
- **Interaction/motion cues:** Carousel prev/next circular arrows, hover cards implied.
- **Responsive/mobile ideas:** Utility bar should disappear on phones (put phone/WhatsApp in the menu sheet); services 4-up → 1-col cards or 2-up at tablet.
- **Imagery/iconography:** Stock people-at-computers photos, glowing gears illustration; certification/award badges.
- **Ideas for Kuzikode:**
  - Small pill eyebrow labels ("Services", "How we work") above section headings for scanability.
  - A cut-in card at the hero corner, used for something true (e.g. "Typical reply within 1 business day" or a WhatsApp contact), not a fake stat.
  - Service cards: image/visual top, title, two-line description, consistent height in a 4-up grid.
- **Verdict:** Adapt pill eyebrows and the corner cut-in card; reject fabricated stats ("1M+ customers", awards), utility bar clutter and stock tech imagery.

### IMG_5051.jpeg — "editech" Data Science consulting theme (purple/indigo, diagonal crops)
- **What it is:** Phone-photographed long desktop page of an IT/data-science consulting template (ThemeForest style): diagonal image hero, services carousel, diamond-crop about section, purple-gradient "why choose us" band.
- **Composition:** Thin utility bar + nav; hero with left headline and right photo sliced by diagonal indigo shapes; services section with heading left/intro right and a horizontal card carousel bleeding off both edges; about with diamond-masked photos and a "1.5K" chevron badge; full-width purple-to-magenta gradient band with 4 icon cards; video thumbnail block.
- **Typography:** Geometric sans (Poppins/Outfit-like), large light-to-regular headings, small uppercase tracked eyebrows in accent colour.
- **Colour:** Indigo #4B4FC4 / #5A5FD6, purple-magenta gradient #4A2FB8 → #A23BD6, hot pink accent #E9488A, white sections, dark text #1A1A2E.
- **Navigation:** Top nav with search and "Get a quote" button.
- **Interaction/motion cues:** Horizontal services carousel with arrow buttons and peeking cards, video play button.
- **Responsive/mobile ideas:** Edge-bleeding horizontal carousel with peeking next card is a good phone pattern (scroll-snap) for services; diagonal crops become awkward at narrow widths.
- **Imagery/iconography:** Stock team photos, diagonal and diamond masks, hexagon-filled pink icon badges.
- **Ideas for Kuzikode:**
  - Services on mobile: horizontal scroll-snap carousel with the next card peeking (~85% width cards), arrows only on desktop.
  - Heading-left / intro-right section header (repeats 5048), confirming it as a pattern.
- **Verdict:** Reject the template look (diagonal/diamond masks, purple-pink gradient, stock photos read as a ThemeForest theme); adapt only the peeking scroll-snap carousel.

---

**Batch palette candidates.**
1. *Periwinkle mono-blue (IMG_5013 + 5017):* surface #ECEDF2, tint #C9D0F5, primary #3557E0, deep #1A2A9A, gradient #1F3FBF → #5CD0FF, ink #111318 — coherent, calm, techy, pairs well with a mono accent face.
2. *Neutral SaaS + indigo (IMG_5018 + 5014):* page #F8F9FB, card #FFFFFF, border #E5E7EB, ink #111827, muted #6B7280, primary #5146E5 (or blue #1463F5), panel #F2F5FA — the most usable, accessible base for portal and checkout.
3. *Deep navy corporate (IMG_5048/5049/5050):* navy #0A1128 / #0F2457, mid #1B3C86, action #2B6CE6, light #EEF1F6 — strong contrast for dark hero bands, but generic; use sparingly as a dark section colour rather than the brand identity.

## Images 11–20 (IMG_5052 – IMG_5062)

### IMG_5052.jpeg — Blue corporate agency template with diamond-masked city hero
- **What it is:** Desktop full-page mockup of a French-language web agency template ("webdesign collection"): light, card-heavy corporate site for a digital agency.
- **Composition:** Split hero: big left-aligned uppercase headline + subline + pill CTA on the left; right half is a large rotated-square (diamond/lozenge) photo mask with rounded corners, bleeding off the top-right. Below, sections alternate a "bento" photo cluster (one solid-blue label tile + 2–3 photo tiles) with a text block on the other side. Services row = one tall solid-blue label tile ("Our services") followed by three white icon cards. Trust strip of 4 icon+label items, then a contact row (blue label tile, details card, map). Consistent 12-col grid, generous whitespace, ~120px section gaps.
- **Typography:** Geometric sans (Poppins-like). Hero in heavy uppercase (~800 weight), tight leading; section titles mixed case semibold ~26px; body small (13–14px) grey. Uppercase small-caps labels in tiles and trust strip with slight tracking. Strong scale contrast hero vs body.
- **Colour:** Light. White #FFFFFF / near-white #F5F8FD canvas, primary royal blue #2F6FDB (tiles, buttons), navy ink #0F1B33, mid grey text #6B7280, photo palette of night-blue cityscapes (#1B2A6B) with warm orange light trails.
- **Navigation:** Top-right uppercase small links overlaid on the hero photo, circular blue search button at far right; small square logo mark left.
- **Interaction/motion cues:** Pill buttons with a white circular arrow "knob" at the right end (implies slide/hover), "View offer" links with circular arrow buttons on cards, decorative dot grids and a striped circle (parallax candidates).
- **Responsive/mobile ideas:** Label tile + cards pattern collapses well to a stacked list: the blue tile becomes a section header band, cards stack 1-up. Diamond mask would need to become a simple rounded rectangle on phones.
- **Imagery/iconography:** Stock night-city photography, cool blue grade. Thin-stroke line icons (monitor, cart, chart, shield, clock, lock, headset) in blue, ~1.5px stroke.
- **Ideas for Kuzikode:**
  - **Service cards:** solid-colour "section label" tile as the first cell of the services grid, followed by icon cards each with a single circular arrow affordance (whole card clickable).
  - **Primary CTA button:** pill with an inset circular arrow knob that nudges right on hover.
  - **Trust strip (Home):** 4 factual promises (e.g. "Fixed-scope quotes", "Paynow/EcoCash payments", "Client portal", "Local support") with thin-stroke icons, not fabricated stats.
  - **Contact page:** three-cell row: label tile, details card, map/location card.
- **Verdict:** adapt — card/label-tile system and arrow-knob CTA are useful; reject the diamond photo mask and generic stock city photos, and the "250+ projects" stat (would be fabrication).

### IMG_5054.jpeg — Monochrome dark SaaS landing (SEO tool) with chrome 3D sparkles
- **What it is:** Desktop and tall full-page preview of a dark SaaS landing page for an SEO analytics product, rendered fully in greyscale.
- **Composition:** Left-aligned hero (announcement chip, 2-line headline, subline, two buttons) with chrome 3D four-point stars on the right; logo marquee; features section as a bento of 4 dark UI-fragment cards (2x2, unequal widths); achievements band with tilted stacked stat cards; 3-tier pricing; testimonial carousel; FAQ accordion (left title, right list); footer with giant outlined wordmark.
- **Typography:** Clean grotesk sans (Inter/General Sans), medium weight, large headlines (~56px) in two-tone (white first line, grey second line), small chip labels with icon. Mixed case, slightly tight tracking.
- **Colour:** Dark. Background #0A0A0A, card surfaces #161616–#1E1E1E, borders #2A2A2A, text #F5F5F5 and muted #8A8A8A, white CTA #FFFFFF with dark text. No accent hue at all.
- **Navigation:** Centered nav links, right "Sign in" text link + white pill "Sign up". Rounded-corner frame around the whole page.
- **Interaction/motion cues:** Logo marquee, testimonial carousel with dots and arrows, FAQ accordion with one open item, monthly-free toggle implied, tilted cards suggest scroll-driven parallax.
- **Responsive/mobile ideas:** Bento of UI fragments stacks into single-column cards; FAQ two-column becomes heading then accordion. Small chip eyebrow above each heading keeps sections scannable on phones.
- **Imagery/iconography:** No photos; product UI fragments (charts, star ratings, chips) as imagery, glossy chrome 3D shapes as hero decoration. Small filled icons in chips.
- **Ideas for Kuzikode:**
  - **Home features/services:** bento of real product UI fragments (client portal invoice card, Paynow receipt, project status timeline) instead of illustrations.
  - **Section eyebrows:** small rounded chip with icon above every H2 for consistent rhythm.
  - **Headline two-tone:** second line in muted grey for a calm emphasis without an accent colour.
  - **Footer:** oversized "Kuzikode" wordmark bleeding at the bottom.
- **Verdict:** adapt — UI-fragment bento, chip eyebrows and wordmark footer are strong; reject the chrome 3D sparkles (generic AI-SaaS cliche) and the brand logo marquee (fabricated "trusted by").

### IMG_5055.jpeg — Creative agency site, white hero card on black with neon-lime accents
- **What it is:** Desktop + mobile mockup of a creative/design agency site ("Creatix"): white rounded hero panel over a dark page, lime-green highlights.
- **Composition:** Hero is a big white rounded card (large bottom radius) containing centered 2-line headline, cut-out portrait of a person in the centre, intro text bottom-left, rating/years badge right, dual CTA pill overlapping the bottom. Dark page below: stats bar in an outlined rounded box (4 figures), split "intro" heading + paragraph, two grayscale photos with a lime label strip, services section as a dark rounded panel (numbered list of pill rows + photo + two small CTA cards), giant wide-display "Innovate + Inspire + Create" type strip, team grid, testimonials carousel, rotated marquee ribbon, lime footer card.
- **Typography:** Wide geometric/extended display (Clash Display/Syne-like) for headings, heavy display for the slogan strip; small sans for body. Keyword highlighted by a lime pill behind the word ("Our [Services]"). Numbered "01–04" list.
- **Colour:** Mixed: white hero #FFFFFF on dark #111111 / panels #1C1C1C, neon lime accent #A6F04A (approx #9EF01A), text white/grey #BDBDBD, grayscale photography.
- **Navigation:** Black floating pill nav with logo centered and two links each side; on mobile same pill, compressed.
- **Interaction/motion cues:** Numbered service rows with arrow (accordion/hover), rotating circular text around a photo, testimonials carousel with arrows, diagonal marquee ribbon of service names, "Join Our Team" toggle pill.
- **Responsive/mobile ideas:** Mobile keeps the white hero card with rounded bottom, stats bar becomes a 4-across compact strip; services list rows are full-width pills — great thumb targets. Marquee ribbon adds energy without layout cost.
- **Imagery/iconography:** Cut-out smiling stock portraits, grayscale office photos, lime starburst doodles and squiggles, arrow-in-circle icons.
- **Ideas for Kuzikode:**
  - **Services index:** numbered full-width pill rows ("01 Web development →") that work identically on phone and desktop.
  - **Keyword highlight:** brand-accent pill behind one word in an H2, used sparingly (max once per page).
  - **Footer:** footer as a single accent-colour rounded card with columns and newsletter field.
  - **Services marquee:** slow horizontal ribbon of service names (respects prefers-reduced-motion).
- **Verdict:** adapt — numbered pill service rows and accent footer card are worth taking; reject stock "excited woman" cut-out heroes, fake stats ("2000+ company") and the team grid until real staff exist.

### IMG_5056.jpeg — Fintech bank landing, dark-green hero with mint accents (desktop + mobile)
- **What it is:** Desktop and mobile full-page mockup of a business-banking landing page ("Xenon Bank") on a mint-green presentation background.
- **Composition:** Dark hero with left headline (accent icon inline), portrait of a professional woman centre, three benefit bullets on the right with a "12M active users" avatar chip. Then light sections: tabbed product block (3 tabs → photo + feature list card), feature bento (mixed text/photo cards around a central card), testimonial row with Trustpilot rating, dark awards band with badges, stories grid.
- **Typography:** Bold geometric sans (Plus Jakarta-like), headlines ~44px with one or two words in green accent, body small grey. Mixed case.
- **Colour:** Dark-to-light. Hero #0E1A17 (deep green-black), page #F4F7F6, cards #FFFFFF, accent mint/emerald #2BD97C, secondary navy #13203A for award band, text #111827.
- **Navigation:** Thin top nav with logo left, links centre, green pill "Get started" right; mobile shows logo + hamburger.
- **Interaction/motion cues:** Tabs (Business line of credit / Equipment financing / Merchant services) switching content, testimonial carousel with arrows, check-list reveals.
- **Responsive/mobile ideas:** On mobile tabs become a 2-up visible strip that scrolls horizontally; hero bullets stack under the headline before the photo — text first, image second. Good example of keeping CTA above the fold.
- **Imagery/iconography:** Professional business portraits, warm natural light; green-circle check icons; award badges.
- **Ideas for Kuzikode:**
  - **Services detail:** tab/segmented switcher between related offerings (e.g. Websites / Web apps / Automations) each showing scope list + photo/UI.
  - **Home hero mobile:** headline + three short benefit lines + CTA before any image.
  - **Accent inline word:** colour one word in the hero headline with the brand accent.
- **Verdict:** adapt — tabbed service switcher and text-first mobile hero are good; reject awards band, Trustpilot and "12M users" social proof (would be fabricated).

### IMG_5057.jpeg — Violet fintech mobile landing (three phone-width columns)
- **What it is:** A mobile-first landing page for a finance app ("Finseer") shown as three phone-width slices of one long scroll.
- **Composition:** Hero is a violet gradient rounded card inside the phone frame: chip eyebrow, centered 3-line headline, subline, two pill buttons, dashboard screenshot peeking from the bottom. Then logo chips, centered section headings with chip eyebrows, stacked feature cards (icon tile + title + "Learn more" pill), country/usage rows, support card, violet testimonials card with horizontally scrolling quote cards, pricing with Monthly/Yearly segmented control (with "30% save" badge), stacked plan cards with checklist, FAQ accordion with +/− and a "still have questions" card, violet final CTA card with inline email + button.
- **Typography:** Neutral grotesk (Inter/SF-like), headings ~32px medium, centered; light grey body; one figure "1000+" in muted lighter tone.
- **Colour:** Light. Canvas #F7F7FB, cards #FFFFFF with #ECECF3 borders, violet gradient #8C7BF5 → #6E5CE6 with lavender #C9C1FF highlights, black buttons #0B0B0F, green save badge #B6F09C.
- **Navigation:** Logo + circular dark hamburger button inside the hero card.
- **Interaction/motion cues:** Segmented Monthly/Yearly toggle, horizontal swipe testimonial cards (cut off at edges to signal scroll), FAQ accordion, chip eyebrows.
- **Responsive/mobile ideas:** Excellent phone reference: everything in rounded cards with ~16px gutters; hero as a card not full-bleed; peeking dashboard screenshot; edge-cut horizontal carousel signalling swipe; inline email+button CTA that fits 360px; stacked pricing cards one per screen.
- **Imagery/iconography:** Product dashboard screenshots, small avatar photos, filled icons in white rounded tiles on violet, circle-check outline icons.
- **Ideas for Kuzikode:**
  - **Pricing mobile selector:** segmented control (e.g. Once-off / Monthly care or USD / ZWG) sitting above stacked plan cards, with a small save badge if annual billing exists.
  - **Home hero mobile:** hero as an inset rounded card with a client-portal screenshot peeking from the bottom edge.
  - **FAQ:** accordion with +/− plus a closing "Still have questions?" card linking to WhatsApp/contact.
  - **Final CTA:** gradient card with inline email field + button.
- **Verdict:** adopt (layout patterns) — this is the best phone reference in the batch; swap violet for Kuzikode's palette and drop the brand logo chips.

### IMG_5058.jpeg — Bright blue two-plan pricing poster
- **What it is:** A pricing section/poster for a link-in-bio product: two plan cards on a saturated blue background, "All plans include" row below.
- **Composition:** Centered: chip eyebrow, huge 2-line headline (~90px), subline, two equal cards side by side (white Basic, blue outlined Pro with "Best value" badge and a little hand-drawn spark), each with price, divider, description, checklist with hairline separators, full-width button; below, 4 equal columns of icon + title + 2-line copy divided by vertical rules.
- **Typography:** Bold grotesk (SF Pro/Inter Display-like), very heavy tight headline, big prices (~64px bold) with smaller "/month", checklist 18px regular.
- **Colour:** Blue-dominant. Background #1F5EF5 (approx #1E5BF0), white card #FFFFFF, black button #05070D, white button on blue card, light blue icon tiles #CFE0FF, check circles #1F5EF5.
- **Navigation:** n/a.
- **Interaction/motion cues:** Recommended badge, contrasting button styles (black vs white) to steer choice; no toggles.
- **Responsive/mobile ideas:** Two cards stack naturally; checklist rows with hairlines remain legible; "all plans include" row becomes a 2x2 grid.
- **Imagery/iconography:** Rounded-square light-blue icon tiles with blue line icons (link, chart, coins, grid).
- **Ideas for Kuzikode:**
  - **Pricing:** "Included in every package" row under the plan cards (hosting setup, SSL, client portal access, handover docs) to cut repetition from each card.
  - **Pricing cards:** checklist rows separated by hairlines for scanability; recommended plan inverted in colour with a small badge.
- **Verdict:** adapt — the "included in every plan" row and inverted recommended card are good; reject the full-saturation blue background as too loud for whole-page use.

### IMG_5059.jpeg — Dark four-tier pricing with gradient-outlined cards
- **What it is:** Desktop dark pricing section with four tiers, each card outlined in a different gradient colour.
- **Composition:** Centered uppercase title, tagline, two-line description, Monthly/Yearly switch with "Save 20%" badge; 4 equal cards: plan name, price in a coloured tab that notches out of the card edge, short description, divider, checklist, small gradient button at bottom.
- **Typography:** Space Grotesk-like geometric sans, quirky letterforms; uppercase "PRICING" title; large price numerals (~40px) with small "/ mo".
- **Colour:** Dark. Background #121212, card fill #161616; tier gradients orange #FFB547→#FF6A3D, lavender #C6A8FF→#E6D9FF, teal #3FE0A5→#5CE1E6, crimson #E0245E→#F05A7E; yellow badge #FFF27A; text #EDEDED.
- **Navigation:** n/a.
- **Interaction/motion cues:** Billing toggle switch; colour-coded tier identity.
- **Responsive/mobile ideas:** Four colours help users keep track when cards are stacked or swiped on mobile; the price tab is a compact, memorable unit.
- **Imagery/iconography:** Simple check marks, no imagery.
- **Ideas for Kuzikode:**
  - **Pricing (subscriptions/care plans):** a single subtle colour cue per tier (thin top border or price tab) so tiers stay identifiable in a mobile carousel.
  - **Price tab:** notched price chip as a distinctive component for the recommended tier only.
- **Verdict:** reject as a whole — four competing gradients feel gimmicky and off-brand for a consulting firm; keep only the idea of per-tier identity cues.

### IMG_5060.jpeg — Clean light four-tier pricing with blue highlighted plan
- **What it is:** Desktop pricing section for a Framer template product: four pale cards, one solid-blue featured card.
- **Composition:** Left-aligned blue eyebrow "Pricing", big H2, grey subline; centered segmented Monthly/Yearly control; 4-up equal cards with rounded 16px corners: blue uppercase plan label, description, big price, billing note, checklist, full-width button. Featured card filled blue and slightly taller.
- **Typography:** Inter, bold H2 (~44px), uppercase small plan labels with tracking, bold prices (~52px), regular 14px lists.
- **Colour:** Light. White #FFFFFF, card fill #EEF4FF, primary blue #0A66FF, ink #1A1A1A, grey #6B7280, white button on blue card.
- **Navigation:** n/a.
- **Interaction/motion cues:** Segmented control with white sliding thumb on grey track; "Best Seller" badge.
- **Responsive/mobile ideas:** Simple, low-chrome cards stack cleanly; left-aligned header reads better on phones than centered.
- **Imagery/iconography:** Thin blue check strokes only.
- **Ideas for Kuzikode:**
  - **Pricing page:** left-aligned header + segmented control + tinted cards with one filled featured card — calm, credible baseline layout.
  - **Segmented control component:** grey track + white sliding thumb, reused for billing period, currency, and portal filters.
- **Verdict:** adopt — the most appropriate pricing baseline for a professional services firm; the copy itself has typos ("monhtly") to avoid.

### IMG_5061.jpeg — Black glassmorphic pricing with giant "Pricing" wordmark behind cards
- **What it is:** Desktop dark pricing hero: three frosted-glass cards overlapping a huge white "Pricing" word.
- **Composition:** Massive headline word fills the top, cards overlap its lower half so the word appears through the blur; three equal cards with price, plan name, divider, round check bullets, full-width pill button at bottom; billing switch centred below.
- **Typography:** Poppins semibold, giant display (~250px) fading to grey at its base; prices ~40px semibold; small 12px features.
- **Colour:** Dark. Black #000000, glass cards rgba(255,255,255,0.04) with #2B2B2B border, white text, featured button solid white #FFFFFF, faint iridescent edge glows (blue/orange).
- **Navigation:** n/a.
- **Interaction/motion cues:** Backdrop-blur glass implies depth; switch for billing; featured card marked only by white button.
- **Responsive/mobile ideas:** Giant word would wrap/crop badly on phones; would need a scaled clamp() and cards stacked under it, losing the overlap effect.
- **Imagery/iconography:** Subtle abstract 3D swirl behind cards; circle-check icons.
- **Ideas for Kuzikode:**
  - **Pricing hero (desktop only):** oversized page-title word behind content as a page-identity device, degrading to a normal H1 on mobile.
  - **Featured plan:** mark the recommended plan only via the inverted primary button rather than badges.
- **Verdict:** reject — glassmorphism + giant word is trendy, poor for contrast/accessibility and weak on phones; borrow only the "button-only emphasis" idea.

### IMG_5062.jpeg — E-learning site responsive spec sheet (phone vs tablet side by side)
- **What it is:** A responsive design spec for an e-learning platform ("ufaber") showing the same page in phone and tablet frames, with numbered section markers in the margin.
- **Composition:** Full-bleed dark photo hero with centered headline and two CTAs; "your classroom" split (illustration + checklist); course cards carousel; category directory (multi-column lists on tablet, collapsible accordion list on phone); instructor CTA band with headphones prop; partner logos; testimonials; dark navy footer with 4 columns that become stacked on phone. Section numbers 1–6 annotate parity between breakpoints.
- **Typography:** Lato/Open Sans-like humanist sans, light headings, small body; dated 2015-era look.
- **Colour:** Light with dark ends. Page #EEF2F6, hero overlay #2B3440, primary green CTA #2ECC71, secondary blue #3498DB, orange #F39C12 buttons, footer navy #233042.
- **Navigation:** Phone: logo only (menu implied); tablet: logo + Login + Signup pill.
- **Interaction/motion cues:** Course card carousel with dots on phone, category accordion on phone vs open columns on tablet.
- **Responsive/mobile ideas:** The real lesson: document breakpoint parity section by section — multi-column link lists collapse into accordions, carousels replace grids, footer columns stack; keep section order identical across sizes.
- **Imagery/iconography:** Staged photo props (headphones, toys), dark photo hero, flat placeholder illustration.
- **Ideas for Kuzikode:**
  - **QA/spec docs:** numbered section-parity sheet (phone vs desktop) in the redesign specs for each key page.
  - **Services/footer directory on mobile:** multi-column link groups collapse into accordions under 640px.
  - **Footer:** dark footer with columns stacking to one column, contact block first on phone.
- **Verdict:** adapt the process (breakpoint parity spec), reject the visual style as dated.

---

**Batch palette candidates**
1. **Calm professional blue (IMG_5060 / IMG_5052 / IMG_5058):** white #FFFFFF, tint #EEF4FF, primary #0A66FF (or slightly deeper #2F6FDB), ink #0F1B33, muted #6B7280, black CTA #05070D. Most credible for a consulting firm; risk of looking generic unless paired with a distinctive typeface.
2. **Dark neutral + single neon accent (IMG_5055 / IMG_5054):** base #0A0A0A–#111111, surfaces #1C1C1C, border #2A2A2A, text #F5F5F5 / #8A8A8A, accent lime #A6F04A. Bold and memorable; accent must be used sparingly and checked for contrast on light surfaces.
3. **Deep green + mint fintech (IMG_5056):** hero #0E1A17, page #F4F7F6, accent emerald #2BD97C, navy support #13203A, ink #111827. Has a natural Zimbabwe/money/growth reading and suits payment-heavy messaging (Paynow, invoices).

## Images 21–29 (IMG_5063 – IMG_5072)

### IMG_5063.jpeg — "Mobile-first" travel/flight booking app showcase (deep navy/blue)
- **What it is:** Dribbble-style presentation board for a phone app (flight, hotel and event booking). A hand holds a phone in the hero, floating UI fragments sit around it, and five more phone screens are scattered below.
- **Composition:** Large centred 3-line headline at the top of a rounded (~40px radius) gradient panel. Below it a hand-held phone is centred, with satellite cards to the left and right (location card, price pill, image card, time card with "Book now"). The lower half uses staggered phone frames at three different vertical offsets, which reads as a loose masonry.
- **Typography:** Geometric grotesk sans (Manrope / General Sans feel). The display line is very large (~90px on a 1200 board), weight ~500, tight negative tracking and leading ~0.95, with a fade from white to pale blue on the first word. Sentence case throughout. Body text is tiny (~10–12px) and light grey; the scale contrast is extreme.
- **Colour:** Dark mode. Background near-black navy #070B14 to #0B1220; the panel gradient runs from #0E1A33 to #1E4FB0 to #2F6BE0 at the bottom. Accent electric blue #1F6BFF for round icon buttons. White pills #FFFFFF with black text. Card surfaces are translucent blue (#2A4F9A at ~40%). Light screens use #EEF1F6 with black #0B0F18 chips.
- **Navigation:** In-app top bar with the brand name on the left and a circular white hamburger button (≈36px) on the right. Row of 4 category icons with labels (Flights/Hotels/Car rental/Events). One-way vs Round-way radio pills.
- **Interaction/motion cues:** Prev/next circular arrow buttons on carousel cards ("Popular", event card). Paired "pill button + circular arrow button" CTA (e.g. "Let's go" + ↗). Filter chips ("Popular ›", "Filters"). A swap button between From/To fields.
- **Responsive/mobile ideas:** Full-bleed image cards inside the phone with text over the image and a CTA pinned at the bottom of the card. A primary CTA spans the width with a circular arrow docked to its right. Stacked form fields as rounded dark rows. Large H1 (2 lines) at the top of every screen, then chips, then cards.
- **Imagery/iconography:** Real architectural and landmark photos (Eiffel Tower, Santorini, glass towers) with a cool blue grade. Earth-limb render as a background. Small monochrome glyph icons in dark circles; thin-stroke arrow ↗.
- **Ideas for Kuzikode:**
  - **Home hero (mobile):** an oversized 3-line tight-tracked headline on a navy-to-blue radial panel with a 32–40px bottom radius. One phrase gets a subtle gradient fill.
  - **Primary CTA component:** a white pill label plus an attached circular accent-blue ↗ button. Use it as the signature button on mobile cards and the hero.
  - **Service cards (mobile):** a full-bleed card with a title and short copy on top and the CTA docked at the bottom edge. A "from $X" price pill top-right, which suits package cards.
  - **Pricing / quote request form:** stacked rounded dark field rows plus segmented "One-off / Subscription" radio pills, modelled on One way / Round way.
- **Verdict:** Adapt. Take the navy-to-electric-blue mood, the pill+arrow CTA and the mobile card structure. Reject the hand-holding-phone stock imagery and the floating fragment collage (too showcase-y for a real site).

### IMG_5064.jpeg — "Amiso" agency template: services grid + dark footer (red accent)
- **What it is:** Desktop ThemeForest-style IT/agency template showing an inner services page, a newsletter band and a footer.
- **Composition:** Utility top bar (email, address, socials) above a transparent nav over a dark photo page-header (~300px tall) with the title "Services" left-aligned. Then a 3×2 grid of bordered white cards with ~12px gaps. Each card has a title, two lines of copy, a round arrow button + "Read more" bottom-left, and a line icon inside a light grey quarter-circle bottom-right. Footer: a boxed newsletter strip, then 4 columns (brand/about, Explore links, Portfolio thumbnail grid 3×2, Contact).
- **Typography:** Sans (Manrope-like). Card titles ~20px semibold; body ~14px grey #666 with generous 1.7 leading. Footer headings white semibold.
- **Colour:** Light content #FFFFFF, card border #E6E6E6, quarter-circle fill #F3F3F3. Accent red #F23B3B (active card arrow, icons, logo). Footer #1A1A1A to #222 with diagonal stripe motifs in #2A2A2A.
- **Navigation:** Top utility bar, a horizontal nav with dropdown carets, a search icon, and a "Call anytime" phone block with a red circle icon.
- **Interaction/motion cues:** The middle card shows the hover/active state: an elevated shadow and the arrow circle fills red. That implies a hover lift and fill transition.
- **Responsive/mobile ideas:** Not shown. The 3-col card grid would collapse to one column, and the corner-icon device would need shrinking.
- **Imagery/iconography:** Dark stock photo of a business handshake with a red diagonal overlay. Red outline icons (stroke ~2px, duotone-free). Square portfolio thumbnails with ~6px radius.
- **Ideas for Kuzikode:**
  - **Service cards:** a quiet bordered card with the icon tucked into a soft corner quarter-circle, and a circular arrow that fills with the accent on hover/focus. A good restrained hover state.
  - **Footer:** a boxed newsletter strip sitting above the footer columns. Only add it if Kuzikode actually has a newsletter (no dead features); otherwise use it as a "Start a project" strip.
  - **Inner page header:** a short page-title band. Use a solid or gradient band, not a dark stock-photo overlay.
- **Verdict:** Adapt the card hover pattern only. Reject the overall look: generic 2019 template, utility top bar clutter, red accent off-brand, stock handshake imagery, and a fake portfolio thumbnail grid that would invite fabrication.

### IMG_5065.jpeg — "Nisoz" digital marketing agency (black + acid lime)
- **What it is:** Desktop agency template shown twice (a full-length thumbnail and an enlarged crop). Long single-page home with many sections.
- **Composition:** Black hero with a big uppercase headline left and a photo right, split by lime diagonal slashes. Then a lime band with a "what we offer" heading and 5 black square service tiles. After that come alternating white sections (photo collage + copy, logo row, 3 photo cards), a dark photo band CTA, "ready for a new look" with lime and black circle badges, a 4-col recent-projects grid, a "why choose us" section, a news grid, and a lime contact section with a person cutout. Very busy rhythm, roughly 12 sections.
- **Typography:** Condensed bold uppercase sans (Oswald / Barlow Condensed feel) for headlines, ~48–60px, tight. Small uppercase eyebrow labels. Regular sans body.
- **Colour:** Black #111111 / #1A1A1A, acid lime #C6F31B (around #BFF000), white #FFFFFF, mid grey #F2F2F2. Photos are desaturated to greyscale so the lime pops.
- **Navigation:** Horizontal top nav on black with a lime active item and a phone CTA on the right.
- **Interaction/motion cues:** Play-button squares on the video sections. Arrow tiles on project cards. Implied hover on the service tiles.
- **Responsive/mobile ideas:** Little shown. The diagonal hero splits would crop badly on phones. The black square tiles would become a 2-col grid.
- **Imagery/iconography:** Greyscale corporate stock photos with lime overlays and diagonal shapes. Thin lime/white line icons on black tiles. Placeholder client logo row.
- **Ideas for Kuzikode:**
  - **Section rhythm (general):** a warning example. Too many sections, too many devices. Keep Kuzikode to one idea per section.
  - **Service tiles:** high-contrast dark square tiles with a single line icon and a 2-line label inside one accent band. That works as a compact "capabilities strip" under the hero.
  - **Photography treatment:** greyscale photos with a single accent colour is a cheap way to unify mixed owner-supplied photos. Consider it for the About/team page if owner photos vary in quality.
- **Verdict:** Reject as a whole (cluttered template, stock corporate people, fake logo row, condensed caps feel dated). Adapt only the greyscale-photo + single-accent unification trick.

### IMG_5066.jpeg — "Creatiwise" monochrome brand-design studio (desktop + mobile)
- **What it is:** Desktop landing page plus a narrower full-length version (tablet/mobile-ish) for a branding and digital design agency. Monochrome with hand-drawn accents.
- **Composition:** Hero split: a pill eyebrow ("Welcome to…"), a 3-line uppercase headline left, a rounded portrait card right with a floating "250+ clients" chip and a dark pill label overlapping its bottom edge. Logo marquee row with ✦ separators. About section: copy plus a B&W group photo, then a black stat card with concentric wave lines and tilted tag-pills. "How we work": 4 process cards styled as pinned, rotated tags with push-pins, joined by a dashed path that ends in a handwritten note. Then a black "what we do" section with a 3×2 dark card grid, a horizontal portfolio carousel, a testimonial with a dot pager, a dark CTA card, and a 4-col footer.
- **Typography:** Clean grotesk sans (Inter Tight / Satoshi feel). Hero is uppercase ~44px medium; section heads are sentence case ~28px medium. Small rounded-outline pill eyebrows. One handwritten script accent ("Ready to be delivered!").
- **Colour:** Light grey #F2F2F2 / #EDEDED background, white #FFFFFF cards, black #0A0A0A sections and pills, mid greys #8A8A8A. No chromatic accent at all; all photos B&W except the hero portrait.
- **Navigation:** Minimal: a wordmark left, grey text links in the centre, a black pill "Contact Us" on the right.
- **Interaction/motion cues:** Logo marquee (auto-scroll). Rotated "hanging" process cards suggest a scroll-triggered swing or settle. Portfolio horizontal scroller with arrow buttons and a "See all projects" pill. Testimonial carousel with dots.
- **Responsive/mobile ideas:** The narrow version keeps the process cards scattered but smaller, and the service grid stays 3-col on dark. On real phones that should become 1–2 col. The portfolio becomes a swipeable rail (cards cut off at the edge to signal scroll), a good mobile pattern.
- **Imagery/iconography:** B&W photography, wavy line-art texture on the black card, doodle sparkles/stars and hand-drawn arrows, small square line icons on dark cards.
- **Ideas for Kuzikode:**
  - **Process section ("How we work"):** 4 numbered step cards (Discover, Design, Build, Launch) joined by a dashed connector path. On mobile, render it as a vertical dashed timeline. A slight rotation or settle-in animation on scroll is acceptable if it's subtle and reduced-motion safe.
  - **Portfolio (mobile):** a horizontal snap-scroll rail with a peeking next card plus a "See all" pill. It ships with the empty state until real entries exist.
  - **Eyebrow labels:** small outlined pill eyebrows above each section heading as a consistent section marker.
  - **Dark stat/feature card:** a black card with a fine concentric-line texture for a single highlight (e.g. "Payments via Paynow/EcoCash"). Only real facts, no fake "40% growth" stats.
- **Verdict:** Adapt. The pill eyebrows, process timeline and portfolio rail are strong. Reject the fake client count chip, logo marquee of non-clients, and the doodle overload.

### IMG_5067.jpeg — IT solutions agency home (indigo + royal blue)
- **What it is:** Desktop home page for an IT/web/design services agency: hero, marquee, about, services, process.
- **Composition:** Full-width hero with a dark indigo overlay on a team photo: eyebrow "// Experience…", a 3-line H1 left, a filled pill CTA plus an underlined text link. A solid blue marquee band with ✳ separators listing services. About: a 2×2 photo collage with rounded/cut corners, a blue frame offset, a circular "Hire us" rotating badge in the centre and sparkle shapes. Copy right with a two-tone heading, a 3-stat row with vertical dividers, and a signature. Services: a grey band, heading left plus a "View all" pill right, and 3 white cards with blue rounded-square icons; the first card shows an active blue bottom border. Process: 4 circular blue icons with numbered black badges connected by horizontal lines. Giant ghost outline words ("ABOUT US", "SERVICES") sit behind the section headings.
- **Typography:** Sans (Plus Jakarta / Poppins feel). H1 ~36px semibold white; section heads ~32px with the second line in blue. Eyebrows preceded by "//". Body grey ~13px.
- **Colour:** Indigo hero overlay #2B2F57 / #1E2347, royal blue #3D6BF2 (around #4169E1), navy #0B1238 footer, white #FFFFFF, section grey #F3F4F6, text #1A1A2E.
- **Navigation:** Not visible (hero crop starts without the nav).
- **Interaction/motion cues:** Infinite marquee band, rotating circular text badge, active card underline (hover state), process step connectors.
- **Responsive/mobile ideas:** None shown. The process row would stack vertically with the line becoming vertical. The marquee is good on mobile as a compact service list.
- **Imagery/iconography:** Corporate stock team photos, solid filled white glyphs on blue rounded squares, 4-point sparkle shapes.
- **Ideas for Kuzikode:**
  - **Services index:** heading left and a "View all services" pill right in one row, then 3 cards with a filled-icon tile; the active/hover card gets an accent bottom border. Clear and conventional.
  - **Process section:** a numbered circular-icon stepper with connector lines (desktop horizontal, mobile vertical).
  - **Marquee band:** a single accent band scrolling service names (Web, Software, AI, Automation, Cloud) between hero and content. It must pause on reduced motion and on hover.
- **Verdict:** Adapt the services-row header and process stepper. Reject the fabricated stats (150+ team, 2000+ clients), the CEO signature, stock team collage and ghost outline words (dated).

### IMG_5069.jpeg — AI-generated "professional solutions" landing concept (blue/navy, garbled text)
- **What it is:** A desktop landing-page mock that is clearly AI-generated: most copy is nonsense glyphs. It's a generic corporate consulting site.
- **Composition:** A rounded hero card (~24px radius) inset from the page edge with a pale grey-blue gradient: H1 left, two buttons, a smiling man with a tablet cut out on the right, and a floating "+" circle. Then a row of 4 service cards (the last one dark navy inverted). A bento row of a pastel gradient tile, a photo tile and a large statement text. A 2-tile row (blurred photo card / blue-to-coral gradient photo card). A dark navy CTA panel left with a stacked list of 2 testimonial/feature rows on the right.
- **Typography:** Clean sans, H1 ~40px regular/medium, sentence case, large statement text ~28px light. Hierarchy is decent despite the garbled words.
- **Colour:** Page #F4F6FA / white, navy #0E1A3A, accent blue #2D5BE3, pastel lavender-to-butter gradient (#AFC0E8 to #EFE9D0), one coral-to-blue gradient (#3B5DA8 to #E8735A).
- **Navigation:** Logo left, centred text links, a blue pill CTA right, all inside the hero card.
- **Interaction/motion cues:** Small round dot/arrow buttons on cards (top-right) imply click-through. Otherwise n/a.
- **Responsive/mobile ideas:** The bento rows would stack. The inset hero card with page margin is a good mobile pattern (a 16px gutter with a radius).
- **Imagery/iconography:** Stock-like smiling business people (AI-looking), thin-stroke line icons top-left of cards.
- **Ideas for Kuzikode:**
  - **Home hero container:** an inset rounded hero card with nav inside it, which gives a softer, product-like frame on both desktop and phone.
  - **Service cards row:** 3 light cards plus 1 inverted dark card for the featured or recommended service. A small round arrow button top-right as the whole-card affordance.
  - **Bento section:** mix one gradient tile, one image tile and one plain statement block for an "approach" section.
- **Verdict:** Adapt only structural ideas (inset hero card, one-inverted-card row). Reject as a visual reference: AI-generated, illegible copy, generic stock people.

### IMG_5070.jpeg — "Qovex" SaaS pricing page (white + periwinkle/violet glow)
- **What it is:** Desktop pricing page from a Webflow SaaS template: pricing cards, comparison table, FAQ, newsletter and footer.
- **Composition:** Centred layout (max-width ~1000px on a 1200 board). Pill nav floats at the top centre. Pill eyebrow with icon, a 2-line centred H1, a subline, then a Monthly/Annual segmented toggle with a "Save 20%" badge. 3 pricing cards with the middle one highlighted (blue border, gradient-filled CTA, "Popular" badge). Then a comparison table (features column + 3 plan columns with price headers and check dots). FAQ: a centred single-column accordion (first item open). Newsletter band with a soft violet glow and an inline email field + button. Footer: 4 columns with a giant pale wordmark watermark at the bottom.
- **Typography:** Grotesk sans (Inter Display / Manrope). H1 ~44px semibold with tight tracking; prices ~28px semibold with a small "/Month" suffix. Small grey body; feature lists ~11px.
- **Colour:** White #FFFFFF, soft wash #EEF0FF, glow gradients periwinkle #8B8CF5 to violet #6E5BEA to light blue #A9C1FF. Primary button gradient #5B5BF0 to #7B7BFF. Check dots #5B5BEA, disabled checks #C9CBD6. Text #111827 / grey #6B7280. A black "Buy Template" pill in the nav.
- **Navigation:** Centred pill-shaped nav bar with the active item as a filled blue pill, a logo left and a black CTA pill right.
- **Interaction/motion cues:** Monthly/Annual segmented control, accordion FAQ with chevrons, card highlight state.
- **Responsive/mobile ideas:** Cards stack. The comparison table needs a mobile pattern (plan selector tabs and a single column, or sticky plan headers). The centred narrow FAQ already suits phones.
- **Imagery/iconography:** No photos. Small icon chips in the eyebrows, round filled check dots, round social icon buttons in the accent.
- **Ideas for Kuzikode:**
  - **Pricing page:** a Monthly/Annual (or "Once-off / Monthly care") segmented control with a savings badge, 3 cards with the middle recommended plan highlighted by border and filled CTA, then a full comparison table below.
  - **Pricing mobile selector:** turn the comparison table into a segmented plan picker (tabs Starter/Business/Enterprise) showing one column at a time.
  - **FAQ:** a narrow centred accordion with the first item open by default; also use it on service pages.
  - **Footer:** an oversized pale "Kuzikode" wordmark watermark bleeding off the bottom as a confident brand sign-off.
- **Verdict:** Adopt the pricing page structure (toggle, highlighted plan, comparison table, FAQ). Adapt the colours to Kuzikode's palette rather than the generic violet glow.

### IMG_5071.jpeg — HackerRank pricing plans (white, green/teal/blue tiers)
- **What it is:** Desktop pricing page concept for HackerRank: a 4-tier pricing table with a long feature matrix, a CTA band, a 2-col FAQ and a link-heavy footer.
- **Composition:** A single unified table: the left column holds the "Choose your plan" heading and feature labels, followed by 4 plan columns. The "Most popular" column is lifted with a top colour bar, shadow and white background running the full height of the table. Grouped feature rows ("Top features", "Product capabilities") with grey group headers. A centred "Still not convinced?" CTA band, then the FAQ in 2 columns of Q&A (no accordion), then a 6-col footer with letter-spaced uppercase headings.
- **Typography:** Humanist sans (Open Sans) for headings, ~36px light H1, plan names in tier colours. Buttons and the "Free Trial" CTA in monospace bold, a nice developer nod. Tiny feature labels ~10px bold. Footer headings widely tracked uppercase.
- **Colour:** White #FFFFFF, table bg #E9EEF1, tier colours: green #1BA94C, teal #1CC6A0, blue #1A8FD6, navy #1F3A7A. Text #39424E. Outer board gradient blue #1E4FA0 to green #16C47F (presentation only).
- **Navigation:** Logo left, small text links with an underlined active item, "Contact Us" text plus a green filled "Free Trial" button right.
- **Interaction/motion cues:** Info (i) tooltips on feature labels. Column highlight. Otherwise static.
- **Responsive/mobile ideas:** Not shown. A matrix this dense needs a plan switcher on phones; the 2-col FAQ collapses to 1.
- **Imagery/iconography:** None, just simple check marks and dashes for "not included".
- **Ideas for Kuzikode:**
  - **Pricing comparison table:** a lifted full-height "Most popular" column with an accent top bar, grouped feature sections with sub-headers, (i) tooltips explaining jargon (e.g. "SSL", "CMS"), and dashes, not crosses, for missing features.
  - **Custom tier:** a 4th "Custom / Contact us" column for bespoke software and AI projects, with a "Request a quote" button instead of a price.
  - **Mono accents:** a monospace font on small UI labels/buttons as a subtle "we're engineers" signal.
- **Verdict:** Adapt the comparison table mechanics (lifted column, grouped rows, tooltips, Custom tier). Reject the multi-colour tier coding (too many accents).

### IMG_5072.jpeg — "Ultrablox" dark SaaS pricing + features (charcoal + electric blue)
- **What it is:** Desktop dark-mode Framer template showing pricing cards, a feature grid and a second compact 4-tier pricing table.
- **Composition:** Nav: logo left, centred text links, an outlined "Contact us" plus a blue "Get it now →" on the right. Centred H1 + subline, then 3 pricing cards with ~16px radius; the middle card is fully filled electric blue with a white "Best Seller" pill and a black CTA (inverted emphasis). A feature section on a slightly lighter band: pill "New Feature" eyebrow, a large centred H2, and a 4×2 grid of features (circular icon chip, bold title, grey copy) with no cards, just open layout. Second pricing: 4 narrow columns with tier name in blue caps, price, button, then feature rows with a left label column.
- **Typography:** Bold geometric sans (Inter / SF Pro), H1 ~56px bold with tight tracking; prices ~48px bold; tier labels small blue uppercase with tracking. Body grey ~14px.
- **Colour:** Background #1E1F24 / #24252B, cards #2E3038, lighter band #2A2B31, electric blue #0A66FF (around #1463FF), text white #FFFFFF / grey #9A9CA5, black button #141518.
- **Navigation:** Standard top nav with dual CTAs (secondary outline + primary with arrow).
- **Interaction/motion cues:** Card highlight; the arrow in the CTA implies a nudge-on-hover. Otherwise static.
- **Responsive/mobile ideas:** 3 cards stack; put the highlighted plan first on mobile. The 4×2 feature grid becomes 1-col with icon left/text right rows. The 4-col table needs a plan switcher.
- **Imagery/iconography:** No photos. Thin-stroke line icons (~1.5px) in dark circular chips, blue check marks.
- **Ideas for Kuzikode:**
  - **Pricing cards:** a fully filled accent card for the recommended package, inverting the CTA to dark. The emphasis is unmistakable on a phone where cards stack, so order the recommended card first on mobile.
  - **"What's included" feature grid:** an open 4-col grid (no card boxes) of icon chip + title + 2-line copy for package inclusions (hosting, SSL, CMS, support). This cuts card-on-card clutter.
  - **Header CTAs:** pair an outlined secondary "Contact" with a primary "Start a project →".
  - **Client workspace (dark mode):** the charcoal #1E1F24 / #2E3038 surface ladder is a good dark theme for the portal/admin.
- **Verdict:** Adopt the filled-recommended-card and open feature grid. Adapt the dark surface ladder for dark mode / portal. Avoid the duplicated sections and the "why over 100 creators" style social-proof claims.

---

## Batch palette candidates

1. **Midnight to electric blue (IMG_5063, IMG_5072, IMG_5067):** near-black navy #070B14 / #0B1220, deep navy #0E1A33, mid blue #1E4FB0, electric accent #1F6BFF (around #0A66FF), white #FFFFFF, muted text #9AA3B5. The most coherent "tech consultancy" palette in the batch: dark hero panels with a single vivid blue accent and white pill CTAs. Works for the hero, dark sections and portal dark mode (with the charcoal ladder #1E1F24 / #24252B / #2E3038 from 5072 as a neutral alternative).
2. **Clean white + periwinkle glow (IMG_5070):** white #FFFFFF, wash #EEF0FF, primary #5B5BF0, glow #8B8CF5 / #A9C1FF, ink #111827, grey #6B7280. A light, airy SaaS palette ideal for pricing/FAQ pages. It could be retuned towards Kuzikode's blue (swap #5B5BF0 for #1F6BFF) so it pairs with palette 1 as the light-mode counterpart.
3. **Monochrome editorial (IMG_5066):** paper #F2F2F2, white #FFFFFF, ink #0A0A0A, grey #8A8A8A, no chromatic accent. A strong base for an editorial layout if a single brand accent is added (e.g. #1F6BFF from palette 1, or a Zimbabwe-inspired warm accent). Black-section/grey-section alternation gives rhythm without colour noise.

---

## Reference websites (R0.4)

Captured with Playwright at 390×844 (mobile UA, touch) and 1440×900 on 2026-11-12. Screenshots stay out of git (`.shots/refs/`).
landing.love returned 403 and siteinspire 429 to automation; awwwards reset the connection. hoverstat.es and curated.design
(agency category) were captured instead. Nothing below is copied; these are observations that shaped decisions.

### webdev.co.zw (primary mobile reference)
- **Mobile first viewport does work, not decoration:** a dark hero with a short headline, one line of proof and an actual tool
  (domain search) inside the first screen; four icon + label proof rows below it. → Our home hero carries a real action (a
  "what do you need?" chooser that deep-links to the right division / package), not just two buttons.
- **Audience split early:** "Existing customer / New business" cards right after the hero send people to the right path. → Home
  second section: "I need a website / an app or system / AI or automation / to pay an invoice" routes (pay → client workspace).
- **Plans-from prices on service cards** with a single orange CTA each, and a Paid / Monthly / Annual segmented control above
  them. → Division rows on home show "from $X" taken from real package data; pricing uses a segmented control for categories.
- **Contact block as stacked tappable channel tiles** (WhatsApp, knowledge base, pay bill) with icon + label + sub-label. → Mobile
  footer and contact page use full-width channel tiles, 56 px tall.
- **Footer** groups links in short labelled lists with pill chips for the group sites. → Our footer: compact two-column link lists
  on phones, chips for legal links.
- Weaknesses to avoid: orange everywhere flattens hierarchy; an infographic clip-art style; long runs of identical white cards.

### vetech.co.zw (pricing and services reference)
- **Service page anatomy:** breadcrumb → plain promise headline → two CTAs (call, WhatsApp) → "focus area" chips → "which one do
  you need?" comparison of two products → price cards (dark card = most popular) → "Included with every website" list → timeline
  bars comparing delivery time → real shipped work with stack tags. → Division page order adopts this anatomy with our data: chips
  for sub-services, package cards, an "included in every package" strip built from features present in every package, and delivery
  times shown as proportional bars from the real `delivery_time` values.
- **Most popular = inverted dark card**, not just a border. → Our recommended package is the felt-navy card (see direction).
- **Desktop:** generous left-aligned headline with a coloured second line; work cards with real screenshots; dark footer with
  three plain lists and one outline CTA.
- Weaknesses to avoid: magenta gradient decoration, large empty bands between sections on mobile, ALL-CAPS button labels.

### hoverstat.es and curated.design (research list)
- Galleries of studio sites: the strongest agency sites lead with one oversized typographic statement, use strict left alignment,
  numbered index lists of services instead of card grids, and let motion live in hover reveals of imagery. → Services as a numbered
  index list (directory rows) rather than a six-card grid; hover/press reveals the division's sub-services.
- Thumbnails show restraint with colour: one ground, one ink, one accent.
