# Timeline — Session Handoff (Chat Context)

**Written**: 2026-08-19 · **Reason**: the developer (Franco) is moving from their work PC to their home PC and will continue with a fresh Claude session. This document plus the repo docs carry the full context.

**Suggested first message for the new session:**
> Read CLAUDE.md, docs/HANDOFF.md and docs/STATUS.md, then continue the project from where it stands. Collaborate with me the same way: recommend, ask high-value questions, and never create billable AWS resources without a cost review I explicitly approve.

## 1. What this project is

Timeline: a canvas-first web app for organizing personal/collaborative/public history through three independent entities — **Timeline** (visual layer), **Milestone** (point in time), **Stage** (period). Full product vision in `docs/PRODUCT.md`. Hard constraint: **max USD $5/month** for AWS + paid services; development targets ~$0 (nothing deployed yet — current cost is exactly $0).

## 2. Read in this order

1. `CLAUDE.md` — persistent agent rules (product, architecture, security, AWS, cost, testing). Binding.
2. `docs/STATUS.md` — current phase, what's done, next task.
3. `docs/DECISIONS.md` — 17 recorded decisions with rationale (✋ = user-confirmed).
4. Per topic: PRODUCT, ARCHITECTURE, DATA_MODEL, API, SECURITY, DESIGN_SYSTEM, UI_SPEC, COSTS, AWS_SETUP.

## 3. Exact current position

- **Phases 0–2 are complete and verified** (details in STATUS.md): monorepo foundation, shared domain package, bilingual UI shell with mock auth/data, and the full canvas core (pan/zoom/ruler/lanes/collisions/modal).
- **Phase 3 (AWS foundation) is OPEN but NOT started**: the formal COST NOTICE for the initial stack (Cognito, HTTP API, Lambda, DynamoDB, CloudWatch, CDK bootstrap; expected $0/month) was presented, but the user **paused before approving** to switch machines. **First action in the new session**: re-present the Phase 3 cost review for explicit approval, and ask which developer identity to set up — IAM Identity Center (recommended) vs IAM user + access key. Then follow `docs/AWS_SETUP.md` steps 1→4 interactively (budget alerts $1/$3/$4/$5, identity, CLI, CDK bootstrap).
- **No AWS resources exist.** The user operates AWS via the **web console only** (no CLI yet). Region: **us-east-1** (confirmed).

## 4. What's implemented (verify with `npm run test` — 71 tests)

- `packages/shared`: domain types, constants/limits, **PartialDate utilities** (`DD/MM/YYYY` parse/validate/compare/anchors — never compare raw date strings), zod schemas for every MVP contract (32 tests).
- `apps/web`: React 19 + Vite + Tailwind v4. Design tokens as the only color source (Tailwind default palette cleared). Routing with auth guards; react-i18next **en/es** (the es bundle is typed against en's shape — a missing key fails `tsc`); mock auth + mock stores in localStorage shaped exactly like the future API (swap points: Phase 4 = Cognito into `features/auth/mock-auth.tsx`, Phase 5/6 = API client replacing `lib/mock/*`).
- **Canvas** (`features/canvas/`): pure domain modules (`time-scale`, `ruler`, `lane-layout`, `collision-layout`, `vertical-layout`, 39 tests) under thin React layers; drag/wheel/keyboard interactions; viewport culling; URL-driven milestone modal (`?milestone=<id>`, reload-safe).

## 5. Load-bearing decisions (full list in DECISIONS.md)

- ✋ #1 MVP = single-user core; uploads/sharing/public deferred. ✋ #2 us-east-1. ✋ #3 bilingual en/es from the start. ✋ #16 **domain dates are `DD/MM/YYYY` strings** (system timestamps stay ISO).
- #6 DynamoDB single table + 1 GSI designed from the access patterns in DATA_MODEL.md — never invent unsupported queries. #7 one Lambda ("Lambdalith") with Hono. #8 custom-branded auth screens via Amplify JS auth (no Hosted UI). #9 canvas = DOM+SVG, no WebGL. #12 ULIDs. #14 no domain/CloudFront/hosting yet.
- #17 canvas layout invariants (user-demanded): **text overlap is impossible by construction** — label-width-aware leveling, level caps with edge padding, dot-only degradation, connectors under labels, opaque label backgrounds; dynamic axis (lower with stages, centered + two-sided levels without).

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
- Mock login: **any email + any password ≥ 8 chars**. Registration verify step accepts **any 6-digit code**.
- Mock data lives in localStorage under `timeline.mock.*` — clear those keys to reseed. Seeds intentionally exercise collisions (same-day Lollapalooza trio), lane reuse (Universidad), and a milestone shared by two timelines (`m-primer-trabajo` → "Appears in 2 timelines").

## 8. Remaining phases

| Phase | Content | Gate |
|---|---|---|
| 3 | AWS foundation: budget alerts, identity + CLI, CDK bootstrap (`docs/AWS_SETUP.md`) | **Cost review approval pending** |
| 4 | Cognito auth via CDK; wire real signup/login/verify/recover into the existing screens | COST NOTICE before deploy |
| 5 | DynamoDB + Lambdalith + timelines CRUD end-to-end (contracts already in API.md) | COST NOTICE before deploy |
| 6 | Milestones + Stages end-to-end; milestone/stage editing UI; linking/unlinking | — |
| 7 | Hardening: error/empty/loading, a11y, responsive, test sweep, docs sync | — |
| Backlog | uploads (S3) → sharing → public timelines + hosting → integrations; each needs its own plan + cost review | — |

## 9. Known quirks & deferred items

- Deliberate simplifications are listed per phase in STATUS.md (route code-splitting deferred — the >500 kB chunk warning is known; profile page deferred; ruler toggle session-local; dot-only markers may coincide at extreme density → future "×N" aggregation).
- Claude's embedded preview pane doesn't composite when hidden: screenshots time out, ResizeObserver/rAF may never fire, timers are throttled. `useElementSize` measures synchronously on mount for this reason. Verify via `read_page`/JS probes when the pane is hidden.
- Two localStorage-related notes: the mock user persists (`timeline.mock.user`), and user-created mock timelines mix with seeds — both harmless, wiped by clearing storage.
