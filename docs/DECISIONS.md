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

## 18. ✋ Developer identity: IAM Identity Center over IAM user + access key (2026-08-19)
**Choice**: IAM Identity Center (single-region instance, us-east-1), one user (`FrancoPig`, MFA-enrolled) with an `AdministratorAccess` permission set, 8h session duration. CLI profile `timeline-dev` uses `aws sso login` — no long-lived access keys ever written to disk.
**Why**: Short-lived, auto-expiring credentials; nothing secret to leak from a local file. Enabled as **single-region** specifically to avoid the customer-managed KMS key (~$1+/month) that the multi-region instance option defaults to — meaningful against a $5 cap for zero benefit on a solo account.
**Alternative**: IAM user + long-lived access key.
**Why not**: Permanent secret on the local machine with no expiry; more to protect for no setup-time savings that matters here.

## 19. CDK bootstrap: default execution policy, no cross-account trust
**Choice**: `cdk bootstrap aws://990863603580/us-east-1` with the CLI's default `AdministratorAccess` CloudFormation execution policy; no trusted accounts for deployment or lookup.
**Why**: Solo dev account, single environment — no cross-account deploy story to support yet.
**Alternative**: Custom least-privilege execution policy.
**Why not**: Deferred; revisit if a second (e.g. CI) principal needs to deploy without full admin.

## 20. Cognito attribute strategy: pre-Phase-5 profile fields ride as User Pool attributes
**Choice**: `username` (`custom:username`, 3–30 chars, matches `usernameSchema`) and `displayName` (standard `name` attribute) are captured at registration and stored on the Cognito user itself, read back via `fetchUserAttributes()`. `email` is the sign-in identifier (`UsernameAttributes: [EMAIL]`, not an alias — DATA_MODEL's own username-uniqueness enforcement (AP2) is unaffected since Cognito's username here *is* the email, not the app username).
**Why**: Phase 4 (auth) ships before Phase 5 (DynamoDB). Registration collects username/displayName in the UI regardless of phase boundary; without somewhere to persist them they'd be silently dropped. Cognito attributes are the only durable store available yet.
**Alternative**: Drop username/displayName from the register form until Phase 5.
**Why not**: Changes the UI/UX mid-project for no benefit; Phase 5 can read these attributes from the JWT/Cognito to seed the real `User` DynamoDB item on first authenticated request — a documented, mechanical migration, not a redesign.

## 21. Cognito App Client: default (schema-wide) read/write attributes, no explicit allowlist
**Choice**: `UserPoolClient` omits `readAttributes`/`writeAttributes`, using Cognito's default (all non-immutable standard + custom attributes readable/writable by the client).
**Why**: An explicit allowlist (`email`, `name`, `custom:username`) made the Cognito API reject client creation with `Invalid write attributes specified` — a real deploy failure (see AuthStack comment), not a config typo caught by validation; root cause wasn't surfaced in the API error and wasn't worth blocking Phase 4 to fully chase.
**Alternative**: Keep chasing the exact valid attribute-list combination.
**Why not**: This is a first-party app client we fully control (not a third-party OAuth integration), so the extra restriction bought little; acceptable to revisit later if a concrete need appears.

## 22. Verify-page guard must not fire mid-submit
**Choice**: `VerifyPage`'s "no pending registration → redirect to /register" guard is suppressed while a verify submission is in flight (`!pending && !submitting`), and the description text tolerates `pending` being null mid-flight.
**Why**: Confirmed via live testing (2026-08-19, real Cognito) — `verify()` clears `pending` as soon as `confirmSignUp` + `autoSignIn` succeed, but the subsequent `loadCurrentUser()` await yields a render in between; without the guard, the page redirected to `/register` before the caller's own `navigate('/dashboard')` ran, even though registration had actually succeeded. `AuthLayout`'s own `user`-based redirect now carries the user to `/dashboard` once the session resolves.
**Alternative**: Reorder `auth-provider.verify()` to clear `pending` only after every async step resolves.
**Why not**: Same race exists for any multi-await sequence between clearing `pending` and the page's own navigate call; gating on `submitting` fixes it at the source regardless of internal provider ordering.

