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

### Batch 1 · ready for owner · 2026-11-12

Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles.

### div-web-development: Home + Services · directory lit frame and division hero (Web development)
- **file:** `div-web-development.png`
- **purpose:** Shown beside the services directory when 'Web development' is lit, and as the division page hero.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
A laptop open on a pale concrete desk beside a tall window with vertical concrete sun-fins casting parallel shadows; the laptop screen shows an abstract blurred website layout in navy and white; a cobalt-blue notebook lies next to it; empty chair; Harare midday light. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-mobile-desktop-apps: Directory frame + division hero (Mobile & desktop apps)
- **file:** `div-mobile-desktop-apps.png`
- **purpose:** Lit frame and hero for apps.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
Close-up of two hands holding a mid-range Android phone at a shop counter, the phone screen blurred abstract navy and white interface, a desktop monitor softly out of focus behind, counter made of pale concrete, one cobalt-blue receipt clip on the counter; hands only, no face. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-business-software: Directory frame + division hero (Business software)
- **file:** `div-business-software.png`
- **purpose:** Lit frame and hero for ERP/POS/inventory.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
An orderly small warehouse storeroom in Harare: steel shelving with labelled cardboard boxes (labels blank), a barcode scanner resting on a clipboard in the foreground, a tablet on a stand showing an abstract navy dashboard, one cobalt-blue crate; daylight from high windows. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-ai-data: Directory frame + division hero (AI, data & intelligence)
- **file:** `div-ai-data.png`
- **purpose:** Lit frame and hero for AI and data.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
A neat stack of printed invoices and receipts on a pale concrete table being sorted into three trays, one tray cobalt blue, a phone camera on a small stand above the papers as if scanning them, soft daylight, minimal and precise. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-automation-integration: Directory frame + division hero (Automation & integration)
- **file:** `div-automation-integration.png`
- **purpose:** Lit frame and hero for automation and payments integration.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
Detail of a modern office network cabinet with neatly bundled cables in navy and white, one cobalt-blue patch cable running across, cable labels blank, cool daylight, extremely tidy, shallow depth of field. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### div-cloud-it: Directory frame + division hero (Cloud, infrastructure & IT)
- **file:** `div-cloud-it.png`
- **purpose:** Lit frame and hero for cloud and IT.
- **aspect:** desktop 4:5 (lit frame) and 16:9 (division hero) from one 3:2 master · mobile crop 4:3 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
Looking up at a modernist Harare office tower facade with rhythmic vertical concrete fins against a clear deep-blue sky, one window lit cobalt blue, strong graphic composition, no signage. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### about-lobby: About · story section
- **file:** `about-lobby.png`
- **purpose:** Editorial image that embodies the 'Directory' world on the About page.
- **aspect:** desktop 3:2 · mobile crop 4:5 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
A modernist office building lobby in Harare: a dark navy felt tenant directory board with white letter rows (letters too small and soft to read), terrazzo floor, concrete columns, a lift door with a small lit floor indicator, morning light, no people. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### contact-counter: Contact · channel panel
- **file:** `contact-counter.png`
- **purpose:** Supports the contact page beside the channels.
- **aspect:** desktop 4:5 · mobile crop 16:9 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
A reception counter of pale concrete with a desk phone, a small potted aloe, and a cobalt-blue pen on a blank notepad, a glass door behind with soft Harare street light, no people, no text. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```

### careers-desk: Careers · hero
- **file:** `careers-desk.png`
- **purpose:** Supports the careers page without showing anyone as staff.
- **aspect:** desktop 16:9 · mobile crop 4:5 (keep the subject inside the central safe area)
- **status:** requested · batch 1 · 2026-11-12

```
An empty, well-organised developer desk by a window: laptop closed, notebook with sketches of boxes and arrows (illegible), a mug, headphones, a cobalt-blue cable, morning light over Harare rooftops. Art direction for every image in this batch: documentary architectural and still-life photography in Harare, Zimbabwe, clear daylight, cool neutral grading with deep navy shadows (#0B1428) and pale concrete highlights (#F3F5F8), one small cobalt-blue accent (#2F57FF) somewhere in the frame, 35 mm lens, crisp focus, calm and orderly, no text, no logos, no watermarks, no screens with readable UI text, no glowing effects, no stock-photo smiles. Generate at the largest size available, 3:2 landscape master unless the aspect line says otherwise.
```
