# Home component map (R10.1)

Every one of the 29 images in `inspiration-images/` was opened and read. Summary first, then the per-image notes (written by fresh Sonnet subagents).

| Image | Component | Home section | Verdict |
|---|---|---|---|
| IMG_5013 | Outlined pill rows, "from" chip + chevron | services | adapt |
| IMG_5014 | Floating glass price card over photo | hero | adapt |
| IMG_5015 | Stepper with thin line, circled numerals | how | adapt |
| IMG_5016 | Overlapping cards on concentric rings | cta | adapt (overlap only) |
| IMG_5017 | Bottom-anchored hero text, tag pill, frosted chips | hero | adopt |
| IMG_5018 | Equal-width selectable tiles, tabular prices | pricing | adapt |
| IMG_5048 | Service cards overlapping hero base | hero+services | adapt |
| IMG_5049 | 2x2 icon grid with hairlines | why | adapt |
| IMG_5050 | Floating widget on hero bottom edge, utility bar | hero | adapt |
| IMG_5051 | Peeking carousel with revealed caption | services | adapt |
| IMG_5052 | Pill CTA with circular arrow, icon trust row | cta/why | adapt |
| IMG_5054 | Highlighted middle tier, inverted open FAQ row | pricing/faq | adapt |
| IMG_5055 | Rounded hero card, numbered pill service rows | services | adapt |
| IMG_5056 | Overlay chip on photo, segmented tabs | hero/services | adapt |
| IMG_5057 | Eyebrow pill + heading rhythm, gradient CTA card | section rhythm/cta | adapt |
| IMG_5058 | Inverted featured card, "included in all" icon row | pricing/why | adapt |
| IMG_5059 | Notched colour price tab | services | adapt |
| IMG_5060 | Eyebrow + heading only | section rhythm | skip (duplicate) |
| IMG_5061 | Frosted price cards, circled-check rows | pricing | adapt |
| IMG_5062 | Photo hero with primary+ghost CTA, scroll then button | hero | adapt |
| IMG_5063 | Glass tiles, price pill, pill+arrow CTA over photo | hero | adopt |
| IMG_5064 | Service card with corner-circle icon, arrow button | services | adapt |
| IMG_5065 | Five-tile division strip, dark photo CTA band | services/cta | adapt |
| IMG_5066 | Numbered steps with dashed connector | how | adapt |
| IMG_5067 | Marquee band + numbered process row | divider/how | adapt |
| IMG_5069 | Inverted featured card in a row, edge-bleed hero | services | adapt |
| IMG_5070 | Compact price card, ghost footer wordmark | pricing/footer | adapt |
| IMG_5071 | Centered reassurance CTA | cta | skip matrix, adopt CTA idea |
| IMG_5072 | Dark price band, 4x2 icon grid | pricing/why | adapt |

## Per-image notes

### IMG_5013
Shows: "I/O" ticket payment screen, periwinkle-blue monochrome, pill-outlined rows on a frosted rounded panel over a swirl pattern.
Component: Pill-bordered selectable rows (1px blue outline, ~16px radius, label left, logo chips + chevron right, selected row tinted with pattern) in one hue; bold blue display heading with small mono subcopy; bill summary strip as a single outlined bar. Copy as the service-division selector rows: name left, "from $X" chip + chevron right.
Home section: services
Verdict: adapt - monochrome pill rows are clean and tappable, but mono body type and pattern are too decorative; keep the outlined row and tinted selected state only.
Kuzikode content: five division rows (name, one-line scope, "From $X" chip, chevron to the division page); selected row expands to show the quote/WhatsApp CTA. Prices from the pricing docs only.

### IMG_5014
Shows: "AceCoinPay" card checkout modal with a floating bank card, ticket-style receipt panel and a countdown, on a blurred 3D wallpaper.
Component: Floating widget: a white rounded (~20px) card with soft layered shadow overlapping a photo/gradient backdrop, a perforated "ticket" summary panel with notched edges, label/value rows in small grey type and a large price ("549.99 USD", cents smaller) above a full-width solid blue button. Fits the hero overlay widget showing "Starting from" price and a quote button on top of the photo.
Home section: hero
Verdict: adapt - the glassy floating card on photo is exactly the hero overlay idea; drop the card-entry fields, timer and dense micro-text.
Kuzikode content: hero widget "Start a project": division picker, "From $X" price in large type with smaller cents, primary "Get a quote" and WhatsApp buttons; no fake order or client data.