## 23. DynamoDB table RemovalPolicy: RETAIN, unlike the Cognito pool's DESTROY
**Choice**: The `timeline-main` table is created with `RemovalPolicy.RETAIN` — a `cdk destroy` of the API stack leaves the table behind.
**Why**: CLAUDE.md's cost/safety rules single out DynamoDB by name: "Never destroy DynamoDB data ... without explicit user confirmation." That's a standing rule, not a point-in-time judgment call, so the table needs a standing safeguard even while it's empty — unlike the Cognito pool (Phase 4, DECISIONS #18), which CLAUDE.md doesn't call out the same way and which is genuinely disposable pre-launch.
**Alternative**: RemovalPolicy.DESTROY to match the Cognito pool, since both are currently empty/near-empty dev resources.
**Why not**: A future accidental `cdk destroy` would need to be a deliberate, confirmed act for DynamoDB specifically — RETAIN makes that the default rather than something to remember every time.

## 24. Lambda: no reserved concurrency
**Choice**: `ApiFunction` has no `reservedConcurrentExecutions`.
**Why**: This AWS account's total regional Lambda concurrency limit is **10** (`aws lambda get-account-settings` → `ConcurrentExecutions: 10`) — a new/unverified-account default, not something Timeline caused. AWS requires ≥10 to remain unreserved account-wide, so reserving any amount for one function is rejected outright (confirmed via a failed deploy). Cost-abuse protection instead comes from API Gateway stage throttling (20 rps / burst 50) and TanStack Query's bounded retries (both already documented in COSTS.md).
**Alternative**: Request an AWS service-quota increase for Lambda concurrency, then reserve.
**Why not**: Unnecessary process for a solo dev account already covered by two other throttling layers; revisit if/when the account's limit is raised for another reason.

## 25. API auth token: Cognito ID token, not access token
**Choice**: The frontend sends the Cognito **ID token** as the `Authorization: Bearer` value; the CDK `HttpJwtAuthorizer`'s audience check (`jwtAudience`) is configured against the app client id, which appears in the ID token's `aud` claim.
**Why**: `GET /me`'s lazy profile-creation (DECISIONS #20) needs `name` and `custom:username` from the token claims to seed the DynamoDB `User` item without an extra Cognito API round-trip. Only the ID token carries attribute claims; the access token carries `scope`/`client_id` but not user attributes.
**Alternative**: Access token (the more commonly recommended choice for API authorization).
**Why not**: Would require a separate `fetchUserAttributes()` call from the Lambda (extra Cognito API round-trip, extra IAM permission) purely to recover data already sitting in the ID token; HTTP API's JWT authorizer supports both token shapes equally, so there's no security downside here for a single first-party client.

## 26. CORS preflight: explicit HTTP methods instead of HttpMethod.ANY
**Choice**: The API Gateway route list is `[GET, POST, PATCH, PUT, DELETE]`, not `HttpMethod.ANY`.
**Why**: Discovered live (2026-08-19) — `HttpMethod.ANY` also matches `OPTIONS`, routing CORS preflight requests to the JWT-authorized Lambda integration instead of API Gateway's built-in `corsPreflight` handling. A preflight carries no `Authorization` header, so the authorizer rejected it, and the browser read that as a failed preflight ("It does not have HTTP ok status") — blocking every real request even though the actual GET/POST/etc. handlers were correct.
**Alternative**: Keep `HttpMethod.ANY` and add an authorizer exception for `OPTIONS`.
**Why not**: HTTP API's authorizer scoping isn't per-method within a single route; the clean fix is to not claim the `OPTIONS` method on the route at all, letting the API-level `corsPreflight` config own it as designed.

