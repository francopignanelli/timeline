# Timeline Agent Rules

```
CRITICAL:
Current maximum AWS + paid AI service budget is USD $5/month.

Any potentially billable change must be cost-reviewed before implementation.

Every action capable of generating meaningful usage or charges must be
warned, controlled, and notified.

Target development cost: as close to $0/month as possible.
```

Read `docs/STATUS.md` for current project state before substantial work.
Record consequential choices in `docs/DECISIONS.md`.

## Product Principles

- Three independent domain entities: **Timeline** (visual organization layer), **Milestone** (point in time), **Stage** (period of time). Never collapse them.
- Milestones and Stages are reusable entities referenced by Timelines through `TimelineMilestone` / `TimelineStage` link entities. Never model exclusive ownership by a single Timeline.
- Shared content vs per-Timeline presentation are separate concerns: presentation metadata (order, highlight, hidden, style) lives on the link entity, not the shared entity.
- Dates carry explicit precision: `DAY | MONTH | QUARTER | YEAR | APPROXIMATE`. A Milestone is always a point, even when imprecise.
- Timelines are PRIVATE by default. Visibility model: `PRIVATE | SHARED | UNLISTED | PUBLIC` (MVP behavior: PRIVATE only; model supports the rest).
- The Timeline canvas is the core experience and the product's main visual identity.
- UI is bilingual (English + Spanish) from the start. No hardcoded user-facing strings — everything through i18n.

## Architecture Principles

- Monorepo: `apps/web` (React + Vite), `apps/api` (Lambda), `packages/shared` (types/schemas/constants), `infra` (CDK), `docs`.
- TypeScript strict everywhere. Zod schemas in `packages/shared` are the single source of truth for contracts; validate at every boundary.
- Backend: one "Lambdalith" handler (Hono router) behind API Gateway HTTP API with a Cognito JWT authorizer.
- DynamoDB single table designed from documented access patterns (`docs/DATA_MODEL.md`). Never invent queries the table doesn't support — extend the model deliberately.
- Canvas: pure domain logic (TimeScale, lane assignment, collision clustering) is framework-free and unit-tested; rendering layers are thin React components.
- Do not add AWS services, dependencies, or abstraction layers without a concrete current problem.

## Coding Rules

- Strict TypeScript. No `any` without a documented technical justification.
- Validate all external input with zod at the boundary (API handlers, forms).
- User-facing strings go through i18n (en + es). Dates/numbers format via `Intl` with the active locale.
- Domain dates are `DD/MM/YYYY` strings inside `PartialDate` (user-confirmed standard). Never compare or sort raw date strings — always use the shared PartialDate utilities. System timestamps stay ISO 8601 datetimes.
- Design tokens only — never scatter hardcoded colors, spacing, or type values.
- Make the smallest coherent change. Do not rewrite unrelated code.

## Security Rules

- Backend authorization on every request: verify ownership/membership before any read or write. Frontend visibility is never authorization.
- Identity comes from the validated JWT only. Never trust client-provided user identifiers.
- S3 (future) stays private; presigned URLs only; validate MIME type and size server-side.
- Restrictive CORS (explicit known origins). Security headers on all responses.
- Never log tokens, credentials, or full request bodies. Least-privilege IAM. No secrets in git, code, docs, or prompts.

## AWS Rules

- Region: **us-east-1** (user-confirmed).
- All application infrastructure via CDK in `infra/`. No undocumented manual console resources.
- The user currently operates AWS via the web console only; programmatic credentials + CLI are set up in the AWS phase, guided step-by-step (`docs/AWS_SETUP.md`).
- No first deployment before the cost-review gate (Phase 3) is explicitly approved by the user.
- Never destroy DynamoDB data, S3 user uploads, or production resources without explicit user confirmation.

## Cost-Control Rules

- Hard cap **$5/month**; development target ~$0 (free tier).
- Before meaningfully billable actions: present a COST NOTICE; obtain approval when cost is non-trivial; don't nag about clearly negligible dev operations.
- Standing safeguards: DynamoDB on-demand; CloudWatch log retention 7 days in dev; API throttling configured; no always-on compute; no NAT Gateway; no CloudFront until justified; custom domain deferred (doesn't fit budget).
- AI features: none exist and none are approved. Any future AI feature requires provider/cost analysis, usage limits, and explicit user approval first.
- Keep `docs/COSTS.md` current whenever infrastructure changes.

## Testing Rules

- Priorities: date precision, TimeScale math, stage lane assignment, milestone collision clustering, zod contracts, backend authorization.
- Vitest across web/api/shared. Pure domain logic gets the densest coverage. No tests written merely to raise counts.

## Documentation Rules

- `docs/` is the source of truth: PRODUCT, ARCHITECTURE, DATA_MODEL, API, SECURITY, DESIGN_SYSTEM, UI_SPEC, COSTS, DECISIONS, STATUS, AWS_SETUP.
- DECISIONS.md entries use: Choice / Why / Important alternative / Why not chosen.
- Update STATUS.md at the end of each working session.

## Definition of Done

A feature is done when: domain behavior works; backend authorization is enforced; validation exists; loading/empty/error states exist; keyboard access, contrast, and labels are in place; responsive behavior is considered; `tsc`, lint, tests, and production build pass; relevant docs are updated; cost impact is understood and reflected in `docs/COSTS.md`.
