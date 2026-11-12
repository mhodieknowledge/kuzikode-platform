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
_None yet._
