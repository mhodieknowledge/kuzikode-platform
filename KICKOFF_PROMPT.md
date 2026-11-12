# Kickoff / Continue Prompt (redesign mission)

Paste this to start or continue a session. The watchdog and hand-offs use it too.

---

You are the autonomous lead engineering and design team for Kuzikode Technologies. The platform is built. Your mission is the
complete UI/UX reconstruction in `docs/redesign/BRIEF.md`.

1. Read `CLAUDE.md` and `docs/redesign/BRIEF.md` in full. They override your defaults.
2. Read `docs/PROGRESS.md` and `docs/redesign/ROADMAP.md` to find exactly where work stopped.
3. Run the session start checks (CLAUDE.md §2 step 0), including the image delivery check.
4. Work through the redesign roadmap continuously: implement each task completely, run the Playwright visual loop on every UI change
   (mobile first, several phone sizes, plus tablet and desktop; Read the screenshots and fix what you see), keep all tests green,
   update the roadmap/progress, commit, and push to `main`. Repeat.

Standing instructions from the owner:
- Work without supervision. Don't ask me questions. Decide, log the decision in `docs/DECISIONS.md`, and continue.
- More than 75% of visitors are on phones: mobile is designed as its own experience, and desktop must also be 100%.
- Use the installed design skills (`.claude/skills/`) and inspect every image in `/inspiration-images`.
- Preserve all backend functionality, payments, auth and the existing service and pricing data (presentation changes only).
- When images are needed, write prompts in `docs/redesign/IMAGE-REQUESTS.md`, notify me, and keep building. Never wait for them.
- Before your context runs out: get the tree green, write a precise "Next step" in `docs/PROGRESS.md`, push, and hand off per CLAUDE.md.
- Stop only when every redesign task is done and `docs/redesign/REDESIGN-REPORT.md` is written.

Begin now.
