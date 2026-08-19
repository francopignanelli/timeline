# Timeline — Session Handoff (Chat Context)

**Written**: 2026-08-19 · **Reason**: the developer (Franco) is moving from their work PC to their home PC and will continue with a fresh Claude session. This document plus the repo docs carry the full context.

**Suggested first message for the new session:**
> Read CLAUDE.md, docs/HANDOFF.md and docs/STATUS.md, then continue the project from where it stands. Collaborate with me the same way: recommend, ask high-value questions, and never create billable AWS resources without a cost review I explicitly approve.

## 1. What this project is

Timeline: a canvas-first web app for organizing personal/collaborative/public history through three independent entities — **Timeline** (visual layer), **Milestone** (point in time), **Stage** (period). Full product vision in `docs/PRODUCT.md`. Hard constraint: **max USD $5/month** for AWS + paid services; development targets ~$0 (nothing deployed yet — current cost is exactly $0).

## 2. Read in this order

1. `CLAUDE.md` — persistent agent rules (product, architecture, security, AWS, cost, testing). Binding.
2. `docs/STATUS.md` — current phase, what's done, next task.
3. `docs/DECISIONS.md` — 34 recorded decisions with rationale (✋ = user-confirmed).
4. Per topic: PRODUCT, ARCHITECTURE, DATA_MODEL, API, SECURITY, DESIGN_SYSTEM, UI_SPEC, COSTS, AWS_SETUP.

## 3. Exact current position

- **Phases 0–2 are complete and verified** (details in STATUS.md): monorepo foundation, shared domain package, bilingual UI shell with mock auth/data, and the full canvas core (pan/zoom/ruler/lanes/collisions/modal).
- **All seven phases (0–7) are COMPLETE** (2026-08-19). The planned MVP is feature-complete: AWS foundation, Cognito auth, DynamoDB + Lambdalith, full Timeline/Milestone/Stage CRUD + linking, profile page, and a user-requested feature round (diamond markers, per-timeline entity colors, YouTube embeds, S3 image/file attachments). Nothing is mock anymore. Every phase was live-tested against real deployed resources. Full detail in STATUS.md and DECISIONS #18–34.
- Next: no planned phase remains. The natural next step is **hosting** (S3 + CloudFront — needed to use this anywhere but localhost), then the sharing backlog. Each needs its own plan + cost review.
- The user has console (SSO portal), CLI, a Cognito pool, a DynamoDB table, an HTTP API, and a private S3 media bucket — all with live test data (harmless; includes a second real user from parallel testing). Region: **us-east-1** (confirmed).

## 4. What's implemented (verify with `npm run test` — 87 tests)

- `packages/shared`: domain types, constants/limits, **PartialDate utilities** (`DD/MM/YYYY` parse/validate/compare/anchors — never compare raw date strings), the **YouTube id parser** (`youtube.ts`, security-relevant — 7 tests), zod schemas for every contract including the 4-way `ContentBlock` union, entity colors, and upload presign bodies (39 tests).
- `apps/api`: Hono Lambdalith, full CRUD across Users/Timelines/Milestones/Stages plus Timeline↔Milestone/Stage linking (`GET /timelines/{id}/content`, link/unlink/update-presentation) and **uploads** (`/uploads/presign`, `/uploads/view-urls`, `/uploads/download-urls`), all sharing the `routes → service (ownership authz) → repository` layering. Milestone/Stage delete cascades run as one `TransactWriteItems`. 9 tests on authorization.
- `apps/web`: React 19 + Vite + Tailwind v4. Design tokens as the only color source. **Route-level code splitting**; react-i18next **en/es**; **everything is real API**. Needs `apps/web/.env.local` with `VITE_COGNITO_USER_POOL_ID`/`VITE_COGNITO_USER_POOL_CLIENT_ID`/`VITE_API_URL` (see `.env.example`; all values are `infra` stack outputs, not secrets) or the app throws on load. Canvas toolbar has "+ Milestone"/"+ Stage"; `MilestoneModal` supports view/edit/delete/unlink plus color, text/YouTube/image/file blocks; `StagePopover` the same plus color; `/profile` edits the user record.
- **Canvas** (`features/canvas/`): pure domain modules (`time-scale`, `ruler`, `lane-layout`, `collision-layout`, `vertical-layout`, 39 tests) under thin React layers; drag/wheel/keyboard interactions; viewport culling; URL-driven milestone modal (`?milestone=<id>`) and stage popover (`?stage=<id>`), both reload-safe.

## 5. Load-bearing decisions (full list in DECISIONS.md)

