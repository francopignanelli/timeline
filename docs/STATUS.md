# Timeline — Status

**Last updated**: 2026-08-19

## Current phase
**Phase 2 (canvas core) complete** (with two user-reported layout fixes, see below). **Phase 3 (AWS foundation) is open but paused**: the cost review was presented on 2026-08-19 but the user paused **before approving** to switch machines — nothing AWS-related has been created. Resume by re-presenting the cost review for explicit approval and choosing the developer identity method (see `docs/AWS_SETUP.md` and `docs/HANDOFF.md` §3).

Session handoff context for a new machine/Claude session: **`docs/HANDOFF.md`**.

## Implementation phases (agreed direction)

| Phase | Content | AWS cost |
|---|---|---|
| 0 | Foundation: monorepo, TS strict, lint/format, `packages/shared` (PartialDate + zod schemas), design tokens, logo SVG | $0 (local) |
| 1 | UI shell: routing, i18n (en/es), header/brand, dashboard + auth screens against mock data | $0 (local) |
| 2 | Canvas core: TimeScale, ruler, pan/zoom, stage lanes, milestone collisions, milestone modal — mock data | $0 (local) |
| 3 | **AWS foundation (gated)**: cost review with user → budget alerts, IAM + CLI setup, CDK bootstrap (see AWS_SETUP.md) | ~$0 |
| 4 | Auth: Cognito via CDK, wire real signup/login/verify/recover | $0 (free tier) |
| 5 | API + data: DynamoDB table, Lambdalith, timelines CRUD end-to-end, dashboard on real data | ~$0 |
| 6 | Milestones + Stages end-to-end: CRUD, linking/unlinking, canvas on real data | ~$0 |
| 7 | Hardening: error/empty/loading passes, a11y pass, responsive pass, test sweep, docs sync | $0 |

Backlog (each spec'd in PRODUCT.md, each needs its own plan + cost review): media uploads (S3) → milestone sharing → timeline sharing/invitations → public/unlisted timelines + hosting → integrations.

## Completed
- Spec analyzed; user decisions captured (DECISIONS #1–3, #16): single-user-core MVP, us-east-1, bilingual en/es UI, `DD/MM/YYYY` domain date format.
- Git repo initialized (nothing committed yet).
- Full docs set: PRODUCT, ARCHITECTURE, DATA_MODEL, API, SECURITY, DESIGN_SYSTEM, UI_SPEC, COSTS, DECISIONS, AWS_SETUP, CLAUDE.md.
- **Phase 0**: npm-workspaces monorepo (`apps/web`, `packages/shared`); strict TS base config; ESLint 9 + Prettier; `@timeline/shared` with domain types, constants/limits, PartialDate utilities (DD/MM/YYYY parse/validate/compare/anchors) and zod schemas — 32 unit tests; `apps/web` with Vite + React 19 + Tailwind v4, design tokens (default palette cleared — token use enforced), self-hosted Inter / Source Serif 4 / JetBrains Mono, `LogoMark`/`LogoFull` (T→ concept) and SVG favicon; `.claude/launch.json` dev-server config.
- Logo refined per user feedback: symmetric `≻──T──≻` mark — arrowhead + matching tail chevron (smaller, thinner stroke than shaft/stem), stem centered. DESIGN_SYSTEM.md updated; `--danger` token added for validation errors.
- **Phase 1**: react-router-dom v7 routes (`/login /register /verify /forgot-password /dashboard /timeline/:id`, 404) with auth guards; react-i18next with typed en/es bundles (es typed against en's shape so missing keys fail `tsc`), locale detection localStorage → browser → en, `<html lang>` sync; mock auth context (localStorage; Phase 4 swaps internals for Cognito) and mock timeline store (localStorage, validates with shared zod schemas; Phase 5 swaps for the API client); TanStack Query hooks; UI primitives (Button, fields, native-`<dialog>` Dialog, EmptyState, TimelineMotif, LanguageSwitcher); precision-adaptive `PartialDatePicker`; auth pages, dashboard (greeting, editorial list rows, empty/loading/error states), CreateTimelineDialog, TimelinePage placeholder.

- **Phase 2**: pure canvas domain in `apps/web/src/features/canvas/domain/` — day-number arithmetic, `TimeScale` (anchored zoom, pan, fit, clamped px/day), adaptive ruler (days → months → quarters → stepped years, capped tick generation), greedy stage lane assignment with lane reuse, zoom-dependent milestone collision clustering — all framework-free with 29 unit tests. React layers: SVG `TimeAxisLayer` (axis, brand arrow, now marker, ruler with first-tick year anchor) + `StageLayer` (bands, inline labels when they fit, native tooltips); DOM `MilestoneLayer` (focusable buttons, connectors to true temporal position); `TimelineCanvas` orchestrates scale state, drag/wheel/keyboard interactions (arrows pan, +/- zoom, 0 fit), viewport culling, and the toolbar (zoom/fit/ruler). URL-driven read-only `MilestoneModal` (`?milestone=<id>`). Mock content store seeds exercising collisions, lane reuse, and one milestone shared by two timelines.

- **Phase 2 fix (user-reported)**: milestone labels overlapped because collision detection only considered dot distance. Replaced with label-width-aware leveling: measured text footprints (canvas `measureText` + safety factor, capped at the 160px truncation width) fed into greedy interval leveling (`assignMilestoneLevels`); connectors render beneath all labels; labels have opaque backgrounds. Verified live: zero pairwise box intersections on both seeded timelines at multiple zooms.

- **Phase 2 fix (user-reported, layout balance)**: dynamic axis position (`computeVerticalLayout`) — lower when stages occupy the below zone, centered with milestone levels alternating above/below otherwise; levels capped by available height with 36px edge padding; labels degrade to dot-only markers when they can't fit (tooltip + accessible name preserved); below-axis connectors skip the ruler band. Verified live: Recitales 4 above / 3 below around a centered axis; Universidad axis at 407/565 with stages ending 66px clear of the bottom; zero overlaps in all states.

## Deliberate Phase 2 simplifications (revisit later)
- At extreme density (more same-position milestones than total levels), dot-only markers may coincide visually — a future "×N" aggregation marker would be the polished answer.
- Ruler visibility toggle is session-local; persisting it (and other presentation state) arrives with the real PATCH endpoints.
- Drag-pan and pinch verified through unit-tested domain functions + code review; the embedded verification browser can't exercise real pointer gestures (its pane doesn't composite — also why `useElementSize` measures synchronously on mount instead of relying on ResizeObserver delivery).
- Stage popover (click → details/edit) deferred to Phase 6 with stage editing; stages have native tooltips meanwhile.
- Milestone editing deferred to Phase 6; the modal is read-only.

## Deliberate Phase 1 simplifications (revisit later)
- Route-level code splitting (`React.lazy`) deferred until the heavy canvas route exists (Phase 2).
- Profile page deferred to the phase where real user data exists; header shows initials avatar + logout only.
- Mock verify accepts any 6-digit code (hinted in the UI); mock login accepts any credentials.

## Known issues / open points
- None blocking. AWS account has console access only — CLI/credentials handled in Phase 3 (AWS_SETUP.md).

## Next recommended task
On plan approval → Phase 0 (foundation scaffolding), then Phase 1.
