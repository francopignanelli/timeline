# Timeline — Decision Log

Format per entry: **Choice / Why / Important alternative / Why not chosen.** User-confirmed decisions are marked ✋.

## 1. ✋ MVP scope: single-user core (2026-08-19)
**Choice**: Auth, dashboard, timeline CRUD, full canvas, text-only milestones, stages. Uploads, sharing, public timelines deferred.
**Why**: Smallest coherent product; validates the canvas — the highest-risk part — earliest and cheapest.
**Alternative**: Include uploads or sharing in MVP.
**Why not**: Front-loads S3 security work / the hardest data-model work before the core UX is proven.

## 2. ✋ AWS Region: us-east-1 (2026-08-19)
**Choice**: us-east-1 for all resources.
**Why**: Cheapest pricing, full service availability, best fit for the $5 budget; ~140 ms from Buenos Aires is fine for this app.
**Alternative**: sa-east-1 (São Paulo) for ~30–50 ms latency.
**Why not**: 20–40% pricier on several services; latency isn't the binding constraint for a dev project.

## 3. ✋ Bilingual UI (en + es) from the start (2026-08-19)
**Choice**: react-i18next with English + Spanish resources in the MVP; locale on the user profile.
**Why**: User decision; retrofitting i18n across an existing UI is far costlier than carrying it from day one.
**Alternative**: English-only MVP.
**Why not**: User explicitly chose both.

## 4. Local-first development before any AWS resource
**Choice**: Phases 0–2 (foundation, UI shell, canvas) run entirely on localhost with mock data.
**Why**: The canvas is pure frontend risk, provable at $0; AWS work starts only when there's something worth persisting.
**Alternative**: Provision AWS first for "real" end-to-end early.
**Why not**: Adds cost surface and setup friction before the product's core is validated; spec's own phasing agrees.

## 5. Monorepo with npm workspaces
**Choice**: npm workspaces for `apps/web`, `apps/api`, `packages/shared`, `infra`.
**Why**: Zero extra tooling on Windows; native to the toolchain already required; sufficient at this repo size.
**Alternative**: pnpm (faster installs, stricter hoisting).
**Why not**: Another global install/moving part for marginal benefit at this scale; switch later is mechanical if install times hurt.

## 6. DynamoDB: single table + 1 GSI
**Choice**: `timeline-main` with generic PK/SK + GSI1 (see DATA_MODEL.md).
**Why**: Every hot access pattern is a point read, one-partition item collection (whole canvas in one query), or one GSI query; link entities and future membership items fit the same shapes.
**Alternative**: Table per entity.
**Why not**: Same data needs N queries + duplicated indexes; no isolation benefit at this scale. (Chosen from access patterns, not because single-table is fashionable.)

## 7. Backend as a single Lambda ("Lambdalith") with Hono
**Choice**: One `NodejsFunction` running a Hono router for the whole REST API.
**Why**: Minimal cold starts, one deploy unit, simplest IAM story, free-tier friendly; module boundaries live in code so a later per-resource split is mechanical.
**Alternative**: One Lambda per route/resource.
**Why not**: More cold starts, more wiring and roles, zero benefit at MVP traffic.

## 8. Custom auth screens via Amplify JS auth category (no Hosted UI)
**Choice**: Brand-owned login/register/verify/recover pages calling Cognito (SRP) through `aws-amplify`'s auth module only.
**Why**: The spec demands branded, non-generic auth screens; Amplify's auth category is the maintained path for SRP in the browser.
**Alternative**: Cognito Hosted UI (less code, redirect-based).
**Why not**: Generic look contradicts the brand requirement; customization is limited and still redirect-shaped.

## 9. Canvas rendering: DOM + SVG with CSS transforms (no <canvas>/WebGL)
**Choice**: SVG for axis/ruler/bands/connectors; DOM for milestone nodes/labels; transforms for pan/zoom; viewport-culled rendering from day one.
**Why**: Native accessibility, text rendering, hit-testing, and DevTools; expected item counts (hundreds visible) are comfortably within DOM budgets when culled.
**Alternative**: `<canvas>`/WebGL renderer.
**Why not**: Rebuilds accessibility/hit-testing/text from scratch; only pays off at item counts the product doesn't have. Revisit only with measured evidence.

