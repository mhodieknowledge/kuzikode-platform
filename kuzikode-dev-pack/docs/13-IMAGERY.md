# 13 — Site Imagery (generated once, during development)

**What this is:** during development the agent generates a **curated set of about 20 images** (AI-generated people, faces,
workplaces and objects) to make the public site look like a polished, professional technology company. The reference is
cassavatechnologies.com: hero and section imagery of African professionals in meetings and offices, plus object/scene shots.

**What this is NOT:** not a feature of the platform, not an in-app image generator, and not continuous or on-demand generation.
The images are produced once, reviewed, optimised and **committed as static files** in the repo. After launch the owner swaps or
adds images through the CMS media library like any other upload.

---

## 1. Generators (agent-side tools only)

| # | Generator | Cost | Use |
|---|---|---|---|
| 1 | **Cloudflare Workers AI** (REST API) | Free: 10,000 neurons/day (≈ 15 high-quality 1024² images/day) | Main generator. **Leonardo Lucid Origin / Phoenix** for photoreal people and faces, **FLUX** for objects/abstract |
| 2 | **Canva** `generate-image` (MCP connector) | Free-plan credits | Backup, or for stylised visuals |
| 2b | **Figma** `generate_image` (MCP connector) | Counts toward the 20 calls/month on the owner's seat | Last resort only |
| 3 | **OpenAI / Google Gemini image API** | Pay-per-image | Only if the owner adds `OPENAI_API_KEY` / `GEMINI_API_KEY`. Use for hero faces if Workers AI quality isn't good enough |

Workers AI auth: `CLOUDFLARE_API_TOKEN` (needs **Workers AI: Read + Edit**) + `CLOUDFLARE_ACCOUNT_ID`, which are already in the environment.
Verify the current model IDs and input schema first and record them in DECISIONS.md:
```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/models/search?task=Text-to-Image" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```
(expected: `@cf/leonardo/lucid-origin`, `@cf/leonardo/phoenix-1.0`, `@cf/black-forest-labs/flux-1-schnell`. Check each model's docs page for
width/height/steps/seed parameters and whether it returns base64 JSON or binary.)

Note: Claude itself does not generate images. The agent writes the prompt, calls one of these generators, then **looks at** the
result (it can see images) to judge quality. The Cloudflare connector has no image tool, so Workers AI is called with the API token.

**Optional video (one item):** a 10–20 s muted ambient loop for the home hero or About ("people at work" montage) may be made with
Canva's video generation (`create-video`, connected). Keep it ≤ 3 MB (MP4/WebM), set a poster image, use `preload="none"` on mobile and
respect `prefers-reduced-motion` (show the still instead). Skip it if quality isn't excellent. A still hero is fine.

## 2. Small dev script (not part of the app)
`scripts/images/generate.mjs` (Node, run in the agent's session):
- `npm run img:gen -- --id home-hero --size 1600x900 --variants 3` reads `design/images/prompts/home-hero.txt`, prepends the
  style block (§3), calls the model and saves candidates to `design/images/raw/` (git-ignored).
- The agent **Reads each candidate** (they're PNGs) and picks the best, or regenerates.
- `npm run img:process -- --id home-hero --pick 2` uses **sharp** (devDependency) to crop to the needed ratios, export
  **AVIF + WebP + JPEG** at widths 640/1024/1600/2400, strip metadata, make a tiny blur placeholder, and write to `public/images/site/`.
- `design/images/manifest.json` records id, model, prompt, seed, chosen file and alt text, so any image can be regenerated or replaced later.
- Output: committed images under `public/images/site/` (target < 25 MB total). Rendered with a `ResponsiveImage.astro` component
  (`<picture>`, srcset, width/height, lazy except the hero, which gets `fetchpriority="high"`).
- Free daily limit: if it's reached, stop and continue next session. This task doesn't block anything else.

## 3. Art direction (house style)
Editorial, credible, contemporary, as if from one professional photo shoot in Harare.
**People style block** (prepend to people prompts):
> Professional editorial photograph, natural window light, shallow depth of field, 35mm lens, modern clean office or workspace,
> cool neutral colour grading with subtle blue accents, realistic skin texture, candid authentic moment, high detail, uncluttered background.

- **People:** contemporary Zimbabwean / African professionals, mixed ages and genders. Developers, designers, business owners,
  shop staff, finance and clinic staff. Smart-casual or business attire, collaborating, presenting, reviewing screens. Natural, not posed at the camera.
- **Objects:** minimal 3D render, soft studio light, matte and frosted-glass materials, deep navy `#0A0F1C` and blue `#2747E8` with a
  small amber `#E8A33D` accent, lots of negative space (devices, abstract interface panels, cloud/server forms, connected nodes).
- **Always avoid:** visible text/letters/logos/watermarks, distorted hands or faces, plastic skin, neon/cyberpunk, robots, holograms,
  glowing brains, circuit-board clichés, poverty stereotypes, cheesy handshakes, flags.
- Same lighting words and seed family across a page so the images look like one shoot. Leave space for text overlays.

## 4. Shot list (~20 images total)
| Slot | # | Brief |
|---|---|---|
| Home hero | 1 (+ mobile crop) | Small team collaborating around a laptop and large screen in a bright modern Harare office |
| Home "Why Kuzikode" / approach | 2 | Designer and client reviewing a phone app together; developer at a dual-monitor desk |
| Home "life at work" strip (like Cassava's gallery) | 4 | Whiteboard planning session; presentation to a small group; two colleagues pair-programming; a woman leading a video call |
| Service divisions (one each) | 6 | Web: designer with responsive layouts on screen · Mobile: hands using a phone app at a shop counter · Business software: POS/tablet at a retail counter · AI & Data: analyst with charts on a monitor · Automation: warehouse worker with a handheld scanner · Cloud & IT: technician in a small server room |
| About | 2 | Team discussion in a meeting room; laptop, notebook and coffee flat-lay |
| Careers | 1 | Mentoring scene: senior and junior colleague at a screen |
| Contact | 1 | Modern office building exterior / reception at golden hour |
| Products (Business Suite) | 1 | Abstract 3D render of devices with blurred, unreadable interface |
| CTA band / OG background | 1–2 | Abstract navy/blue texture with soft light |
Industries, pricing, insights covers and 404 use icons and code-drawn SVG illustrations, not generated photos.

## 5. Honesty rules (required)
1. Generated people are **illustrative only**, the same way Cassava and many corporate sites use stock-style imagery. Never label them,
   name them, or present them as Kuzikode staff, founders, clients, testimonial authors or case-study clients.
2. Team/leadership sections use **only real photos** from the owner.
3. No real, identifiable people or celebrities, and no real brand logos in images.
4. Alt text describes the scene ("Two colleagues reviewing a mobile app design"), not a claim.
5. Record in DECISIONS.md that the site uses AI-generated illustrative imagery (and the manifest lists every file).

## 6. Quality bar
The agent Reads every image before accepting it. Reject it for: malformed hands/fingers, odd eyes or teeth, melted or asymmetric faces,
garbled pseudo-text, warped laptops/keyboards, impossible perspective, waxy skin, or off-palette colour. Up to 3 retries per shot, then
switch model or use an object shot instead. After placing images, run the visual QA gate (docs/05 §8) at 375/768/1440.
