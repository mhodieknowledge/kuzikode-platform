# Image requests (agent → owner)

The agent adds prompts here in batches while it builds (see `BRIEF.md` B.4). **The owner generates the images in the Gemini app** and
delivers them to either:
- `design/inbox/` in this repo (GitHub: open the folder → **Add file → Upload files** → commit to main), or
- the Cloudflare R2 bucket **`images`**, inside a folder named **`incoming/`** (for big batches).

Name each file exactly as its **file** field says (`.png` or `.jpg` both fine). The agent picks them up at the start of its next session.
The build never waits for these: every section has a designed fallback until its image arrives.

Status values: `requested` → `delivered` (agent placed it) / `redo: <reason>` (agent asks for another try).

---

<!-- Template for each request (the agent copies this block):

### <slot-id>: <page> · <section>
- **file:** `<slot-id>.png`
- **purpose:** <what this image does in the layout>
- **aspect:** desktop <W:H> · mobile crop <W:H> (keep the subject inside the central safe area)
- **status:** requested · batch <n> · <date>

```
<complete, self-contained prompt matching the chosen visual direction; no text, no logos, no watermarks>
```
-->

## Batches

### Batch 1 · superseded: palette change, don't generate (2026-11-12, replaced by batch 2)

Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles.

### div-web-development: Home + Services · directory lit frame and division hero (Web development)
- **file:** `div-web-development.png`
- **purpose:** Shown beside the services directory when 'Web development' is lit, and as the division page hero.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
A laptop open on a pale concrete desk beside a tall window with vertical concrete sun-fins casting parallel shadows; the laptop screen shows an abstract blurred website layout in navy and white; a cobalt-blue notebook lies next to it; empty chair; Harare midday light. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-mobile-desktop-apps: Directory frame + division hero (Mobile & desktop apps)
- **file:** `div-mobile-desktop-apps.png`
- **purpose:** Lit frame and hero for apps.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
Close-up of two hands holding a mid-range Android phone at a shop counter, the phone screen blurred abstract navy and white interface, a desktop monitor softly out of focus behind, counter made of pale concrete, one cobalt-blue receipt clip on the counter; hands only, no face. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-business-software: Directory frame + division hero (Business software)
- **file:** `div-business-software.png`
- **purpose:** Lit frame and hero for ERP/POS/inventory.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
An orderly small warehouse storeroom in Harare: steel shelving with labelled cardboard boxes (labels blank), a barcode scanner resting on a clipboard in the foreground, a tablet on a stand showing an abstract navy dashboard, one cobalt-blue crate; daylight from high windows. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-ai-data: Directory frame + division hero (AI, data & intelligence)
- **file:** `div-ai-data.png`
- **purpose:** Lit frame and hero for AI and data.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
A neat stack of printed invoices and receipts on a pale concrete table being sorted into three trays, one tray cobalt blue, a phone camera on a small stand above the papers as if scanning them, soft daylight, minimal and precise. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-automation-integration: Directory frame + division hero (Automation & integration)
- **file:** `div-automation-integration.png`
- **purpose:** Lit frame and hero for automation and payments integration.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
Detail of a modern office network cabinet with neatly bundled cables in navy and white, one cobalt-blue patch cable running across, cable labels blank, cool daylight, extremely tidy, shallow depth of field. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-cloud-it: Directory frame + division hero (Cloud, infrastructure & IT)
- **file:** `div-cloud-it.png`
- **purpose:** Lit frame and hero for cloud and IT.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
Looking up at a modernist Harare office tower facade with rhythmic vertical concrete fins against a clear deep-blue sky, one window lit cobalt blue, strong graphic composition, no signage. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### about-lobby: About · story section
- **file:** `about-lobby.png`
- **purpose:** Editorial image that embodies the 'Directory' world on the About page.
- **aspect:** desktop 3:2 · mobile crop 4:5 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
A modernist office building lobby in Harare: a dark navy felt tenant directory board with white letter rows (letters too small and soft to read), terrazzo floor, concrete columns, a lift door with a small lit floor indicator, morning light, no people. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### contact-counter: Contact · channel panel
- **file:** `contact-counter.png`
- **purpose:** Supports the contact page beside the channels.
- **aspect:** desktop 4:5 · mobile crop 16:9 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
A reception counter of pale concrete with a desk phone, a small potted aloe, and a cobalt-blue pen on a blank notepad, a glass door behind with soft Harare street light, no people, no text. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### careers-desk: Careers · hero
- **file:** `careers-desk.png`
- **purpose:** Supports the careers page without showing anyone as staff.
- **aspect:** desktop 16:9 · mobile crop 4:5 (keep the subject inside the central safe area)
- **status:** superseded · batch 1 (navy/cobalt grade no longer used)

