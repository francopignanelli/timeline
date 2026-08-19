# Timeline — Status

**Last updated**: 2026-08-19

## Current phase
**Phase 7 (hardening) complete, plus a user-requested feature round.** All seven planned phases are now done and the MVP surface is feature-complete. Phase 7 delivered:

**Hardening**
- **Profile page** (`/profile`) — the last unbuilt MVP screen (UI_SPEC.md): displayName/bio/location/website/language, immutable username, initials avatar; header avatar links to it. Backend `PUT /me` already existed since Phase 5. `updateProfileSchema.website` now also accepts `''` so a set website can actually be cleared (JSON drops `undefined`, so omitting the key can't express "erase").
- **Route-level code splitting** (`React.lazy` + `Suspense` in both layouts) — the deferred Phase 1 item. Canvas is now a separate 31.8 kB chunk; Amplify is pinned to its own cacheable vendor chunk (DECISIONS #30). The >500 kB warning persists as *vendor* weight, not route weight — honest state, not fixed.
- **Error/loading gaps**: `TimelinePage` had no error state (a failed content fetch rendered a permanently blank canvas — now an error + retry); router `errorElement` catches unexpected render crashes instead of showing a blank page; `AuthLayout` now waits for `isInitializing` so a signed-in user doesn't flash the login form on cold load.
- **Responsive**: `Dialog` is a full-screen sheet under `sm` (UI_SPEC.md) and scrolls internally on desktop (milestone editors got taller with media). Verified at 375px: no horizontal overflow anywhere, modal exactly viewport-sized.

**User-requested features (mid-phase)**
- **Diamond milestone markers** with a subtle shine — 10px square rotated 45°, gradient highlight, ambient shadow, sized so its diagonal matches the old circle's footprint exactly (collision math untouched by the shape change).
- **Per-timeline color** for Milestones and Stages via a named palette on the link entity (DECISIONS #31). Tinted stage bands render as a wash, not a slab, to protect label contrast. Hit a real Tailwind v4 trap doing this — theme variables referenced only at runtime get tree-shaken away (DECISIONS #32).
- **YouTube embeds** in the milestone editor — stores a validated 11-char video id, never the pasted URL; embed src rebuilt at render against `youtube-nocookie.com` (DECISIONS #33). 7 unit tests including exact-host rejection of `youtube.com.evil.example`.
- **Image + file attachments on S3** (cost review approved): private bucket, presigned URLs, MIME allowlist + size caps enforced before signing, per-user key prefixes (DECISIONS #34). Live-verified: anonymous GET 403; oversize/SVG/.exe rejected 400; another user's key 404; path traversal 400; full presign → PUT → view round-trip 200 with the image rendering in the modal.

Earlier — **Phase 6 (Milestones + Stages end-to-end) complete.** Phases 3–5 finished first; see below and DECISIONS #18–26. Phase 6 delivered:
- `apps/api`: Milestones + Stages modules (`repositories/milestones-repo.ts`, `stages-repo.ts` mirroring `timelines-repo.ts`), a `links-repo.ts` for Timeline↔Milestone/Stage link items (AP5/AP6/AP10), and `modules/timelines/content-service.ts` tying it together — `GET /timelines/{id}/content`, link/unlink/update-presentation routes for both entity types, full Milestones/Stages CRUD. Delete cascades (Milestone/Stage → all its Timeline links) run as one `TransactWriteItems` call (DECISIONS #27). Two small endpoints added beyond the original API.md (`GET /milestones/{id}/timeline-count`, `GET /stages/{id}/timeline-count`) to back the UI_SPEC's reference-count features cheaply (DECISIONS #28). 3 new authorization tests on the cross-entity-ownership link-creation path (can't link someone else's milestone into your own timeline).
- Frontend: `lib/milestones-api.ts`, `lib/stages-api.ts`, `lib/timeline-content-api.ts` replace `lib/mock/content-store.ts` (deleted). Canvas toolbar gained "+ Milestone"/"+ Stage" buttons opening `AddMilestoneDialog`/`AddStageDialog` (New vs. existing-item-picker tabs, mirroring `CreateTimelineDialog`'s pattern). `MilestoneModal` gained real edit mode (title/date/text blocks) + delete (with reference-count warning) + unlink; a new `StagePopover` (click a stage band) provides the same for Stages. Real `useMilestoneReferenceCount`/`useStageReferenceCount` replace the old mock counter.
- **Found and fixed live**: stage bands are SVG `<g role="button">` (real `<button>` isn't valid inside `<svg>`), and the canvas's drag-guard only excluded actual `<button>` elements — pointer capture was silently swallowing every stage click. Fixed by widening the guard's selector (DECISIONS #29).
- **Live-tested end-to-end against the real API** (2026-08-19): created a milestone and a stage on a real timeline via the UI, opened the stage popover, edited its title (saved and reflected on the canvas immediately), opened the milestone modal (real "Appears in 1 timeline" count), deleted the milestone with the confirmation flow — confirmed via `aws dynamodb scan` that the delete cascade removed both the Milestone META item and its Timeline link atomically, leaving everything else untouched.
- Noticed live: a second real user/timeline/milestone (`francopig2`) appeared in the table during testing — independent parallel usage, not a bug; confirms per-user data isolation is working (each owner's rows only visible to that owner via ownership checks).

Earlier — **Phase 5 (DynamoDB + Lambdalith + Timelines API) complete.** Phases 3–4 finished first; see below and DECISIONS #18–19. Phase 5 delivered:
- `apps/api`: Hono Lambdalith — `GET/PUT /me` (lazy profile creation from Cognito claims), `GET/POST/PATCH/DELETE /timelines` (list/create/get/patch/delete). Layered `routes → service (authz) → repository (DynamoDB)`, matching ARCHITECTURE.md. Ownership enforced in the service layer (404 for non-owner, never a leaked 403 — SECURITY.md); 6 unit tests specifically on authorization (Testing Rules priority). Milestones/Stages routes are Phase 6 — the table design already accommodates them (DATA_MODEL.md).
- `infra/lib/api-stack.ts`: DynamoDB table `timeline-main` (on-demand, GSI1, `RemovalPolicy.RETAIN` — DECISIONS #23) + 1 Lambda (`NodejsFunction`, no reserved concurrency — DECISIONS #24) + 1 HTTP API with a Cognito JWT authorizer (validates the **ID token**, not access token — DECISIONS #25) and stage throttling (20 rps/burst 50). Deployed as stack `TimelineDevApi` (COST NOTICE approved 2026-08-19).
- Frontend: `lib/api-client.ts` (fetch wrapper, attaches the Cognito ID token, maps `{error:{code,message}}` to `ApiError`), `lib/timelines-api.ts` + `lib/profile-api.ts` replacing `lib/mock/timeline-store.ts` (deleted). `AppLayout` calls `GET /me` once per session to seed the profile. `content-store.ts` (milestones/stages, canvas data) stays mock — correctly out of scope until Phase 6; a newly created real timeline's canvas is empty until then, which is expected.
- **Two real deploy failures hit and fixed, both documented**: the account's Lambda concurrency ceiling (10, see DECISIONS #24) rejected reserved concurrency; a rolled-back first attempt left an orphaned empty `timeline-main` table under `RemovalPolicy.RETAIN` outside CloudFormation, deleted after confirming it held 0 items.
- **Found and fixed live**: `HttpMethod.ANY` on the catch-all route also claimed `OPTIONS`, sending CORS preflight through the JWT authorizer and failing every browser request — see DECISIONS #26.
- **Live-tested end-to-end against the real API** (2026-08-19): login → dashboard (real empty state from DynamoDB) → create timeline via the UI → confirmed via `aws dynamodb scan` that the User profile, username claim, and Timeline META items all persisted correctly → timeline detail page loads real data with an (expectedly empty) canvas.

Earlier — **Phase 4 (Cognito auth) complete.** Phase 3 (budget/identity/CLI/CDK bootstrap) finished first; see DECISIONS #18–19. Phase 4 delivered:
- `infra/` CDK app scaffolded (npm workspace, `bin/timeline.ts` + `lib/auth-stack.ts`), deployed via `cdk deploy` (COST NOTICE approved 2026-08-19): stack `TimelineDevAuth` in us-east-1 — one Cognito User Pool (`timeline-dev-users`, email sign-in, self-signup, code-based email verification, password policy per SECURITY.md, MFA off, `DESTROY` removal policy since it's a disposable dev pool) + one SPA app client (SRP only, no Hosted UI/OAuth, no secret). DECISIONS #20–21 cover the attribute/read-write-attribute choices, including a Cognito API quirk hit and worked around during deploy.
- `apps/web/src/features/auth/mock-auth.tsx` replaced by `auth-provider.tsx`: real `aws-amplify/auth` calls (signUp/confirmSignUp+autoSignIn/signIn/signOut/resetPassword/confirmResetPassword), session restored on load via `getCurrentUser`/`fetchUserAttributes`, `isInitializing` gate added to the router so the async session check doesn't flash a redirect.
- `ForgotPasswordPage` extended from a single "request" step (mock never had a working confirm step) to a real two-step request → code+new-password flow, since Cognito requires both.
- **Live-tested end-to-end against the real deployed pool** (2026-08-19): register → real email verification code → auto sign-in → dashboard; logout → login with the same credentials; forgot-password request step. All passed. Caught and fixed a real race condition in the process (DECISIONS #22): the verify page redirected to `/register` before its own post-verify `navigate('/dashboard')` could run.
- `.env.example` documents the two non-secret Vite env vars (`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_CLIENT_ID`); real values live in `.env.local` (gitignored).

Cost: all phases so far $0. See COSTS.md.

**Note carried from Phase 3**: the CDKToolkit bootstrap stack's creation timestamp (2026-07-23) predates this session — turned out to be a leftover from an earlier "Shannon" project on the same AWS account, not a Timeline artifact. Confirmed harmless, no action needed.

Session handoff context for a new machine/Claude session: **`docs/HANDOFF.md`**.

## Implementation phases (agreed direction)

| Phase | Content | AWS cost |
|---|---|---|
| 0 | Foundation: monorepo, TS strict, lint/format, `packages/shared` (PartialDate + zod schemas), design tokens, logo SVG | $0 (local) |
| 1 | UI shell: routing, i18n (en/es), header/brand, dashboard + auth screens against mock data | $0 (local) |
| 2 | Canvas core: TimeScale, ruler, pan/zoom, stage lanes, milestone collisions, milestone modal — mock data | $0 (local) |
| 3 | **AWS foundation (gated)**: cost review with user → budget alerts, IAM + CLI setup, CDK bootstrap (see AWS_SETUP.md) | ~$0 |
| 4 | Auth: Cognito via CDK, wire real signup/login/verify/recover | $0 (free tier) |
| 5 | ~~API + data: DynamoDB table, Lambdalith, timelines CRUD end-to-end, dashboard on real data~~ **Done** | $0 |
| 6 | ~~Milestones + Stages end-to-end: CRUD, linking/unlinking, canvas on real data~~ **Done** | $0 |
| 7 | ~~Hardening: error/empty/loading passes, a11y pass, responsive pass, test sweep, docs sync~~ **Done** (+ profile page, colors, diamonds, YouTube, S3 uploads) | $0 |

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
- ~~Stage popover deferred~~ / ~~Milestone editing deferred~~ — both delivered in Phase 6.

## Deliberate Phase 6 simplifications (revisit later)
- Milestone block reordering is index-order only (add/remove, no drag-and-drop) — UI_SPEC.md mentions "reorder" but drag-and-drop for a handful of text blocks was judged not worth the added complexity yet; up/down buttons would be the next step if it's missed.
- `displayOrder`/`isHighlighted`/`isHidden` presentation fields exist on link items and the backend `PATCH .../milestones/{id}` route supports them, but no UI writes them yet (reordering within a timeline, highlighting) — the data model and API are ready, the UI isn't.
- "From existing" pickers in Add Milestone/Add Stage dialogs list *all* the owner's items, including ones already linked to the current timeline (the backend correctly 409s on a duplicate link attempt, but the picker doesn't pre-filter or show which are already linked).

## Deliberate Phase 1 simplifications (revisit later)
- Route-level code splitting (`React.lazy`) deferred until the heavy canvas route exists (Phase 2).
- Profile page deferred to the phase where real user data exists; header shows initials avatar + logout only.
- Mock verify accepts any 6-digit code (hinted in the UI); mock login accepts any credentials.

## Known issues / open points
- None blocking. Repo's `.git` history did not survive the machine switch; re-initialized fresh on 2026-08-19 (single root commit, no remote yet — user chose not to re-link one; **Phases 4–7 work is all uncommitted** as of this writing, which is now a substantial amount).
- Real test data exists in the deployed resources from live verification across two accounts (`franco_dev` and `francopig2`) — harmless dev data, but worth knowing it's there before assuming a clean slate.
- This AWS account's total Lambda concurrency limit is 10 (DECISIONS #24) — if a second Lambda function is ever added (e.g., a future async job), the same "no reserved concurrency" constraint applies unless the account limit is raised.

## Deliberate Phase 7 simplifications (revisit later)
- **No S3 garbage collection**: deleting a milestone or removing a block leaves its object in the bucket, and an upload abandoned before save is orphaned. Bounded and negligible at current caps (DECISIONS #34); a lifecycle sweeper is the answer if storage ever appears in the budget.
- Milestone block **reordering** is still add/remove-only (no drag-and-drop), now across four block types.
- Image blocks have no client-side downscaling — a 5 MB photo is stored and served at full size. Fine at this scale; a resize-on-upload step is the obvious next win if galleries get heavy.
- The main bundle is still ~465 kB (Amplify-dominated) despite route splitting; only matters once the app is actually hosted (DECISIONS #14).

## Next recommended task
The planned MVP is complete. Natural next steps, each needing its own plan + cost review: **hosting** (S3 + CloudFront — the first thing needed to use this outside localhost), then the sharing backlog (milestone sharing → timeline sharing/invitations → public/unlisted timelines), then integrations. A pre-hosting pass on presentation fields (`displayOrder`/`isHighlighted` have data-model + API support but no UI) would also round out the canvas.