### IMG_5015
Shows: Plain 3-step checkout (customer details, payment method, confirmation) with payment-brand radio tiles, totals table and a mint-green confirm bar.
Component: Stepper with thin connecting line, circled numerals (check for done, outline for current, grey for next), small uppercase 11px labels; below it a totals block on light grey with a bold TOTAL row and full-width flat CTA bar. Use the stepper for the process section.
Home section: how
Verdict: adapt - the stepper pattern is useful; the dated square boxes and form grid are not, restyle with our tokens and rounded shapes.
Kuzikode content: "How we work" 3 to 4 steps (Tell us the brief, Get a quote, We build, Launch and support) as a horizontal swipe-track on phones; no invented timelines or stats.

### IMG_5016
Shows: "Paymo" green payment mockup, a tilted-depth VISA card overlapping a pale card with network-dot lines, on concentric-circle gradient backdrop.
Component: Overlapping cards creating depth: a saturated brand-colour card breaking out past the left edge of a pale rounded (~28px) panel, concentric circular gradient rings behind as brand background, small pill CTA, subtotal/total rows right-aligned with a hairline above total. Overlap composition is worth copying for a CTA band where an image card overlaps a text panel.
Home section: cta
Verdict: adapt - concentric ring backdrop and overlap are distinctive; the dim grey text has poor contrast and the network-dot decoration is generic, so skip those.
Kuzikode content: CTA band: brand-green ring background, pale panel with "Tell us what you need" plus a Get a quote pill and WhatsApp button, overlapping dark card listing the five divisions with "From $X" lines.

### IMG_5017
Shows: "ninth" sign-up split screen, left a blue gradient panel with headline and three step cards, right a clean white form.
Component: Rounded (~28px) gradient panel with frosted translucent step cards (first card solid white with numbered blue badge, others 20% white glass), large 48px headline bottom-left, tag pill above ("Join Us to Build"), subtitle 18px light. Strong hero composition: pill, big headline, subtitle, then row of glass chips at the bottom of a photo.
Home section: hero
Verdict: adopt - bottom-anchored text over a rounded media panel with frosted chips is the right mobile hero; replace the gradient with a real photo plus dark gradient overlay for legibility.
Kuzikode content: photo hero with tag pill (Zimbabwe digital agency), headline, subline, and a row of frosted chips (the five divisions, first active) each linking to its division; CTA pill buttons Get a quote and WhatsApp.

### IMG_5018
Shows: Clean checkout form in white bordered cards (shipping, payment method tiles, order summary) with an indigo CTA.
Component: Segmented method tiles (3 equal icon-over-label tiles, 1px grey border, selected = 2px indigo border and indigo label), order-summary card with label/amount rows, monospace right-aligned figures and a bold Total above a full-width gradient button. Tile selector pattern suits pricing package picking; tabular mono figures suit price chips.
Home section: pricing
Verdict: adapt - take the equal-width selectable tiles and tabular price rows; skip the form fields and generic indigo.
Kuzikode content: pricing teaser: tiles per package tier (names and prices from 12-COMMERCIAL-FEATURES only), selected tier shows its inclusions list, tabular "From $X" price and a Get a quote button.

### IMG_5048
Shows: "Stratech" engineering site, deep navy night-city photo hero with serif headline, three image-top cards overlapping the hero base.
Component: Hero + overlapping service cards: full-bleed photo with navy gradient overlay, large light serif H1 (2 lines, left), one-line sub, solid blue rectangular CTA; below, 3 equal cards (photo top ~55%, navy text panel with title left, line icon right, ghost "Discover More" button) pulling up over the hero's lower edge; 1px light borders, ~16px gutters.
Home section: hero + services
Verdict: adapt - the overlap of cards onto the hero is strong, but use sharper sans, 5 divisions as a swipe track on phone, rounded-md corners.
Kuzikode content: cards = our 5 divisions with real "From $X" price chip in place of lorem; photo per division from owner images; CTA "Get a quote" + WhatsApp.

