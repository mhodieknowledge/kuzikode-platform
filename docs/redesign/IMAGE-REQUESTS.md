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
### Home batch · ready for owner · 2026-11-14 (R9.6, REFINEMENTS §7)
Earlier batches were completed and archived (git history of this file). The redesigned home page uses photographs only as hero and band backgrounds, always under an overlay with content and widgets on top (REFINEMENTS §3). **Widget imagery: none needed**; the hero's workspace window, project-status card and payment chips, the payment-confirmed widget and the division illustrations are drawn in code (BRIEF B.4a). Until these arrive the page uses owner photos already delivered: hero → `how-we-work-band`, Why band → `home-band` (desktop file cropped by CSS on phones), closing band → `services-hero`. The code (`src/ui/public/home/images.ts`) switches to each file automatically once it is processed under the exact slot name below. **Owner notified** by the build agent's report on 2026-11-14.

### home-hero-wide: Home · hero background (desktop)
- **file:** `home-hero-wide.png`
- **purpose:** Full-bleed background behind the headline (left) and the floating workspace widgets (right), under a dark warm overlay.
- **aspect:** 16:9 (min 2400 × 1350). Keep the left 45% calm and dark (the headline sits there); the subject in the right half.
- **status:** requested · home batch · 2026-11-14

```
Early evening in a Harare studio: a timber desk by a large steel-framed window, an open laptop seen from a three-quarter angle with its screen turned away from the camera, a phone and a closed notebook beside it, a desk lamp casting a warm pool of light, msasa trees and low city rooftops beyond the glass in soft dusk haze, the left side of the frame falling into deep warm shadow, quiet and established. Art direction: documentary photography in Harare, Zimbabwe, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm, orderly and premium, real-looking materials (timber, plaster, concrete, brick, steel window frames, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare rooftops, local brick), no readable text anywhere, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### home-hero-tall: Home · hero background (phone crop)
- **file:** `home-hero-tall.png`
- **purpose:** The same scene recomposed for phones: headline at the top, widgets in the lower half, all under the overlay.
- **aspect:** 4:5 (min 1440 × 1800). Keep the top 45% calm and dark; the lit desk and laptop in the lower half.
- **status:** requested · home batch · 2026-11-14

```
Early evening in a Harare studio, framed vertically: the top half is a dim steel-framed window with soft dusk haze over msasa trees and rooftops, the lower half a timber desk with an open laptop (screen turned away), a phone and a closed notebook in the warm pool of a desk lamp, quiet and established. Art direction: documentary photography in Harare, Zimbabwe, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm, orderly and premium, real-looking materials (timber, plaster, concrete, brick, steel window frames, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare rooftops, local brick), no readable text anywhere, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### home-band-tall: Home · “Why Kuzikode” band (phone crop of the delivered home-band)
- **file:** `home-band-tall.png`
- **purpose:** Phone crop of the shop-counter payment photo: the photo shows at the top with the payment widget over it, the copy below on the deepened overlay.
- **aspect:** 4:5 (min 1440 × 1800). Subject (hands and phone) in the upper 55%; the lower part plain counter/shadow for the text overlay.
- **status:** requested · home batch · 2026-11-14

```
A small Harare shop counter at opening time, framed vertically: a shopkeeper's hands holding a mid-range Android phone to confirm a mobile-money payment in the upper half, a paper receipt and a few packaged goods on the wooden counter, the lower half of the frame the plain dark wood of the counter falling into shadow, a brick wall and shelving softly out of focus behind, warm low morning light, documentary and quiet. Art direction: documentary photography in Harare, Zimbabwe, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm, orderly and premium, real-looking materials (timber, plaster, concrete, brick, steel window frames, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare rooftops, local brick), no readable text anywhere, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### home-closing-wide: Home · closing band background (desktop)
- **file:** `home-closing-wide.png`
- **purpose:** Full-bleed background behind “Have a project in mind?”, the Get a quote button and the contact options, under a strong dark overlay.
- **aspect:** 21:9 (min 2520 × 1080). Keep the left half calm and low in detail; any subject in the right third.
- **status:** requested · home batch · 2026-11-14

```
A Harare reception counter or studio entrance at golden hour seen from a low distance: a timber counter with a desk phone and a small stack of printed proposals, a potted plant, warm light raking across a plaster wall with the shadow of a steel window frame, nobody in frame, welcoming and calm, generous empty space on the left side. Art direction: documentary photography in Harare, Zimbabwe, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm, orderly and premium, real-looking materials (timber, plaster, concrete, brick, steel window frames, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare rooftops, local brick), no readable text anywhere, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```

### home-closing-tall: Home · closing band background (phone crop)
- **file:** `home-closing-tall.png`
- **purpose:** The closing scene recomposed for phones, behind the heading, the button and three contact rows.
- **aspect:** 4:5 (min 1440 × 1800). Low detail across the whole frame; the counter and plant in the bottom quarter.
- **status:** requested · home batch · 2026-11-14

```
A Harare reception counter at golden hour framed vertically: a large plaster wall with the warm shadow of a steel window frame filling most of the frame, a timber counter with a desk phone and a potted plant in the bottom quarter, nobody in frame, welcoming and calm. Art direction: documentary photography in Harare, Zimbabwe, warm neutral grading (deep warm near-black shadows like #141412, bone-white highlights like #F2EEE6, natural skin and wood tones), restrained colour with at most one small earthy accent in the frame (saffron #C98A17, clay #B84F35, deep emerald #1E7A52 or teal #1F8478), 35 mm lens, crisp focus, calm, orderly and premium, real-looking materials (timber, plaster, concrete, brick, steel window frames, textiles), identifiably Zimbabwean details where natural (msasa trees, Harare rooftops, local brick), no readable text anywhere, no logos, no watermarks, no screens with readable UI, no glowing effects, no posed stock smiles, people only as hands or seen from behind or at a distance (never a recognisable face). Generate at the largest size available.
```
