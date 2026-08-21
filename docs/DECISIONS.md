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

## 35. ✋ Collaboration is granted explicitly at two scopes (2026-08-19)
**Choice**: A collaborator is invited either to a **milestone** (edit rights on that milestone alone) or to a **timeline** (edit rights across its meta, stages and every milestone linked to it). Membership items live at `TIMELINE#<id>/MEMBER#<uid>` and `MILESTONE#<id>/MEMBER#<uid>`; roles are OWNER/EDITOR/VIEWER checked as capabilities (VIEW/EDIT/MANAGE), never by comparing role strings.
**Why**: Milestones are owned by *users* and reusable across timelines, so "can an editor on timeline A edit a milestone that also appears in private timeline B?" has no safe implicit answer. Making the grant explicit removes the ambiguity; the residual cross-timeline reach is handled by **informed consent** — before a timeline-scoped invite, the UI states the scope and reports how many of that timeline's milestones also appear elsewhere (`GET /timelines/{id}/share-impact`, built on AP10).
**Alternative**: Infer rights from timeline membership alone (leaks silently), or require ownership for all content edits (collaborators can't fix a typo).
**Why not**: The first hides a real integrity/privacy problem; the second makes collaboration barely useful. Both were offered to the user, who chose the explicit two-scope model instead.

## 36. ✋ Public links use a rotatable share token, on a separate unauthenticated route (2026-08-19)
**Choice**: Leaving PRIVATE mints a random 32-char `shareToken` with its own claim item (`SHARE#<token>` → timelineId, AP14). Public reads go through `/public/*` — a **second API Gateway route with no JWT authorizer** and its own tighter throttle (5 rps vs 20). Visibility is re-checked on every request; the token is a lookup key, never a capability.
**Why**: The ULID is timestamp-prefixed and not secret, so putting it in a public URL would make the link unrevocable without changing the timeline's identity. A separate path prefix makes "is this endpoint public?" answerable from the route table rather than from handler logic. Anonymous traffic is the app's first stranger-reachable surface, hence the separate rate ceiling as a cost control as much as a security one.
**Alternative**: Public read on the existing routes with an optional authorizer, using the timeline id as the link.
**Why not**: An optional-auth route makes every handler responsible for knowing whether it has an identity — exactly the kind of thing that fails quietly. Verified live: `/public/*` returns 404 (not 401) without a token, every other route still 401s, and flipping a timeline to PRIVATE kills the link immediately.

## 37. Mentions are resolved at write time and grant no access
**Choice**: `@username` is parsed from block text, resolved through AP2 at write time, and stored as `Milestone.mentions: {userId, username}[]`. Unknown handles are dropped and stay plain text. Rendering highlights only resolved handles. A mention **never** widens permissions.
**Why**: Storing a resolved `userId` is what a future notification consumer needs, and it avoids a username lookup per render. Dropping unknown handles means the UI can never imply a user exists when they don't. Keeping mentions access-neutral matters most: if mentioning granted access, `@`-ing someone would be a privilege-escalation primitive — so the editor instead tells the author to invite the person if they should see the milestone.
**Alternative**: Parse `@handles` at render time.
**Why not**: Needs a lookup per render, and leaves nothing durable for notifications to consume. The notification items themselves (`USER#<id>/NOTIF#<ulid>` via a stream) are designed but deliberately unbuilt — they'd add a stream, a consumer and SES.

## 38. Edit forms seed once per entity, and background refetches are off
**Choice**: `refetchOnWindowFocus` is disabled globally, and the reset effects in `MilestoneModal`/`StagePopover` track the id of the entity currently loaded (via a ref) instead of firing whenever their query-derived props change identity.
**Why**: User-reported (2026-08-19) — the "Ongoing" checkbox could not be unchecked. The cause was not the checkbox: a real click in a native modal toggles it correctly (verified with a DOM probe). It was that `stage`/`milestone` come from a React Query result, so **any** background refetch hands back a new object with identical contents, re-running the reset effect and snapping every field back to its saved value mid-edit. With `staleTime: 30s` and focus-refetching on by default, simply clicking away and back was enough. The same bug silently discarded in-progress text and freshly uploaded blocks.
**Alternative**: Depend on `stage.id` in the dependency array instead of the object.
**Why not**: That fights `react-hooks/exhaustive-deps` and hides the intent. The ref guard keeps dependencies honest while stating plainly that seeding happens once per entity.
**Also**: turning off focus-refetching removes a stream of API calls nothing needed — a small cost win alongside the correctness fix.

## 17. Canvas vertical layout: dynamic axis, two-sided levels, label degradation
**Choice**: The axis position adapts to content. With stages, it moves down to exactly the stage zone + bottom padding (clamped to 40–72% of height), giving milestones the remaining space above; the below zone belongs to stages so connectors never cross bands. Without stages, the axis centers and milestone levels **alternate above/below** it. Collision detection is **label-width-aware** (measured text via canvas `measureText`, capped at the CSS truncation width, plus dot/padding); greedy interval leveling lifts a milestone only when footprints truly overlap. Levels are **capped by available height with edge padding**; a milestone whose label cannot fit anywhere degrades to a **dot-only marker** (title stays in the tooltip and accessible name) instead of overlapping or clipping. Below-axis connectors skip the ruler band; all connectors render beneath all labels; labels carry opaque backgrounds — text overlap is impossible by construction.
**Why**: Two user-reported issues (2026-08-19): dot-distance-only clustering let wide labels overlap, and a fixed axis wasted the whole below zone on stage-less timelines while towers crowded the top edge. Balanced two-sided placement halves tower height; the level cap plus dot-only degradation keeps edges padded and the canvas clean while every milestone's existence stays visible.
**Alternative**: Fixed axis with above-only stacking and uncapped levels (first implementation).
**Why not**: Wasted half the canvas on stage-less timelines and let stacks reach the viewport edge.

## 39. Content blocks are a shared, reorderable structure on both Milestones and Stages (2026-08-20)
**Choice**: `blocks` moves from a Milestone-only field to the shared content model — `Stage.blocks` is added (optional), the cap is renamed `BLOCKS_MAX` and raised to 100, and one `blocksSchema` validates both. On the web side a single framework-free module (`features/blocks/block-draft.ts`) owns add/remove/duplicate/move/resolve, with `BlockEditor` and `BlockList` shared by `MilestoneModal` and `StagePopover`. `order` is renumbered from on-screen position at save time, so the stored sequence is exactly what the user arranged.
**Why**: User-requested (2026-08-20): unlimited blocks on both entities, freely reorderable. Duplicating the editor into `StagePopover` would have doubled the surface where the public-path key-stripping and URL-resolution rules must hold; keeping the rules in one pure module means both entities inherit fixes automatically, and the reorder/duplicate logic is unit-testable without rendering.
**Alternative**: Keep blocks on Milestones and give Stages a richer description field.
**Why not**: It re-collapses the distinction the product principles keep — a Stage is a first-class entity, not a labelled interval — and would have meant two divergent editors.

**Security consequence (deliberate, tested)**: Stage blocks now cross the public boundary, so they need the same treatment milestone blocks already had. `stripBlockKeys` is now a named helper applied to both, and the public allowlists (`publicSetlistIds`, `publicMediaKeysByBlockId`) walk milestones **and** stages — built from milestones alone they would have silently 404'd stage media. Both are covered by regression tests that were mutation-checked to confirm they actually fail when the stripping is removed.

**Size guard**: the count cap alone cannot bound the payload — 40 blocks of maximum-length text exceed DynamoDB's 400KB item limit while sitting well under `BLOCKS_MAX`. `blocksSchema` therefore also enforces `BLOCKS_BYTES_MAX` (350KB), turning what would be an opaque write failure into a validation error at the boundary. "Unlimited" is honest at the scale a user will actually reach, not literally unbounded; if entries ever approach it, DATA_MODEL.md's option of storing blocks as separate items is the next step.

## 40. Clearing an embed's URL removes the block instead of failing validation (2026-08-20)
**Choice**: In `resolveBlocks`, a YouTube/setlist block whose URL field is empty is **dropped** from the saved payload. A non-empty but unparseable URL still reports an error.
**Why**: User-reported (2026-08-20) — deleting a setlist link produced a blocking "That doesn't look like a setlist.fm link." error. An embed with no id cannot be saved at all, so treating empty as invalid trapped the user in a form that could neither be saved nor emptied, the only escape being a remove button they had no reason to look for. Empty means "I don't want this embed", which is unambiguous; empty **text** blocks are still kept, because text is primary content and silently deleting a block the user is looking at would be worse than an empty box.
**Alternative**: Keep the error and rely on the remove button.
**Why not**: It makes the obvious gesture (clear the field) a dead end.

## 41. Reordering ships as drag-and-drop *and* explicit move buttons (2026-08-20)
**Choice**: `BlockEditor` rows are draggable via a grip (native HTML5 drag events, no new dependency), and every row also carries ↑/↓, duplicate and remove buttons with `aria-label`s.
**Why**: Drag-and-drop was the requested interaction, but it is unreachable by keyboard and awkward on touch, so on its own it would fail the Definition of Done's keyboard-access requirement. The grip arms `draggable` only while held, so dragging never hijacks text selection inside a block's textarea. A dnd library (`@dnd-kit` et al.) was not added: native events cover this list, and the buttons — which the accessible path needs regardless — already provide the keyboard story a library would have been bought for.
**Alternative**: Add `@dnd-kit/sortable`.
**Why not**: A dependency whose main benefit (accessible keyboard sorting) is already covered by controls this UI needs anyway.

## 42. Upload cleanup: block-level deletion on write, cross-checked sweep for the rest (2026-08-21)
**Choice**: Two mechanisms, not one. (1) Whenever a milestone/stage is permanently deleted, or a PATCH removes/replaces a file or image block, the affected S3 object(s) are deleted in the same request — a diff of old vs. new block s3Keys on update, the full set on delete, always *after* the DynamoDB write succeeds. (2) A daily EventBridge rule invokes the existing API Lambda with a `{task:'upload-cleanup'}` payload (branched on in `lambda.ts`, not routed through Hono) to reclaim uploads that were presigned but never attached to anything at all.
**Why**: (1) alone can't catch an upload abandoned before save — there's no block to diff against. (2) alone would leave deleted content's files orphaned for up to the grace period for no reason, when the deleting request already knows exactly which keys just became unreachable. Together they cover both cases with the DB write, never S3, always the transaction of record — on delete, the S3 deletion only runs after the DynamoDB delete succeeds, so a failed delete can't destroy a file for content that still logically exists.
**Safety property**: cleanup cross-checks every pending upload against `collectReferencedS3Keys()` — the live set of keys any current milestone/stage actually references, *recomputed on every run* — rather than trusting a "confirmed" flag some write path might have missed. A key is deleted only if it's both past the 2-day grace period and absent from that fresh set. `cleanup.test.ts` mutation-checks this: removing the reference check from the filter was confirmed to fail two tests before being restored.
**Alternative**: A "confirmed" boolean flag flipped when a block is saved, checked instead of rescanning live content.
**Why not**: Makes safety depend on every current *and future* write path remembering to flip the flag correctly. Rescanning actual content at cleanup time can never be wrong in that way — the worst a missed flag can do is delay cleanup, never cause an incorrect deletion.
**Infra note**: the sweep reuses the existing Lambda (one more invocation/day) rather than a second function — no new role, log group, or cold-start budget line (COSTS.md).

## 43. Terms & Conditions content lives outside the i18n key system (2026-08-21)
**Choice**: The two full documents (EN/ES) live in `features/legal/terms-content.ts` as plain data, selected by `i18n.language` — not as `TranslationShape` keys in `locales/en.ts`/`es.ts`.
**Why**: `TranslationShape` requires every leaf to be a string; this is a long, bilingual, non-interpolated legal document, not UI microcopy. It's the same category of decision as `formatPartialDate` picking behavior by locale rather than through a translation key — locale-aware content, not string interpolation. Forcing ~2,500 words per language through single-line string literals (with the escaping problems that produced — several apostrophes needed curly-quote substitution to parse at all) would fight the type system for no benefit to translators or to the rest of the app.
**Placeholders**: every field needing real information before production (operator legal name, contact email, governing-law jurisdiction, effective date) is a named constant in `PLACEHOLDERS`, rendered with a visible highlight (`<mark>`) wherever it appears in the document, plus a summary "needs review" callout at the top of the page. This is a generic template, not reviewed legal text — flagged as such on the page itself, not just in a code comment.
**Alternative**: Force the content through `returnObjects: true` i18n keys to keep one string-sourcing mechanism app-wide.
**Why not**: Offered to the user as the "by the book" option; the type-safety cost for a document with no runtime interpolation needs wasn't worth it, and a plain data module keeps this content easy to actually read and edit as a document rather than as escaped TS string literals.

## 44. App version is a single shared constant, displayed next to the logo (2026-08-21)
**Choice**: `APP_VERSION` lives once in `packages/shared/src/constants.ts` (currently `'1.0'`), consumed by `LogoFull` (so it appears wherever the logo does — header, auth screens, the public share page) and by the Terms page. Versioning is two-part, not semver: bump the second number for a small change (`1.0` → `1.1`), the first for a bigger one (`1.x` → `2.0`) — the user's own scheme, chosen over semver's three-part major.minor.patch for simplicity at this project's scale.
**Why**: A version number is only useful if it's somewhere the user actually looks, and it needs exactly one place to update or it drifts. Baking it into `LogoFull` means every surface that shows the logo shows the version for free, with no per-page wiring.
**Responsibility**: there's no automated trigger for the bump — it's a judgment call made whenever a user-visible change ships, mirrored in this file's version constant, `docs/STATUS.md`'s current-version line, and the Terms page's "Last updated" line if that section of the app is what changed.

## 45. Dark mode swaps the same CSS custom properties every component already uses (2026-08-21)
**Choice**: `tokens.css` gained a `:root[data-theme='dark']` block redefining the core tokens (`--color-bg`, `--color-surface`, `--color-text*`, `--color-border`, `--color-timeline-line`, `--color-accent*`, `--color-danger`) with dark values; entity colors (amber/rose/violet/…) are left unchanged — already muted-but-saturated enough to read on a dark ground. `src/lib/theme.ts` reads/writes the choice to `localStorage`, defaulting to `prefers-color-scheme` on first visit; a small inline script in `index.html` applies it before first paint, so there's no flash of the wrong theme. `ThemeToggle` (a sun/moon button, same footprint as `LanguageSwitcher`) sits in both `AppLayout` and `AuthLayout`.
**Why**: Every surface in the app already renders through `var(--color-*)` — that was already true before this change (DECISIONS #32 moved entity colors to `:root` for exactly this reason: Tailwind v4 utility classes compile down to `var()` references). Overriding the same variable names under a more specific selector is therefore the *entire* theme switch — no component needed a dark-mode class, and no component can drift out of sync with the palette the way per-component dark variants would.
**Alternative**: `prefers-color-scheme` media query only, no manual toggle.
**Why not**: "Night mode" as requested implies user control, not just following the OS. The chosen approach does both — system preference is the default, the toggle is the override — rather than picking one.

## 46. Header nav is centered on the header, not on a "logo vs. actions" grid split (2026-08-21)
**Choice**: The nav (Timelines/Milestones/Stages) is absolutely positioned at the header's horizontal center (`left-1/2 -translate-x-1/2`), replacing an earlier `grid-cols-[1fr_auto_1fr]` layout.
**Why**: User-reported (2026-08-21) — the three nav options weren't centered, more visibly so once a label was long (Spanish's "Tus líneas de tiempo" is much longer than "Hitos"/"Etapas"). A `1fr auto 1fr` grid only centers its middle column when both flanking columns share the same min-content width; the logo and the actions cluster (theme toggle, language switcher, notifications, avatar) never reliably matched, and a wider nav block made the resulting offset more visually obvious — exactly the symptom reported. Absolute positioning centers the nav on the header itself, independent of what either side measures.
**Alternative**: Give both flanking grid columns an explicit matching `minmax()` width.
**Why not**: Only correct for the specific content widths measured today; the actions cluster changes size as features are added (it already grew once this session, when the theme toggle joined it) and would silently reintroduce the same bug.

## 47. Canvas keyboard shortcuts must not swallow typing inside dialogs rendered in the same subtree (2026-08-21)
**Choice**: `TimelineCanvas`'s `onKeyDown` now bails out immediately when the event target is inside `input, textarea, select, dialog`, before any shortcut logic runs.
**Why**: User-reported — could not type the digit `0` into Milestone/Stage forms. Root cause: `AddMilestoneDialog`/`AddStageDialog` render as DOM children of the same container that listens for canvas shortcuts (`0` = fit, `+`/`-` = zoom, arrows = pan), so a keydown inside one of their fields bubbles up to that listener. For `0` specifically, the handler calls `fit()` and then unconditionally `e.preventDefault()` — and `preventDefault()` on a bubbled keydown still cancels the browser's default character-insertion action, regardless of which ancestor called it. The character was never actually rejected by validation; it never arrived. The same bug would have hit arrow-key text-cursor navigation in those same fields, just less noticeably.
**Alternative**: Special-case only the `0` key, or only guard `AddMilestoneDialog`/`AddStageDialog` specifically.
**Why not**: The root cause is generic (any shortcut key colliding with typing in a same-subtree form control), and future dialogs rendered inside the canvas container would reintroduce the identical bug one key at a time. Guarding by target type once, at the top, closes the whole class.

## 48. DAY-precision date entry is three custom digit fields, not a native date input (2026-08-21)
**Choice**: `PartialDatePicker`'s DAY precision now renders three buffered text fields in DD/MM/YYYY order (day, month, year), replacing `<input type="date">`.
**Why**: User-reported — the date picker showed mm/dd/yyyy instead of dd/mm/yyyy. Root cause: a native `<input type="date">`'s *displayed* format follows the browser/OS locale, not the app's `i18n.language` and not CLAUDE.md's DD/MM/YYYY domain convention — there is no HTML or CSS way to override that. Any user whose browser locale is `en-US` would see mm/dd/yyyy regardless of which app language they'd chosen, independent of anything in this codebase.
**Design**: reuses the exact buffering pattern already established for the standalone year field on this same component (DECISIONS-adjacent fix, 2026-08-19/20): each field keeps its own text buffer while focused so intermediate states (empty, a leading zero, a single digit) are never silently reverted, and commits as soon as day+month+year together round-trip through `parseDateString(formatDateString(...))` successfully — the same calendar validation (rejects Feb 31, etc.) the rest of the app already relies on, not a reimplementation of it. Typing 2 digits into day or month auto-advances focus to the next field.
**Alternative**: Keep the native input; try to hint format via `lang`/`pattern` attributes.
**Why not**: `<input type="date">` has no attribute that controls its display format — `lang` affects it in some browsers but is unreliable across engines, and there is no standard override at all in Firefox/Safari's implementations.

## 49. DAY-precision buffers clear on group blur, not per-field blur (2026-08-21)
**Choice**: The day/month/year trio (DECISIONS #48) clears its buffers only when focus leaves all three fields together (checked via `relatedTarget` against the wrapping container), not when any single field blurs.
**Why**: User-reported — typing a digit then tabbing to the next field made the just-typed digit disappear. Root cause: each field cleared its own buffer on its own blur, and the trio only commits once all three hold values — so tabbing day → month blurred day before the commit could ever fire, and the buffer-clear then reverted to the (still-null) committed value. The fix is the standard "did focus leave the whole composite control" check used for grouped widgets generally.

## 50. Timelines gain the delete-with-confirmation flow they never had (2026-08-21)
**Choice**: `useDeleteTimeline` + a confirm `Dialog` on `TimelinePage`'s header, calling the already-existing (but previously unused from the UI) `DELETE /timelines/:id` route.
**Why**: User asked for delete confirmation on milestones, stages, *and* timelines. Milestones and stages already had it (Dialog-based inline confirmation). Timelines had no delete action reachable from the UI at all — the API client function and backend route existed, unused. The copy is explicit that deleting a Timeline never deletes its Milestones/Stages, only the links — confirmed against `timelines-repo.ts`'s own doc comment before writing it, not assumed.

## 51. Selection is color-only; the size-changing "pop" is reserved for the curator's `isHighlighted` flag (2026-08-21)
**Choice**: `scale-125` on a Milestone's diamond now only responds to `isHighlighted` (a standing, authored choice). Selecting a milestone or stage is indicated by color (accent ring/stroke, accent connector, bold accent label) with no size change. Stages gained an actual `selectedId` concept — they had none before, only hover.
**Why**: User asked for "clearly indicate the selected item without heavy animations." A size transform on select/hover reads as a pop every time you click around the canvas; color carries the same information without motion. `isHighlighted` is a different kind of state — permanent, author-set — where a lasting size difference is appropriate and not a per-interaction animation.

## 52. Axis Start is deliberately quiet; Present reads as one unit with its arrow (2026-08-21)
**Choice**: The Start marker lost its accent color, flag glyph, and bold label — now a plain 12px tick in the muted timeline-line color with a small gray label, matching the ruler's own restraint. Present's label moved from a separate row above the axis to sitting directly against the arrow tip, vertically centered on the axis line itself (`dominantBaseline="middle"`).
**Why**: User asked to reduce Start's visual weight and make Present read as connected to its arrow rather than a floating label near it. Putting the two on structurally different rows (Start above the axis, Present centered on it) is also what keeps them from ever colliding — DECISIONS #48's vertical-stagger workaround is no longer needed, superseded by this layout.

## 53. Milestones and Stages can carry an optional Short Label, shown instead of the full name on canvas (2026-08-21)
**Choice**: `shortLabel?: string` on both entities (40-char cap, `LIMITS.SHORT_LABEL_MAX`), editable in all four milestone/stage forms directly below the title field. The canvas renders `shortLabel || title`; the accessible name and hover tooltip always use the full `title`, regardless of what's displayed. Truncation for what's actually rendered stays width-based, never a fixed character cut — milestones already got this for free from CSS `text-overflow: ellipsis`; Stages (SVG `<text>`, no native ellipsis) got a new `truncateToWidth()` helper (`lib/measure-text.ts`) that binary-searches the longest prefix that fits the real measured width at the actual font, unit-tested (5 cases) against the deterministic Node fallback measurer.
**Why**: Long, descriptive titles are good for detail views but crowd the canvas; a compact alternate label solves that without shortening the real name anywhere it matters (search, sharing, the entity's own detail view). Falling back to `title` needed no special-casing beyond the JS `||` the request asked for — empty-string (explicitly cleared) and `undefined` (never set) both fall back identically.
**Boundary**: an empty string is a valid, meaningful value here (matches the existing `website`/`avatarKey` profile-schema convention) — it explicitly clears a previously-set short label rather than being rejected as invalid.

## 54. Milestone collaborators moved out of the edit form into their own dialog (2026-08-21)
**Choice**: `MilestoneCollaboratorsDialog` (new, mirrors `ShareDialog`) holds `CollaboratorsPanel`, opened from a small "Collaborators on this milestone" link in both the view and edit footers of `MilestoneModal`. The inline collaborators block that used to sit below Save/Cancel inside the edit `<form>` is gone.
**Why**: User-reported — the edit form showed two unrelated action pairs (Save/Cancel for the pending edit, Invite for collaborators), which read as confusing when only one button pair was expected at the end of a form. Inviting a collaborator is an independent, immediate action, not part of the draft Save/Cancel commits — the same reasoning that already put Timeline-level sharing in its own `ShareDialog` rather than inline in a timeline-settings form.
**Alternative**: A tabbed edit form (Details / Collaborators) sharing one dialog.
**Why not**: Once on a "Collaborators" tab, Invite is still a second, independent action competing with Save/Cancel for attention — tabs solve the layout problem, not the actual one (two different kinds of action stacked together).

## 55. Canvas wheel handling excludes dialogs, the same way the keydown handler already did (2026-08-21)
**Choice**: `TimelineCanvas`'s wheel listener now bails out when the event target is inside a `<dialog>`, before calling `preventDefault()` or touching pan/zoom state.
**Why**: User-reported — on a shorter viewport (laptop screen), the Add Milestone/Add Stage dialog's content is taller than 85vh and needs to scroll internally, but scrolling never worked and the dialog seemed to "close" instead. Root cause: identical to DECISIONS #47's keydown bug — the dialogs render as DOM children of the same container the canvas's wheel handler listens on, so scrolling the dialog bubbled up and got hijacked into a canvas pan, with `preventDefault()` blocking the browser's native scroll entirely. Never visible on a tall enough screen, where the form fits within 85vh and nothing ever needs to scroll.

## 56. Backdrop-click detection compares coordinates, not just event target (2026-08-21)
**Choice**: `Dialog`'s outside-click-to-close check no longer treats every `e.target === ref.current` as a backdrop click. It additionally checks whether the click coordinates fall inside the dialog's own bounding rect — only a click genuinely outside that box closes it.
**Why**: User-reported — clicking or dragging the modal's scrollbar closed it. A native `<dialog>`'s scrollbar isn't a separate DOM node; a click on it (like a click on the backdrop) reports the `<dialog>` element itself as `e.target`, since neither is a distinguishable child element. The old check couldn't tell "clicked the backdrop, outside the box" apart from "clicked the scrollbar, inside the box" — both looked identical from `e.target` alone. Comparing `clientX`/`clientY` against `getBoundingClientRect()` does distinguish them, since the scrollbar is geometrically inside the dialog's rendered box and the backdrop is outside it.
**Scope**: This is the one shared `Dialog` component every modal in the app uses, so the fix applies everywhere at once — Add Milestone/Stage, Share, Terms links, Change Password, the milestone Collaborators dialog, etc. — not a one-off patch on a single dialog.

## 57. Dashboard splits Mine from Shared with me; dark mode is now the default (2026-08-21)
**Choice**: `DashboardPage` partitions the timeline list client-side by `timeline.ownerId === user.id` into two sections, mirroring the split `LibraryPage` already had for Milestones/Stages. Separately, `getStoredTheme()` (and the matching pre-paint script in `index.html`) now default to `'dark'` for a first-time visitor instead of following `prefers-color-scheme`.
**Why**: User-reported — a timeline they were invited to (not owned) sat undistinguished in "Your timelines," alongside ones they actually own. The API already returns both in one list (AP3 ∪ AP12) with `ownerId` on every row, so no backend change was needed — this is presentation, not access control. Dark-as-default was a direct product request, not a UX judgment call on my part.
**Scope note**: the toggle and explicit-choice persistence are unchanged — a visitor who picks light still gets light on their next visit. This only changes what a visitor with no stored choice yet sees first.

## 58. Cognito gets a Hosted UI domain + OAuth capability, Google itself deferred to a second deploy (2026-08-21)
**Choice**: `AuthStack` now provisions a Cognito-hosted domain (`timelines-dev-<account-id>`, globally unique by construction) and enables `authorizationCodeGrant` OAuth on the existing User Pool Client — `supportedIdentityProviders` still lists only `COGNITO` for now. Google joins that list in a follow-up deploy, once a Google OAuth Client ID/Secret exists.
**Why**: User asked for Google sign-in. The blocking dependency is a Google Cloud OAuth client, which only the account owner can create (needs their own Google account, consent screen, and — critically — the exact Cognito redirect URI, which only exists once the domain is deployed). Deploying the domain first, independent of any Google credentials, is what makes it possible to hand back a concrete redirect URI rather than a guess. This step alone is free and purely additive — confirmed via `cdk diff` before deploying: no replacement of the existing User Pool Client (which would have broken already-deployed frontend sessions), just new properties on it plus one new domain resource.
**Username policy for federated sign-ups**: Google provides no equivalent of this app's chosen username field. Decided with the user: auto-derive from the email's local part (slugified, de-duplicated with a numeric suffix if taken), shown as an editable one-time step on first login — not silently permanent, and not the raw email itself (which doesn't fit the existing username charset/length rules).
**Not yet implemented**: the `UserPoolIdentityProviderGoogle` construct, the SSM secret (name reserved: `/timeline/dev/google-oauth-client-secret`), the "Sign in with Google" button, and the first-login username-confirmation flow — all gated on the user obtaining Google credentials first (docs/AWS_SETUP.md, guided steps 6–7).

## 59. Timeline start/end auto-expand when a linked item falls outside them (2026-08-21)
**Choice**: `linkMilestoneToTimeline`/`linkStageToTimeline` (content-service.ts) compare the item's date span against the timeline's current `start`/`end` right after linking (new or existing item, same code path either way) and widen whichever bound needs it via the existing `updateOwnTimeline`. Pure comparison logic lives in `boundary-expansion.ts`, unit-tested independent of the wiring. An ongoing timeline's `end` is never touched — it stays open-ended regardless of how far out an item is dated; a Stage with no end date of its own is compared against *today* for this purpose only (`stageEffectiveEnd`), never pushing the timeline's end past the present.
**Why**: User-reported/requested — the canvas only ever renders inside `[timeline.start, today]` (canvas-items.ts, itself a prior product rule), so a newly created or newly linked item dated outside that window would silently never appear. Widening the timeline's own bounds at the moment of linking is the fix that keeps that render rule intact while making sure nothing a user just added can vanish.
**Scope**: only fires on **link** (creating-and-linking, or attaching an existing item) — not on later editing an already-linked item's date. Matches the literal request ("if a Milestone or Stage is *created*..."); revisit if edits need the same treatment later, since that would mean checking every timeline an edited item is linked to, not just one.

## 60. Timeline editing: name/start/end, reachable from two places (2026-08-21)
**Choice**: `EditTimelineDialog` (title/start/ongoing/end only — not description, unit, or ruler visibility, which weren't asked for) is reachable both from each Dashboard row (an "Edit" link, kept as a sibling of the row's `<Link>` rather than nested inside it — nesting interactive elements inside an anchor is exactly the class of bug DECISIONS already hit once with a nested form) and from the timeline view's own header, next to Share/Delete.
**Why**: Direct user request. Reuses the existing `PATCH /timelines/:id` route and `updateTimelineSchema` — no backend change needed for this part.
**Not gated by role client-side**: Edit shows unconditionally, matching how Delete already behaves (DECISIONS #50) — the backend's own `EDIT`/`MANAGE` capability check is the real boundary. Consistent with the existing precedent rather than introducing one-off role-awareness the frontend doesn't have data for yet.

## 61. Welcome Tutorial: three steps, browser-level "seen" flag, reuses the canvas's own shapes (2026-08-21)
**Choice**: `WelcomeTutorial` shows automatically the first time `hasSeenTutorial()` (localStorage, unscoped to any account — same pattern as the theme preference) is false, checked on `DashboardPage` mount since the root route always redirects there first. A permanent "Tutorial" link on the same page reopens it anytime. Its three steps' visuals are the *actual* shapes `MilestoneLayer`/`StageLayer`/`TimelineMotif` already render (the real diamond+shine, the real tinted band, the real dot-and-line motif) — not a separate icon set — so the tutorial doubles as a preview of what's about to appear on the canvas.
**Why**: Direct user request, including the three concept examples and the Next/Back/Skip/Finish controls. "Finish" is what the primary button becomes on the last step rather than a fifth, separately-rendered button — four always-visible actions on a 3-step flow would work against "simple and brief."
**Scope**: shown once per browser, not per account (no backend field for it) — the same tradeoff already made for the theme preference. A user switching devices sees it again; judged acceptable for an onboarding nicety, revisit only if that turns out to bother anyone in practice.
