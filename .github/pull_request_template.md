## What & why
<!-- One logical change. What this PR does and why it matters, in plain English. -->

## Task / issue
<!-- Task or sub-task this branch was cut for: e.g. feature/… , fix/… , chore/… , docs/… -->

## Review checklist
- [ ] Solves the stated task — no unrelated changes
- [ ] CI `build-and-test` is green
- [ ] No `any`; errors thrown cleanly, none swallowed; service actions use try/catch
- [ ] Regression signatures checked: no backdrop-only dialogs, no `NG0950`
- [ ] A defect fix includes a regression test pinning the fixed behaviour
- [ ] Comments explain *why*; public APIs carry TS Doc
- [ ] Memory bank refreshed (`development-status.md`, `working-notes.md`)
- [ ] Merging into `dev` (not `qa`/`main`) — release promotion happens separately