## 27. Milestone/Stage delete is a transactional cascade (META + all links)
**Choice**: `DELETE /milestones/{id}` and `DELETE /stages/{id}` query AP10 (GSI1 by entity id) for every Timeline link, then delete META + all links in one `TransactWriteItems` call.
**Why**: DATA_MODEL.md's integrity rule — a deleted Milestone/Stage must not leave orphaned link items pointing at it. A single transaction means the delete is atomic: either everything goes, or nothing does (no partial state from a mid-batch failure). Live-tested (2026-08-19): deleting a linked milestone removed both the `MILESTONE#<id>/META` item and its `TIMELINE#<id>/MILESTONE#<id>` link in the same operation.
**Alternative**: Sequential individual deletes (`Promise.all` of separate `DeleteCommand`s).
**Why not**: Not atomic — a crash mid-loop leaves a dangling link pointing at a deleted item, which AP6's `BatchGetMilestones` would then silently skip (defensive `flatMap`), masking data corruption instead of surfacing it.

## 28. `/milestones/{id}/timeline-count` and `/stages/{id}/timeline-count`: additions beyond the original API.md
**Choice**: Two small GET endpoints returning `{ count }`, backed by the AP10 query the delete-cascade already needed.
**Why**: UI_SPEC.md documents "Appears in N timelines" on the milestone modal and a references-warning on stage delete, but the original API.md endpoint list had no way to serve either without over-fetching (e.g., pulling full `content` for every timeline just to count one reference). A dedicated lightweight endpoint was the smaller addition.
**Alternative**: Compute the count client-side from already-loaded timelines' content.
**Why not**: Would require fetching every one of the user's timelines' content just to count references to one milestone — far more requests and data than the feature needs.