- ✋ #1 MVP = single-user core; uploads/sharing/public deferred. ✋ #2 us-east-1. ✋ #3 bilingual en/es from the start. ✋ #16 **domain dates are `DD/MM/YYYY` strings** (system timestamps stay ISO).
- #6 DynamoDB single table + 1 GSI designed from the access patterns in DATA_MODEL.md — never invent unsupported queries. #7 one Lambda ("Lambdalith") with Hono. #8 custom-branded auth screens via Amplify JS auth (no Hosted UI). #9 canvas = DOM+SVG, no WebGL. #12 ULIDs. #14 no domain/CloudFront/hosting yet.
- #17 canvas layout invariants (user-demanded): **text overlap is impossible by construction** — label-width-aware leveling, level caps with edge padding, dot-only degradation, connectors under labels, opaque label backgrounds; dynamic axis (lower with stages, centered + two-sided levels without).
- #23 DynamoDB `RemovalPolicy.RETAIN` (CLAUDE.md calls out DynamoDB data specifically — standing safeguard, unlike Cognito's disposable-dev-pool `DESTROY`). #24 no Lambda reserved concurrency (account's total concurrency limit is 10 — AWS rejects reserving any amount). #25 API auth uses the Cognito **ID token**, not access token (carries the attribute claims `GET /me` needs). #26 CORS route methods must be explicit, not `HttpMethod.ANY` — `ANY` also claims `OPTIONS`, breaking preflight against a JWT-authorized route.
- #27 Milestone/Stage delete is a transactional cascade (META + all links, one `TransactWriteItems`). #28 two small `timeline-count` endpoints added beyond the original API.md to back UI_SPEC's reference-count features cheaply. #29 the canvas's drag-guard must match `[role="button"]` too, not just `<button>` — SVG stage bands use `<g role="button">`, and pointer capture was silently swallowing their clicks until the guard's selector was widened.
- ✋ #31 entity **color is a palette name on the link entity**, never a hex and never on the shared entity. #32 those color tokens must stay on `:root`, **not** in Tailwind's `@theme` — v4 tree-shakes theme vars no utility class references, and these are only read via a runtime-built `var()` string (moving them back silently breaks all custom colors). #33 YouTube blocks store a validated 11-char id, never a URL; the embed src is rebuilt at render. ✋ #34 S3 uploads: private bucket, presigned URLs, MIME allowlist + size caps enforced *before* signing, per-user key prefixes — with a documented, accepted gap that objects are not garbage-collected on delete.

## 6. Conversation context not captured elsewhere

- Working style the user expects: behave as a collaborator — recommend an option, explain trade-offs briefly, ask only high-value questions; present a COST NOTICE before anything potentially billable; **never commit/push unless asked** (the initial push on 2026-08-19 was explicitly requested).
- The logo went through user-driven refinement and is **approved as-is**: symmetric `≻──T──≻` mark, stem centered, chevrons thinner (2.5) than shaft/stem (3.5). Don't redesign it unprompted.
- Two canvas defects were user-reported and fixed (label overlap; wasted space below the axis). Treat the layout invariants in DECISIONS #17 as regressions waiting to happen — keep their tests green.
- Verification habit: every phase ends with `tsc` + lint + tests + build **and** a live browser check before claiming done; STATUS.md is updated at the end of each session.
- Model guidance already given to the user: strongest model for algorithm/design-heavy phases; a cheaper model is fine for the mechanical CRUD/wiring phases ahead.

## 7. Running the project

```
npm install
npm run dev          # Vite on http://localhost:5173
npm run typecheck / lint / test / build
```

- Node ≥ 20 (built on Node 24 / npm 11). `.claude/launch.json` defines the `web` dev server for Claude's browser preview.
- **Everything is real** as of Phase 6: register/login with a real account, create/edit/delete Timelines/Milestones/Stages and they hit the real DynamoDB table. Needs `apps/web/.env.local` populated from both stacks' outputs (`aws cloudformation describe-stacks --stack-name TimelineDevAuth|TimelineDevApi --profile timeline-dev`, or the CDK deploy output).
- No more localStorage content seeds — `lib/mock/` no longer exists. If you're looking for the old canvas-exercising seeds (collision clusters, lane reuse, shared milestones), they're gone; real timelines start empty and get populated through the UI now.

## 8. Remaining phases

| Phase | Content | Gate |
|---|---|---|
| 3 | ~~AWS foundation: budget alerts, identity + CLI, CDK bootstrap~~ | **Done** |
| 4 | ~~Cognito auth via CDK; wire real signup/login/verify/recover~~ | **Done** |
| 5 | ~~DynamoDB + Lambdalith + timelines CRUD end-to-end~~ | **Done** |
| 6 | ~~Milestones + Stages end-to-end; milestone/stage editing UI; linking/unlinking~~ | **Done** |
| 7 | ~~Hardening + profile page, colors, diamond markers, YouTube, S3 uploads~~ | **Done** |
| Backlog | hosting (S3+CloudFront) → sharing → public timelines → integrations; each needs its own plan + cost review | — |

## 9. Known quirks & deferred items

- Deliberate simplifications are listed per phase in STATUS.md (route code-splitting deferred — the >500 kB chunk warning is known; profile page deferred; milestone block reordering is add/remove-only, no drag-and-drop; presentation fields like `isHighlighted`/`displayOrder` exist in the data model and API but no UI writes them yet).
- Claude's embedded preview pane doesn't composite when hidden: screenshots time out, ResizeObserver/rAF may never fire, timers are throttled. `useElementSize` measures synchronously on mount for this reason. When you need to click something inside the canvas SVG and can't screenshot, use `read_page` with `filter: "all"` to find its `ref` (SVG `role="button"` elements don't always surface under `filter: "interactive"`) and click by ref instead of coordinates.
- This AWS account's total Lambda concurrency limit is 10 (DECISIONS #24) — a constraint on any future additional Lambda function, not just this one.
- Editing `apps/web/.env.local` requires restarting the Vite dev server (`preview_stop` + `preview_start` in Claude's browser tools) — it's read once at server start, not hot-reloaded.
- If you add a new clickable element inside `TimelineCanvas`'s pointer-capture container, make sure it's either a real `<button>` or matches the drag-guard's `closest('button, [role="button"]')` check (DECISIONS #29) — otherwise pointer capture silently swallows its clicks.
- **Tailwind v4 tree-shakes `@theme` variables no utility class references.** Any token read only through a runtime-assembled `var()` string must live on `:root` instead (DECISIONS #32). This failed silently once already — the color simply resolved to nothing.
- The in-app preview browser can't drive a native file picker, so upload flows were verified by calling the API from page JS with the real session token. That approach is reusable: grab the Cognito id token from `localStorage` (`CognitoIdentityServiceProvider.<clientId>.<sub>.idToken`) and `fetch` the API directly.
- S3 objects are **not** deleted when a milestone or block is (DECISIONS #34). Don't assume the bucket mirrors the table.