```
An empty, well-organised developer desk by a window: laptop closed, notebook with sketches of boxes and arrows (illegible), a mug, headphones, a cobalt-blue cable, morning light over Harare rooftops. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### Batch 2 · partly superseded (B.4a, 2026-11-12): only `about-studio` and `careers-desk` are still wanted (also listed in batch 3)
Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.

### div-web-development: Home route index · Services · division panel (Web development)
- **file:** `div-web-development.png`
- **purpose:** Division panel image on the services night band and the Web development page header.
- **aspect:** desktop 16:10 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded: SVG instead (B.4a) · don't generate

```
A laptop on a plain timber desk by a steel-framed window in a small Harare office, the screen softly out of focus showing an abstract website layout in bone and black, a ceramic mug and a paper sketch of page wireframes beside it, morning light across the desk. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-mobile-desktop-apps: Services · division panel (Mobile & desktop apps)
- **file:** `div-mobile-desktop-apps.png`
- **purpose:** Division panel image and page header for apps.
- **aspect:** desktop 16:10 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded: SVG instead (B.4a) · don't generate

```
Two hands holding a mid-range Android phone at a shop counter in Harare, thumb about to tap, the screen blurred, a small stack of receipts and a card machine on the counter, shallow depth of field. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-business-software: Services · division panel (Business software)
- **file:** `div-business-software.png`
- **purpose:** Division panel image and page header for business systems (POS, stock, ERP).
- **aspect:** desktop 16:10 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded: SVG instead (B.4a) · don't generate

```
A tidy hardware store counter in Harare with a barcode scanner, a receipt printer and a small terminal screen out of focus, shelves of labelled stock boxes in soft focus behind, warm morning light. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-ai-data: Services · division panel (AI, data & intelligence)
- **file:** `div-ai-data.png`
- **purpose:** Division panel image and page header for data and AI.
- **aspect:** desktop 16:10 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded: SVG instead (B.4a) · don't generate

```
A printed sales report with hand-drawn pencil annotations and a simple bar chart on a desk beside a closed laptop and reading glasses, seen from above at an angle, soft daylight, bone paper and warm wood tones. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-automation-integration: Services · division panel (Automation & payments)
- **file:** `div-automation-integration.png`
- **purpose:** Division panel image and page header for automation and payment integration.
- **aspect:** desktop 16:10 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded: SVG instead (B.4a) · don't generate

```
A small business owner seen from behind at a stall in a Harare market receiving a mobile-money payment on a phone held by a customer, the phones out of focus, colourful produce softly blurred, morning light. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-cloud-it: Services · division panel (Cloud & IT)
- **file:** `div-cloud-it.png`
- **purpose:** Division panel image and page header for cloud, email and IT support.
- **aspect:** desktop 16:10 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** superseded: SVG instead (B.4a) · don't generate

```
A neat small server cabinet and network switch in a clean office storeroom with plastered walls, cables carefully tied, a single green status light, an engineer's hand labelling a cable, calm soft light, no brand names. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### about-studio: About · editorial band
- **file:** `about-studio.png`
- **purpose:** Full-width editorial image for the About page: where the work happens.
- **aspect:** desktop 21:9 · mobile crop 4:5 (keep the subject inside the central safe area)
- **status:** requested · batch 2 · 2026-11-12

```
Interior of a small modern studio office in Harare: plastered walls, steel-framed windows with msasa trees outside, two long timber desks with laptops and notebooks, an empty chair pushed back, plants, morning light, nobody in frame. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### contact-street: Contact · beside the form
- **file:** `contact-street.png`
- **purpose:** Image beside the contact form: a calm, local sense of place.
- **aspect:** desktop 4:5 · mobile crop 16:9 (keep the subject inside the central safe area)
- **status:** superseded: not a hero, band or editorial placement (B.4a) · don't generate