## 10. Stage lanes computed at render time, not persisted
**Choice**: `laneLayout.ts` assigns lanes greedily on each render from the visible stage set.
**Why**: Lanes are a function of which stages exist/overlap; storing them invites stale data and sync bugs; computation is trivial (n log n).
**Alternative**: Persist `lane` on TimelineStage (the spec sketches the field).
**Why not**: Denormalized derived state with no read-cost problem to justify it. If manual lane pinning ever becomes a feature, a nullable override field can be added.

## 11. Milestone content blocks embedded in the milestone item (MVP)
**Choice**: `blocks: ContentBlock[]` embedded; text-only.
**Why**: One read per milestone, far below item-size limits, trivially transactional.
**Alternative**: Block-per-item from day one.
**Why not**: Pays a complexity tax now for media blocks that are deferred; migration path (`BLOCK#<order>` items) is documented and contract-neutral.

## 12. IDs are ULIDs
**Choice**: ULIDs everywhere.
**Why**: Sortable by creation time (usable directly in sort keys), collision-safe client- or server-generated, opaque enough.
**Alternative**: UUIDv4.
**Why not**: Random ordering wastes the free chronological sort that GSI listings get from ULIDs.

## 13. Tailwind CSS v4 with CSS-variable tokens
**Choice**: tokens.css as the single source; Tailwind v4 `@theme` consumes the variables.
**Why**: Spec mandates centralized tokens; v4's CSS-first config makes the variables the actual system rather than a parallel JS config.
**Alternative**: Tailwind v3 + tailwind.config.js theme.
**Why not**: Two places to define tokens; v4 is current.

## 14. No custom domain, no CloudFront, no hosting in MVP
**Choice**: Frontend on localhost during development; hosting is its own later cost-reviewed phase.
**Why**: A domain (~$12+/yr) alone breaks the budget shape; hosting adds surface with no dev benefit while the only user runs it locally.
**Alternative**: Deploy S3+CloudFront early with the default cloudfront.net URL.
**Why not**: Premature; nothing to share yet. Becomes attractive exactly when sharing/public phases arrive.

## 15. Testing stack: Vitest everywhere
**Choice**: Vitest for shared/web/api unit tests; densest coverage on pure domain logic (PartialDate, TimeScale, lanes, collisions, authz services with mocked repos).
**Why**: One runner across the monorepo, native ESM/TS, fast.
**Alternative**: Jest.
**Why not**: Slower ESM/TS story, second config dialect, no benefit here.

## 16. ✋ Domain date format: `DD/MM/YYYY` (2026-08-19)
**Choice**: `PartialDate.date` is stored and exchanged as `"DD/MM/YYYY"` (e.g. `"28/10/2022"`).
**Why**: User-confirmed standard.
**Alternative**: ISO 8601 (`YYYY-MM-DD`), which sorts lexicographically.
**Why not**: User explicitly chose `DD/MM/YYYY`. Containment: raw string comparison is forbidden project-wide; all ordering goes through shared PartialDate utils; no DynamoDB key contains a date; system timestamps (`createdAt`/`updatedAt`) remain ISO datetimes.

## 17. Canvas vertical layout: dynamic axis, two-sided levels, label degradation
**Choice**: The axis position adapts to content. With stages, it moves down to exactly the stage zone + bottom padding (clamped to 40–72% of height), giving milestones the remaining space above; the below zone belongs to stages so connectors never cross bands. Without stages, the axis centers and milestone levels **alternate above/below** it. Collision detection is **label-width-aware** (measured text via canvas `measureText`, capped at the CSS truncation width, plus dot/padding); greedy interval leveling lifts a milestone only when footprints truly overlap. Levels are **capped by available height with edge padding**; a milestone whose label cannot fit anywhere degrades to a **dot-only marker** (title stays in the tooltip and accessible name) instead of overlapping or clipping. Below-axis connectors skip the ruler band; all connectors render beneath all labels; labels carry opaque backgrounds — text overlap is impossible by construction.
**Why**: Two user-reported issues (2026-08-19): dot-distance-only clustering let wide labels overlap, and a fixed axis wasted the whole below zone on stage-less timelines while towers crowded the top edge. Balanced two-sided placement halves tower height; the level cap plus dot-only degradation keeps edges padded and the canvas clean while every milestone's existence stays visible.
**Alternative**: Fixed axis with above-only stacking and uncapped levels (first implementation).
**Why not**: Wasted half the canvas on stage-less timelines and let stacks reach the viewport edge.