### IMG_5049
Shows: "Skystructure" dark-blue skyscraper hero, then a 3-column band (About / Expertise 2x2 icon grid / Recent projects) overlapping the hero, then white overview with stat tiles.
Component: Floating glass panel band: translucent navy panels (About, 2x2 expertise with thin line icons and hairline dividers, stacked image cards with dark caption bars) sliding over the hero bottom, then switch to a white section with light bordered stat boxes (large blue numerals + small label).
Home section: services (also how)
Verdict: adapt - take the 2x2 icon-grid-with-hairlines pattern for "why us"; skip the stat boxes.
Kuzikode content: 2x2 grid of verifiable promises (fixed starting prices, WhatsApp support, mobile-first builds, local payments Paynow/PesePay); no numbers like "+350 projects" since we cannot claim them.

### IMG_5050
Shows: "CodeNova" IT agency: utility top bar + light nav, dark photo hero with tech graphic, a floating white stat card with a person at hero bottom-right, dark service card row.
Component: Floating widget on hero: white rounded card (about 45% width on desktop, overhangs hero bottom-right, notched corner) with big bold number and label plus a cutout photo; also a dark "Our Services" band of 4 rounded cards (image top, 14px title, 11px grey copy, thin border #1b2a4a on near-black navy) under a small pill eyebrow label.
Home section: hero (widget) + services
Verdict: adapt - floating hero widget idea is exactly the brief, but the card should hold real info not a vanity stat.
Kuzikode content: widget = "Free quote in 24h" mini form or "Chat on WhatsApp" with typical-reply line, plus a "Starting from $X" chip; top utility bar with phone, WhatsApp, hours (real contact data only).

### IMG_5051
Shows: "Editech" IT consulting template: angled/diagonal-cropped hero photo, horizontal service carousel with arrows, diamond-cropped about image, purple-gradient icon-card section.
Component: Service carousel: peeking row of tall image cards (about 2:3, gradient navy-to-blue bottom overlay with title at bottom-left), the active card reveals a white caption card with icon + short text, round arrow buttons bottom-right; hexagonal pink icon badges on a gradient band.
Home section: services
Verdict: adapt - carousel with peeking next card and revealed caption is ideal for phones; skip diagonal crops and purple gradient (off-brand, dated).
Kuzikode content: 5 divisions as snap-scroll cards (scroll-snap-x, 78% card width to show peek), caption reveals starting price + "Get quote" link; arrows hidden on touch, dots shown.

### IMG_5052
Shows: "créer" webdesign agency: white airy page, blue blob/shape-masked city photo hero, bold uppercase sans H1, pill CTA with circular arrow button, blue tile bento grids.
Component: Bento services row + pill CTA: a solid blue label tile ("NOS SERVICES", icon top, uppercase 2-line label bottom-left) beside white shadow cards (icon in pale-blue square, 15px bold title, 11px grey copy, "Voir l'offre" text link with round blue arrow button); CTA = pill, blue, text left + white circle arrow right; trust row of 4 icon+uppercase micro labels; contact card with phone/email/map beside a blue tile.
Home section: services + cta
Verdict: adapt - arrow-circle pill CTA and icon+label trust row are great and light; use rounded rectangle hero image not the blob.
Kuzikode content: pill CTA "Get a quote" with circular arrow; trust row = Fixed prices / WhatsApp support / Mobile-first / Secure payments; contact card with real WhatsApp number and a "Write to us" button (map only if owner gives address).

### IMG_5054
Shows: Monochrome dark SaaS template (SEO tool) with glossy 3D hero shape, logo marquee, bento feature tiles, 3-tier pricing, FAQ accordion, big footer wordmark.
Component: Pricing tiers + FAQ accordion: three dark cards side by side with the middle one inverted white and slightly raised (price in 24px+ bold, tiny feature list, full-width pill CTA); FAQ as stacked dark rows with plus icons, one open row inverted white; section headings use 2-tone text (white then 50% grey) with small pill eyebrow tag; giant outlined wordmark in footer.
Home section: pricing
Verdict: adapt - the highlighted middle tier and the inverted open-FAQ row; skip logo marquee (no clients to show), skip 3D gloss.
Kuzikode content: pricing teaser of division starting prices (highlight the most popular package, no fabricated "most chosen" claims unless real), FAQ with real answers (payments, timelines, WhatsApp); footer wordmark "Kuzikode" large.

### IMG_5055
Shows: Creatix agency landing (desktop + mobile): white rounded hero card on near-black page, neon-lime accent, black pill nav.
Component: Hero composition. Big centred 2-line headline (~56px desktop, medium weight) above a cut-out person photo in a pale circle, tiny supporting copy left, rating/"10 Years" widget right, dual pill CTAs (lime filled + dark outline) overlapping the photo bottom; hero card has ~48px bottom radius and sits on dark. Below: single rounded stat strip (4 figures, lime "+" suffix), numbered pill service list (01-04 with arrow) beside a photo, lime marquee band ("Innovate + Inspire + Create").
Home section: hero (also services, stat strip)
Verdict: adapt - dark/light split hero card, numbered pill service rows and marquee band are strong; skip cut-out stock person, 2000+/150M stat strip, team and testimonial cards (would be invented).
Kuzikode content: Hero card with real photo, dual CTAs "Get a quote" + "WhatsApp us"; 5 divisions as numbered pill rows each with "from $X" chip; marquee of real service names (Websites + Apps + Branding...). No stats.

### IMG_5056
Shows: Xenon Bank fintech landing, mobile-first: dark navy hero fading to white sections, emerald green accent, rounded cards.
Component: Hero + floating widgets. Mobile hero is a dark rounded card: 32px headline with one word in green, 3 short benefit lines with tick, green pill CTA, cut-out person in a green rounded-arch panel, avatar-stack chip ("12M active users") overlapping photo bottom. Below: segmented pill tabs (Line of Credit / Equipment / Merchant) switching a card with photo right, tick bullets, CTA.
Home section: hero (and services as tabs)
Verdict: adapt - overlay chip on photo and tab-switched service card are good for mobile; skip awards badges, Trustpilot and user-count claims.
Kuzikode content: Photo hero with overlay chips (e.g. "Quotes in 24h"? only if true, else "From $X" price chip and WhatsApp chip); 5-tab segmented control for divisions, each card: photo, 3 ticks, "from" price, Quote CTA.

### IMG_5057
Shows: Finseer SaaS mobile kit: purple-gradient hero card, pill labels, feature cards, FAQ accordion, pricing toggle, gradient CTA card.
Component: Section rhythm and CTA band. Each section opens with a small pill eyebrow (icon + label), centred 32-36px heading, muted 14px subcopy; cards ~20px radius with icon tile top; accordion FAQ rows with +/- in bordered rounded rows; closing gradient rounded card ("Ready to...?") with email input and black pill button; pricing card shows big price, black full-width button, circled-tick list.
Home section: cta (also why, pricing)
Verdict: adapt - eyebrow pill + centred heading rhythm, FAQ rows and gradient CTA card; skip logo cloud, testimonials, "1000+ companies".
Kuzikode content: Closing CTA card "Tell us what you need" with WhatsApp + quote buttons; FAQ about pricing, timelines, payment (Paynow/PesePay, only real facts); service cards with icon tile and "Learn more".

### IMG_5058
Shows: Two-tier pricing poster on vivid blue: white Basic card vs outlined blue Pro card with "Best value" pill, 4-up "All plans include" icon row.
Component: Price card pair. Cards ~24px radius; plan name 28px bold, price ~64px bold with small "/month", hairline divider, tick list with row dividers, full-width button (black on white card, white on blue card); featured card inverted colours and pill badge top-right; footer row of 4 icon+title+caption columns separated by thin vertical rules.
Home section: pricing
Verdict: adapt - inverted featured card and "included in all" icon row are clean; skip two-tier assumption.
Kuzikode content: Featured division card inverted with "Most requested" only if true, otherwise "Popular start"; "All projects include" row (e.g. mobile-first build, hosting setup, WhatsApp support) using only real commitments.

### IMG_5059
Shows: Dark four-column pricing with gradient-outlined cards, monthly/yearly toggle with "Save 20%" chip.
Component: Price chip / card. Each card has a distinct gradient outline (~3px, 28px radius) and a tab-shaped gradient price block cut into the top-left holding large dark price + "/mo"; plan name 28px, 14px description, hairline, small tick list, small gradient button centred at the bottom.
Home section: pricing (price chip for services)
Verdict: adapt - the notched colour price tab is a distinctive "from $X" chip for the 5 division cards; skip 4-column desktop layout on phones (use swipe track) and toggle.
Kuzikode content: Each division card gets a colour-coded notched "From $X" tab, one-line description, 4 ticks, "Get a quote" button; horizontal swipe-snap on mobile.

### IMG_5060
Shows: Light four-plan pricing grid (Frameblox): pale-blue cards, solid blue featured card with "Best Seller" pill, Monthly/Yearly segmented toggle.
Component: Pricing grid. Left-aligned blue eyebrow "Pricing", 40px bold heading, grey subline; cards ~24px radius pale blue (#EEF5FF), uppercase 12px blue plan label, 56px bold price, "Billed monthly" caption, tick list, blue 8px-radius button; featured card slightly taller, solid blue, white button.
Home section: pricing
Verdict: skip - near-duplicate of 5058/5059 with less character; only the left-aligned eyebrow + heading pattern is worth keeping. Its "over 100 creators" claim is a no-go.
Kuzikode content: Use only the eyebrow + heading pattern and taller featured card idea if one division is highlighted.

### IMG_5061
Shows: Dark glassmorphism pricing section, giant gradient "Pricing" headline half-hidden behind three frosted cards, "Billed Yearly" toggle below.
Component: Price card trio. Rounded 28-32px cards, 1px hairline border, translucent black blur, price at ~40px semibold, plan name small grey, divider, 5 checklist rows with circular check badges, full-width pill CTA at bottom (the featured middle card has a white pill, others black outline). Oversized headline overlapping the card tops adds depth. Cards ~32px gap, 32px inner padding.
Home section: pricing
Verdict: adapt - keep the pill CTA, check badges and featured-card inversion; drop the yearly toggle (we have starting prices per division, not billing tiers) and stack as a swipe track on phones.
Kuzikode content: five division cards "From $X" (real starting prices from 12-COMMERCIAL-FEATURES), 3-5 real deliverables per division as check rows, "Get a quote" / WhatsApp pill; feature the most-requested division only if the owner confirms.

### IMG_5062
Shows: ufaber education landing page, phone and tablet comps side by side, six stacked sections (hero, feature, course carousel, categories, instructors, dark footer).
Component: Mobile page rhythm. Dark photo hero with centred headline, two stacked CTAs (solid green primary + ghost secondary); then alternating white / pale-tint sections; horizontally scrolling course cards with a centred "Browse" button underneath; navy footer with link columns. Shows the section order and the phone to desktop collapse.
Home section: hero
Verdict: adapt - use only the hero structure (photo, overlay darkening, primary + secondary CTA pair) and the scroll-card-then-button pattern; the visual style is dated and the rest is generic.
Kuzikode content: photo hero with "Get a quote" (primary) and "WhatsApp us" (secondary); services as a swipe track with a "See all services" button beneath. No instructor logos or reviews.

### IMG_5063
Shows: Dark blue travel-app showcase: huge headline, hand holding a phone, floating rounded widget cards around it, plus five phone screens of image-overlay cards.
Component: Floating widgets and image-overlay card. Around a central visual sit translucent rounded-24 tiles (blurred navy, white 12-14px text): a place label with circular arrow button, a white price pill ("$200 / per night"), a time/duration tile with a white "Book now" pill and round blue icon button. Phone cards: full-bleed photo, title bottom-left, small glass "from $99" chip top-right, white pill CTA with attached dark circular arrow button.
Home section: hero
Verdict: adopt - this is the closest match to our brief (photo hero with overlay widgets, mobile first); copy the glass tile recipe, price chip and pill+arrow CTA.
Kuzikode content: hero photo with 2-3 glass widgets: "Websites from $X" chip, a division tile with arrow, a "Chat on WhatsApp" white pill. Division cards as photo-overlay cards with the from-price chip and "Get a quote" pill-arrow. Only real prices, no counts.

### IMG_5064
Shows: Amiso agency Services page: photo hero with title, 3x2 grid of white service cards, dark footer with newsletter bar and four columns.
Component: Service card. White card, 1px light border, 8px radius, bold 20px title, grey 2-line description, bottom row with round white arrow button + "Read more", and a large pale-grey quarter-circle in the bottom-right holding a red line icon; hovered card turns the arrow red with a soft shadow. Cards ~300px wide, 24px gap, 38px padding.
Home section: services
Verdict: adapt - corner-circle icon and arrow-button hover are nice and clear; make the cards bigger touch targets, one column on phone, and add the starting price.
Kuzikode content: five division cards (name, one-line outcome, "From $X" chip, arrow link to the division page) with a brand-colour line icon in the corner circle. Footer idea: a dark footer with a contact column (WhatsApp, email), no fake portfolio thumbnails.

### IMG_5065
Shows: Nisoz digital marketing agency template, full page: black/lime hero with diagonal slashes, lime band with five dark service tiles, B&W photos, CTA banner, projects, footer form.
Component: Service tile strip plus CTA band. A lime band sits directly under the hero with a heading left and five equal near-black square tiles (icon top, uppercase 11px label, tiny "read more"); a full-width greyscale photo band with a lime play triangle and a bold uppercase centred statement + button works as the CTA band. Strong two-colour contrast, diagonal cut edges on the hero.
Home section: cta
Verdict: adapt - take the five-tile strip (matches our 5 divisions) and the dark photo CTA band; skip the loud lime palette, logo row, news and stock-photo people.
Kuzikode content: five-tile division strip overlapping the hero bottom edge on desktop (horizontal scroll on phone); closing CTA band: dark photo, one line "Tell us what you need", WhatsApp + quote buttons. No "logos" or recent-clients sections.

### IMG_5066
Shows: Creatiwise design-agency page: light grey rounded-card layout, pill nav with black "Contact Us" button, hero with portrait and floating badge, process cards, dark services grid, project carousel, testimonial, CTA card.
Component: How-it-works steps. Four white cards numbered 01-04 (small grey number, bold title, short text), each rotated a few degrees and "pinned" with a grey dot, joined by a dashed curved line zig-zagging down the page, ending in a handwritten "Ready to be delivered!" note. Also a dark section with a 3x2 grid of outlined cards, and a black rounded CTA card with a small white pill button.
Home section: how
Verdict: adapt - steps with a dashed connector read well on a phone as a vertical track; reduce the rotation to 1-2 degrees and skip the doodles; the dark 3x2 grid and black CTA card are secondary ideas.
Kuzikode content: 4 steps: Tell us the need, Get a quote, Build and review, Launch and support (confirm against the PRD flow); no invented stats, clients or testimonials, no logo marquee.

### IMG_5067
Shows: Blue/navy IT-agency landing page: dark photo hero, marquee band, about collage, service cards, 4-step process.
Component: Full-bleed blue (#3B6CF0-ish) marquee band of service names separated by asterisk glyphs, bold 24px white, ~56px tall, docked directly under the hero; also a 4-step process row with numbered navy dots (01-04) on the icon circles joined by thin lines, and service cards (white, 12px radius, blue icon tile, title, 3-line blurb, "Learn more ->").
Home section: services (marquee band as hero-to-services divider; process row as how)
Verdict: adapt - the marquee band and numbered process row are great and cheap; skip the stat counters, CEO signature and "99% satisfaction" block (fabricated-claim risk), and the dark-overlay hero is stock-people generic.
Kuzikode content: Marquee scrolls our 5 division names (CSS-only, reduced-motion pauses); process row = Brief, Quote, Build, Launch with real steps; service cards carry division name plus "From $X" price chip and WhatsApp link.

### IMG_5069
Shows: AI-mocked light agency site: light-grey gradient hero with cut-out presenter, 4 equal feature cards (one navy inverted), mixed photo/gradient tiles, navy CTA panel.
Component: Hero composition - left-aligned 48-56px semi-bold headline, two pills (solid blue primary + white ghost with arrow), person cut-out bleeding off the bottom-right edge, small round navy "+" floating button on the image edge; below, a row of 4 white cards (16px radius, hairline border, icon top-left, round dot button top-right) where the featured card is navy with white text.
Home section: hero (and services via the 4-card row with one inverted featured card)
Verdict: adapt - the inverted-card-in-a-row hierarchy and edge-bleeding hero image with floating dot button are useful; the text is garbled AI output and the white-on-grey look is too generic.
Kuzikode content: Hero uses a real photo with overlay widgets (WhatsApp pill, "Get a quote" dot button); divisions as cards with the flagship/most-requested division inverted navy; each card shows a "From $X" chip, no invented names.

### IMG_5070
Shows: Purple-blue gradient SaaS pricing page: 3 plan cards, comparison table, FAQ accordion, newsletter band, big watermark-wordmark footer.
Component: Price chip/plan card - 16px radius white card on soft lavender gradient, plan name 14px, price 36-40px bold with small grey "/Month" suffix, full-width outlined pill button (middle "Popular" card gets gradient-filled CTA, blue border and glow), divider, "Features included" list with filled blue check circles and grey checks for excluded; also a segmented pill-nav in the header and a giant ghosted wordmark at footer bottom.
Home section: pricing (and footer via oversized ghost wordmark)
Verdict: adapt - take the price typography, highlighted middle card and check list as a compact pricing teaser; skip monthly/annual toggle, newsletter band and 3-tier table (our model is per-division "from" prices).
Kuzikode content: Swipe-track of 5 division price cards ("From $X", 3-4 included items, WhatsApp/quote button), the best-fit one highlighted; footer ends with huge faint "KUZIKODE" wordmark.

### IMG_5071
Shows: Desktop enterprise pricing comparison matrix (HackerRank style) with sticky highlighted column, big CTA, two-column FAQ, link-column footer.
Component: Comparison matrix with a raised "Most popular" column (3px green top rule, drop shadow, white vs grey-blue rows), tiny tracked-uppercase section labels, thin check/dash rows, and a centered "Still not convinced?" CTA block with one big button on white.
Home section: cta (the reassurance CTA block; matrix itself belongs on /pricing)
Verdict: skip for home - a wide matrix fails on phones and the palette is off-brand; borrow only the short centered reassurance CTA ("no obligation, free quote") and tracked-caps footer headings.
Kuzikode content: Home ends with centered CTA: "Not sure which service you need? Message us on WhatsApp" with one large button and a quote link; footer link columns use small uppercase labels (Services, Company, Contact).

### IMG_5072
Shows: Dark-mode (charcoal #1F2026) SaaS pricing page with blue accents: 3 plan cards, 8-item feature grid, 4-column pricing table.
Component: Dark plan cards - 20px radius, #2C2E36 surface, uppercase blue 12px plan label, 48px bold price, muted "Billed monthly", blue check list, full-width 40px blue button; centre card flips to solid electric blue (#0A66FF) with white pill "Best Seller" badge and inverted dark button. Feature grid below: 4x2, 48px circular muted icon, bold 15px title, 3-line grey blurb.
Home section: pricing (dark band) and why (the 4x2 icon grid)
Verdict: adapt - a dark price band for contrast against light sections with the solid-blue featured card works well on phones as a swipe track; skip the table and monthly billing language.
Kuzikode content: Dark "Starting prices" band: 5 division cards swiping horizontally, featured card in brand blue with a "Most requested" badge only if the owner confirms it; why grid = real differentiators (local WhatsApp support, mobile-first builds, clear upfront pricing) with no counts or client claims.

