# Timeline — Architecture

## Repository structure

```
/
├── apps/
│   ├── web/                  # React + Vite + TS frontend
│   │   └── src/
│   │       ├── app/          # app shell, providers, router
│   │       ├── components/   # reusable UI primitives (Button, Dialog, ...)
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── timelines/
│   │       │   ├── canvas/   # TimelineCanvas + layers + domain logic
│   │       │   ├── milestones/
│   │       │   ├── stages/
│   │       │   └── profile/
│   │       ├── lib/          # api client, i18n setup, utilities
│   │       └── styles/       # tokens.css, global styles
│   └── api/                  # Lambda source
│       └── src/
│           ├── app.ts        # Hono router (the Lambdalith)
│           ├── middleware/   # auth context, error mapping
│           ├── modules/      # timelines/, milestones/, stages/, users/
│           │   └── <module>/ # routes.ts, service.ts (authz + domain)
│           └── repositories/ # DynamoDB access, key builders
├── packages/
│   └── shared/               # zod schemas, TS types, constants, PartialDate utils
├── infra/                    # AWS CDK (TypeScript)
└── docs/
```

npm workspaces monorepo (DECISIONS #5). Dependency flow: `web → shared`, `api → shared`, `infra → (nothing app-level)`. `shared` imports from no app. Modules in `api` don't import each other's repositories.

## Frontend

- **Stack**: React 19, TypeScript strict, Vite, Tailwind CSS v4 (tokens as CSS variables, see DESIGN_SYSTEM.md), React Router, TanStack Query, Zod, react-i18next (en/es), `aws-amplify` auth category only (custom-branded auth screens against Cognito; no Hosted UI — DECISIONS #8).
- **State**: server state in TanStack Query; canvas view state (pan/zoom) local to the canvas feature; no global state library until a concrete need appears.
- **Routing**: `/login`, `/register`, `/verify`, `/forgot-password`, `/dashboard`, `/timeline/:timelineId` (`?milestone=<id>` opens the modal — refresh-safe), `/profile`. Route-level code splitting via `React.lazy`.
- **i18n**: `react-i18next` with `en` + `es` resource bundles; language from profile preference → browser → `en`. All user-facing strings via translation keys (lint-enforced habit, reviewed in PRs).

## Timeline canvas architecture

The canvas is DOM + SVG with CSS transforms — no `<canvas>`/WebGL (DECISIONS #9).

Pure, unit-tested domain layer (no React imports):

- **`TimeScale`** — bijective date↔x mapping from `(pxPerDay, originDate, panOffset)`. Zoom = change `pxPerDay` anchored at cursor; pan = change offset. All layers consume the same scale.
- **`ruler.ts`** — picks tick unit/density from `pxPerDay` (years → quarters → months → days), returns tick positions + label keys; labels render via `Intl` in the active locale.
- **`laneLayout.ts`** — stage lane assignment: sort by anchor start, greedy interval partitioning, lowest free lane closest to the axis wins.
- **`collisionLayout.ts`** — milestone clustering: group milestones whose x-positions collide at the current zoom; distribute alternating above/below the axis with vertical stacking inside a cluster; each keeps a connector to its true temporal position.

React layer components composing `TimelineCanvas`:

```
TimelineCanvas
├── TimeAxisLayer      (SVG: axis line, ruler ticks/labels)
├── StageLayer         (SVG bands per lane)
├── MilestoneLayer     (DOM: nodes + labels, connectors in SVG)
└── InteractionLayer   (pointer/wheel/keyboard handling, hit-testing)
```

Viewport-aware rendering from day one: layers receive the visible date range from `TimeScale` and only mount intersecting items (sorted arrays + binary search — cheap, and it is the virtualization path if timelines grow).

## Backend

- **Shape**: single Lambda ("Lambdalith") running a Hono router (DECISIONS #7) behind **API Gateway HTTP API** with the built-in **Cognito JWT authorizer**. One function keeps cold starts, wiring, and free-tier usage minimal; modules stay separated inside the codebase so a later split per resource is mechanical.
- **Request flow**: API Gateway validates the JWT → Lambda middleware builds an auth context from authorizer claims (never from the body) → module route validates input with shared zod schema → service enforces authorization (ownership in MVP) → repository executes the documented access pattern.
- **Node.js 22**, esbuild bundling via CDK `NodejsFunction`.

## AWS architecture (MVP — nothing deployed until the Phase 3 cost review is approved)

```
Browser (localhost dev)
   │ HTTPS
   ├──► Cognito User Pool  (register/login/verify/recover; JWTs)
   └──► API Gateway HTTP API ── JWT authorizer ──► Lambda (Hono) ──► DynamoDB (timeline-main)
                                                        │
                                                        └──► CloudWatch Logs (7-day retention)
```

- Region: **us-east-1**. All resources via CDK (`infra/`), one dev stack, tagged `project=timeline env=dev`.
- Not in MVP: S3, CloudFront, SES, Route 53, custom domain, NAT, VPC (Lambda runs outside a VPC — nothing private to reach).
- Frontend runs on `localhost` during development; static hosting (S3 + CloudFront) is a later, separately cost-reviewed phase.

## Extension points already designed

- Membership/invitation items slot into the existing table (DATA_MODEL deferred patterns) — no migration.
- Content blocks move from embedded array to per-block items when media arrives — API contract unchanged.
- `ExternalIntegration` (provider, externalId, url, metadata) attaches to Milestones as a future block/attribute — nothing in MVP couples to any provider.
- Cognito supports adding Google/Apple IdPs without changing the app's token handling.