## 29. SVG interactive elements need the drag-guard, not just `<button>`
**Choice**: `TimelineCanvas`'s pointer-down drag guard checks `closest('button, [role="button"]')`, not just `closest('button')`.
**Why**: Found live (2026-08-19) — stage bands are SVG `<g role="button">` (real `<button>` isn't valid inside `<svg>`). The canvas container's `setPointerCapture` on drag-start re-targets the subsequent click to the capturing element, silently swallowing clicks on any non-`<button>` interactive element inside the canvas. Milestones happened to work because `MilestoneLayer` renders real DOM `<button>`s (outside the SVG), which the original guard already excluded correctly.
**Alternative**: Use a real `<button>` for stage bands too (e.g., `foreignObject`).
**Why not**: `foreignObject` support/styling inside SVG is a bigger change for no benefit — the actual bug was the guard's selector being too narrow, not the element choice.

## 30. Route-level code splitting + a pinned Amplify vendor chunk
**Choice**: All routes are `React.lazy`-loaded behind `Suspense` boundaries in the two layouts; `aws-amplify` is pinned to its own manual chunk.
**Why**: The canvas route pulls the whole canvas stack and shouldn't burden someone opening the dashboard (it's now a separate 31.8 kB chunk). Amplify is the single heaviest dependency, is needed at boot for the session check (so it can't be lazy), and changes far less often than app code — its own chunk gives it a long-lived cache entry.
**Alternative**: Leave everything in one bundle (the prior state).
**Why not**: The >500 kB warning was a documented deferral waiting for exactly this phase. Note the warning persists: the remainder is vendor weight, not route weight — honest state, not a fixed one.

## 31. ✋ Entity color is a palette **name** on the link entity, not a hex on the entity (2026-08-19)
**Choice**: User-selectable Milestone/Stage color is an `EntityColor` enum (`DEFAULT|AMBER|ROSE|VIOLET|TEAL|GREEN|SLATE`) stored on the **link** entity (`TimelineMilestoneRef.color`, `TimelineStageRef.color`), resolved to a `--color-entity-*` token at render.
**Why**: Two binding rules meet here. Design tokens only (CLAUDE.md) → stored data may name a token but never carry a raw color, so the picker's swatches *are* the allowed values and there is no free-form hex input. Presentation lives on the link (product principle) → the same shared Milestone can legitimately read differently in two timelines, which is a feature of the reuse model rather than a compromise.
**Alternative**: A `color` field on the Milestone/Stage itself, or a free hex picker.
**Why not**: A color on the shared entity would force one timeline's palette choice onto every other timeline referencing it, contradicting the entity/presentation split. A hex picker would put untokenized visual values into the database permanently.

## 32. Entity color tokens live on `:root`, not in Tailwind's `@theme`
**Choice**: `--color-entity-*` are declared in the `@layer base :root` block; every other color token stays in `@theme`.
**Why**: Found live (2026-08-19) — Tailwind v4 tree-shakes theme variables that no utility class references. These are only ever read through a `var(--color-entity-…)` string assembled at runtime from stored data, which the class scanner cannot see, so they were dropped from the emitted CSS and every custom color silently resolved to nothing. The `--motion-*` tokens in the same file already used `:root` and did resolve, which is what isolated the cause.
**Alternative**: Keep them in `@theme` and add a safelist / dummy utility usages to keep them alive.
**Why not**: A hidden "don't delete this, it keeps CSS alive" construct is exactly the kind of thing that gets pruned later by someone tidying up. `:root` states the intent directly.

## 33. YouTube embeds store a validated video id, never a URL
**Choice**: `YouTubeBlock.youtubeId` holds the bare 11-char id, parsed and validated (`/^[A-Za-z0-9_-]{11}$/`) from whatever the user pasted; the embed `src` is rebuilt from it at render time against `youtube-nocookie.com`.
**Why**: Interpolating a user-supplied URL into an iframe `src` is an injection sink. Rebuilding from a validated id makes a hostile value unrepresentable rather than merely filtered. Host matching is exact (`youtube.com.evil.example` is rejected), and the parser is unit-tested against that case specifically.
**Alternative**: Store the URL and validate its host at render.
**Why not**: Keeps a hostile string alive in the database and puts the security check at every render site instead of once at the boundary.

## 34. ✋ S3 uploads: private bucket + presigned URLs, caps enforced before signing (2026-08-19)
**Choice**: Images ≤5 MB and files ≤10 MB, narrow MIME allowlists (SVG and executables excluded), private bucket with all public access blocked, keys namespaced `u/<userId>/<ulid><ext>`, upload URLs 5 min / view URLs 15 min, `Content-Type` + `Content-Length` pinned into the upload signature, FILE downloads forced to `attachment`.
**Why**: User-approved cost review — S3 is the only service that stores unbounded bytes, so every control is server-side and pre-signature: the client cannot widen a cap after validation. Per-user key prefixes make ownership decidable from the key alone (a foreign key returns 404, no existence leak). SVG is excluded because it is an executable document served from a domain we presign for.
**Alternative**: Public-read bucket with unguessable keys (simpler, no presign round-trip).
**Why not**: Security through unguessable URLs is not access control, and it would make every past upload permanently public if a key ever leaked.
**Accepted gap**: no GC of objects on milestone/block delete, and uploads abandoned before save are orphaned. Bounded and negligible at these caps; documented in COSTS.md and SECURITY.md rather than solved with machinery the project doesn't need yet.

## 17. Canvas vertical layout: dynamic axis, two-sided levels, label degradation
**Choice**: The axis position adapts to content. With stages, it moves down to exactly the stage zone + bottom padding (clamped to 40–72% of height), giving milestones the remaining space above; the below zone belongs to stages so connectors never cross bands. Without stages, the axis centers and milestone levels **alternate above/below** it. Collision detection is **label-width-aware** (measured text via canvas `measureText`, capped at the CSS truncation width, plus dot/padding); greedy interval leveling lifts a milestone only when footprints truly overlap. Levels are **capped by available height with edge padding**; a milestone whose label cannot fit anywhere degrades to a **dot-only marker** (title stays in the tooltip and accessible name) instead of overlapping or clipping. Below-axis connectors skip the ruler band; all connectors render beneath all labels; labels carry opaque backgrounds — text overlap is impossible by construction.
**Why**: Two user-reported issues (2026-08-19): dot-distance-only clustering let wide labels overlap, and a fixed axis wasted the whole below zone on stage-less timelines while towers crowded the top edge. Balanced two-sided placement halves tower height; the level cap plus dot-only degradation keeps edges padded and the canvas clean while every milestone's existence stays visible.
**Alternative**: Fixed axis with above-only stacking and uncapped levels (first implementation).
**Why not**: Wasted half the canvas on stage-less timelines and let stacks reach the viewport edge.