```
A quiet tree-lined street in Harare in spring: msasa trees in red-brown new leaf, a low brick wall and steel gate, warm morning light, no people, no signs or readable text. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### careers-desk: Careers · header
- **file:** `careers-desk.png`
- **purpose:** Header image for Careers: learning and building together, without showing anyone's face.
- **aspect:** desktop 16:9 · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 2 · 2026-11-12

```
Two people seen from behind at a shared desk reviewing a printed design on paper next to a laptop, one pointing with a pencil, a window with soft daylight, notebooks and sticky notes, faces not visible. Art direction for every image in this batch: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### Batch 3 · ready for owner · 2026-11-12 (B.4a: photos only for heroes, mid-page bands and editorial sections)
Everything else (divisions, services, features, process, industries, pricing, empty states) is drawn as SVG in code. Still wanted from batch 2: `about-studio` (About · editorial band) and `careers-desk` (Careers · header), prompts above, unchanged.

### about-hero: About · page hero
- **file:** `about-hero.png`
- **purpose:** Hero image at the top of About, under the headline on phones and beside it on desktop.
- **aspect:** desktop 16:9 · mobile crop 4:5 (subject in the right two-thirds on desktop, centred on phones)
- **status:** delivered · 2026-11-13 · placed in About hero

```
Early morning in Harare seen from a first-floor studio window: steel window frame in the foreground, a timber desk with a closed laptop and a notebook on the sill, msasa trees and low city rooftops beyond in soft haze, warm light, calm and established. Art direction: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### services-hero: Services index · page hero
- **file:** `services-hero.png`
- **purpose:** Hero image for the services index, with the six division drawings presented below it.
- **aspect:** desktop 21:9 · mobile crop 4:5 (keep a quiet left third for the headline on desktop)
- **status:** delivered · 2026-11-13 · placed in Services hero

```
Top-down view of a long timber worktable in a Harare studio: a laptop, a phone, printed page wireframes, a small notebook with a pencil, a ceramic cup, cables neatly tied, morning window light raking across the table, orderly and premium, nobody in frame. Art direction: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### home-band: Home · mid-page full-bleed band (behind "Why Kuzikode")
- **file:** `home-band.png`
- **purpose:** Full-bleed background band behind a short statement, with a dark overlay for legible text on phones and desktop.
- **aspect:** desktop 21:9 · mobile crop 9:16 (subject low in the frame; the upper half stays calm for text)
- **status:** delivered · 2026-11-13 · processed; placement in R7.1

```
A small Harare shop counter at opening time: a shopkeeper's hands holding a mid-range Android phone to confirm a mobile-money payment, a paper receipt and a few packaged goods on the wooden counter, a brick wall and shelving softly out of focus, warm low morning light, documentary and quiet. Art direction: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### how-we-work-editorial: How we work · editorial section
- **file:** `how-we-work-editorial.png`
- **purpose:** Editorial image beside the "Discover" and "Design" stops: planning before building.
- **aspect:** desktop 3:2 · mobile crop 4:3
- **status:** delivered · 2026-11-13 · processed; placement in R7.1

```
Hands arranging paper cards and sticky notes into columns on a plastered wall next to a printed project timeline, one hand holding a marker, seen from behind and the side so no face is visible, soft daylight from a steel-framed window. Art direction: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### how-we-work-band: How we work · mid-page full-bleed band
- **file:** `how-we-work-band.png`
- **purpose:** Full-bleed band before the "Launch" and "Support" stops, overlaid with a single line of text.
- **aspect:** desktop 21:9 · mobile crop 9:16 (subject on the right on desktop, lower third on phones)
- **status:** delivered · 2026-11-13 · placed in How we work "What you can expect" band

```
A quiet evening handover in a small Harare office: a laptop open on a desk showing an abstract, unreadable dashboard in bone and black, a printed checklist with ticks beside it, a desk lamp switched on, the city softly visible through the window at dusk, warm and calm. Art direction: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### careers-culture: Careers · culture section
- **file:** `careers-culture.png`
- **purpose:** Editorial image for the culture and how-we-learn section on Careers.
- **aspect:** desktop 3:2 · mobile crop 4:5
- **status:** delivered · 2026-11-13 · processed; placement in R7.1

```
Two people at a shared desk seen from behind, one explaining something on a laptop to the other who takes notes in a notebook, plants and a steel window with msasa trees outside, relaxed and focused, faces not visible. Art direction: documentary photography in Harare, Zimbabwe, soft clear morning daylight, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm and orderly, real-looking materials (timber, plaster, concrete, brick, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare streets, local brick and steel windows), no readable text, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```
