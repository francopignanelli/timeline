# Timeline — Sharing, Collaboration & Mentions (design review)

**Status**: ✅ **built and deployed** (2026-08-19). Written as a design review after
Phases 0–7, then implemented; the design below matches what shipped. Deviations
and things deliberately left out are listed in §7.
Scope: public links, collaborator roles, and `@username` mentions.

This reviews what already supports these features, what has to change, and the
decisions that need to be made before writing code. Costs and security are
called out per feature because all three cross the auth boundary.

---

## 0. What already exists (and is load-bearing)

The data model anticipated most of this. Concretely:

| Already there | Where | Why it matters |
|---|---|---|
| `VISIBILITIES = PRIVATE \| SHARED \| UNLISTED \| PUBLIC` | `shared/constants.ts` | The vocabulary exists; only the *schema* restricts it |
| `ROLES = OWNER \| EDITOR \| VIEWER` | `shared/constants.ts` | Role names already agreed |
| `Timeline.visibility` field | `shared/types.ts`, persisted | Already stored on every timeline |
| **AP2**: `USERNAME#<lower>` → `CLAIM` | live in DynamoDB | username → userId is a **point read**. This is what makes `@mentions` cheap |
| **AP10**: GSI1 by `MILESTONE#<id>` | live | "which timelines reference this?" — needed for safe shared-entity edits |
| Member/invite key shapes | `DATA_MODEL.md` §Deferred | `SK=MEMBER#<userId>`, `SK=INVITE#<id>` pre-committed |
| Single authz choke point | `modules/*/service.ts` | Every write funnels through `getOwnTimeline()` — one place to widen |

**The single biggest structural blocker**: `infra/lib/api-stack.ts` routes
**every** path through one `/{proxy+}` route with the Cognito JWT authorizer
attached. There is currently *no* way to reach the API without a valid token.
Public sharing is therefore an infrastructure change, not just app code.

---

## 1. Public sharing via link

### Data model

Add one lookup item, mirroring the existing username-claim pattern:

| Item | PK | SK | Attributes |
|---|---|---|---|
| Share token claim | `SHARE#<token>` | `CLAIM` | `timelineId` |

New access pattern **AP11**: resolve a share token → timelineId (`GetItem`).

`Timeline` gains `shareToken?: string` (minted when visibility leaves PRIVATE).

**Why a token instead of the timeline ULID in the URL**: ULIDs are
timestamp-prefixed and not secret. A separate random token can be **rotated to
revoke a leaked link** without breaking the timeline's identity or any existing
reference to it. Cost is one extra item and one extra point read.

### Schema change

`createTimelineSchema.visibility` is currently `z.literal('PRIVATE')`. It becomes
the full enum, with `SHARED` treated as *derived* (it has members) rather than
directly settable — so the user-settable set is `PRIVATE | UNLISTED | PUBLIC`.

### API Gateway (the infrastructure change)

A **second route without the authorizer**, on a distinct prefix so the auth
boundary is unambiguous by inspection:

```
/{proxy+}         → JWT authorizer   (everything today)
/public/{proxy+}  → NO authorizer    (new, read-only)
```

Distinct prefix matters: it means "is this endpoint public?" is answerable from
the path alone, in CDK and in the router, rather than from per-handler logic.

### Endpoints (all unauthenticated, all read-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/public/timelines/{shareToken}` | 404 unless `visibility !== 'PRIVATE'` |
| GET | `/public/timelines/{shareToken}/content` | Canvas payload |
| POST | `/public/timelines/{shareToken}/media-urls` | Presigned GETs, **allowlisted to that timeline's own keys** |

### Security rules (non-negotiable)

1. **Public handlers must never call `getUserId()`.** They take a token, not an
   identity. A separate `getPublicTimeline(token)` service function re-checks
   `visibility !== 'PRIVATE'` on **every** request — visibility is not cached
   into the token.
2. **Response shaping**: strip `ownerId` and any user PII. Public payloads carry
   presentation data only. This is a deliberate DTO, not the raw item.
3. **S3 media is the sharp edge.** Today `presignViewUrls` calls
   `assertOwnsKey(userId, key)` — that check cannot apply anonymously. The public
   variant must resolve the timeline's blocks, build the set of keys *actually
   referenced by that timeline*, and presign **only** keys in that set. Never
   presign a caller-supplied key on a public route.
4. **Revocation**: rotating `shareToken` deletes the old `SHARE#` item, so old
   links 404 immediately. Setting visibility back to PRIVATE does the same.
5. **Throttling**: public routes are the first unauthenticated surface in the
   app and therefore the main abuse/cost vector. They need their **own, lower**
   stage throttle, separate from the authenticated 20 rps.

### UI

- Visibility control in the timeline settings (today `CreateTimelineDialog`
  hardcodes PRIVATE with a "coming soon" hint — that hint gets replaced).
- Share dialog: copy link, show current visibility, revoke/rotate.
- New public route `/p/:shareToken` rendering the existing canvas **read-only**:
  no toolbar add-buttons, no edit affordances, no profile chrome.
- The canvas components already take data as props, so the read-only variant is
  mostly prop-gating rather than new rendering code.

### Cost

Unauthenticated GETs on Lambda + API Gateway + S3 egress. At personal scale this
stays inside free tier, but it is **the first endpoint a stranger can call**, so
the throttle above is the actual safeguard. This is the strongest argument for
putting CloudFront in front of public reads later (it caches and absorbs bursts).

---

## 2. Collaborators and roles

### Data model

| Item | PK | SK | GSI1PK | GSI1SK | Attributes |
|---|---|---|---|---|---|
| Member | `TIMELINE#<tid>` | `MEMBER#<userId>` | `USER#<userId>` | `TIMELINE#<tid>` | `role`, `addedAt`, `addedBy` |
| Invitation | `TIMELINE#<tid>` | `INVITE#<inviteId>` | `USER#<inviteeId>` | `INVITE#<inviteId>` | `role`, `status`, `invitedBy`, `expiresAt` |

Both shapes were pre-committed in `DATA_MODEL.md`. Note the member item's GSI1
entry gives **"timelines this user can access"** in one query — the reverse
lookup AP3 needs to become.

**AP3 changes**: listing a user's timelines becomes *owned ∪ member-of*. The GSI1
partition `USER#<id>` already holds owned `TIMELINE#` metas; member items land in
the same partition, so one query returns both — then a `BatchGetItem` resolves
the member-referenced timeline metas. One extra round trip, no new index.

### Permission matrix

| Capability | OWNER | EDITOR | VIEWER |
|---|:--:|:--:|:--:|
| View timeline + content | ✅ | ✅ | ✅ |
| Create milestones/stages **on this timeline** | ✅ | ✅ | ❌ |
| Link / unlink existing items | ✅ | ✅ | ❌ |
| Per-timeline presentation (color, order, highlight) | ✅ | ✅ | ❌ |
| Edit timeline meta (title, dates, unit, ruler) | ✅ | ✅ | ❌ |
| Edit **shared** milestone/stage content | ⚠️ see below | ⚠️ | ❌ |
| Change visibility / manage share links | ✅ | ❌ | ❌ |
| Invite, remove, or re-role members | ✅ | ❌ | ❌ |
| Delete timeline | ✅ | ❌ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |

### ⚠️ The hard problem: shared entities vs. timeline-scoped permission

This is the one genuinely difficult design question, and it comes straight from
a founding product principle: **Milestones and Stages are independent entities
owned by a user and reusable across timelines** — they are *not* owned by a
timeline. Today `updateOwnMilestone(ownerId, id)` requires the caller to own the
**milestone itself**.

So: if Ana is an EDITOR on my timeline, and that timeline links a milestone I own
which *also* appears in two of my private timelines — may Ana edit its text?

If yes, Ana silently changes content inside timelines she cannot see. That is a
real integrity and privacy leak, not a hypothetical.

### ✋ Resolved (user decision, 2026-08-19): explicit two-scope membership

Rather than *inferring* whether an editor may touch a shared entity, permission
is **granted explicitly at one of two scopes**:

- **Milestone-scoped collaborator** → edit rights on *that milestone only*.
- **Timeline-scoped collaborator** → edit rights across the whole timeline:
  its meta, its stages, and the milestones linked to it.

This resolves the ambiguity by making the grant intentional instead of derived.
The cross-timeline exposure noted above is then handled by **informed consent**,
not by restriction: before an invitation is sent, the UI must state the scope
plainly — and, when inviting at timeline scope, must disclose **how many of that
timeline's milestones also appear in other timelines** (computable via AP10), so
the owner knows exactly what they are widening access to.

Both scopes were pre-committed: DATA_MODEL.md's deferred patterns read
"timeline/**milestone** members", and PRODUCT.md's backlog lists milestone
sharing and timeline sharing as separate items.

### Authorization refactor

`API.md` already predicted this: *"When membership arrives, the ownership check
widens to a role check in one place per module (service layer) — routes and
repositories don't change."* That holds.

```
getOwnTimeline(userId, id)              →  requireTimelineRole(userId, id, minRole)
```

Resolution order: owner → member role → (public? VIEWER for reads) → 404.
Everything else in `content-service.ts` and the module services calls through it,
so the blast radius is one function plus its callers' role arguments.

**404, never 403**, stays the rule — no existence leaks (already SECURITY.md).

### Endpoints

| Method | Path | Who |
|---|---|---|
| GET | `/timelines/{id}/members` | any member |
| POST | `/timelines/{id}/invitations` | OWNER |
| DELETE | `/timelines/{id}/members/{userId}` | OWNER (or self, to leave) |
| PATCH | `/timelines/{id}/members/{userId}` | OWNER |
| GET | `/invitations` | invitee (own pending) |
| POST | `/invitations/{id}/accept` \| `/decline` | invitee |

### Security rules

1. **Never trust a client-supplied userId.** Invitations are issued by
   *username*, resolved server-side through AP2.
2. **No privilege escalation**: the granted role must be ≤ the granter's. Only an
   OWNER can grant OWNER.
3. **Never remove the last OWNER** — enforce on delete and on re-role.
4. Invitations **expire** (`expiresAt`) and are single-use; accepting writes the
   member item and marks the invite consumed in **one transaction**.
5. Accepting an invitation is the *only* way to gain membership — membership is
   never inferred from having been mentioned or from holding a public link.

---

## 3. `@username` mentions

### Data model

Mentions are **resolved and stored structurally at write time**, not parsed out
of text at render:

```ts
Milestone.mentions?: { userId: string; username: string }[]
```

Rationale: parsing `@foo` at render would need a username→user lookup per render
and would silently break if text is edited elsewhere. Resolving on write gives a
stable `userId` — which is exactly what a notification consumer needs. Storing
the `username` alongside is safe because **usernames are immutable** in this app
(the profile page states this).

The TEXT block keeps its raw text containing `@username`; the UI linkifies against
the `mentions` array. No rich-text AST — that would be a much larger change for
no benefit here.

### Notification-readiness (design only, do not build yet)

The point of storing `{ userId }` at write time is that a future notification
layer needs no schema migration. When it's wanted:

```
PK=USER#<userId>  SK=NOTIF#<ulid>   { type: 'MENTION', timelineId, milestoneId, actorId, readAt? }
```

fanned out by a DynamoDB Stream → Lambda on milestone writes. **Not now**: it
adds a stream, a consumer, and (for email) SES. The current design simply doesn't
foreclose it.

### Endpoint

`GET /users/search?q=<prefix>` — for the autocomplete. This is the one endpoint
here that **exposes the user directory**, so it needs deliberate limits:

- authenticated only
- **prefix match, minimum 2 characters** (no listing, no empty query)
- hard result cap (≈5)
- returns `username` + `displayName` **only** — never email, never userId of
  non-matches

### Security rules

1. **A mention grants no access.** Being mentioned must never widen permissions —
   otherwise mentioning becomes a privilege-escalation primitive.
2. Consequently the UI should **warn when mentioning someone who can't see the
   timeline**, and offer to invite them instead. A notification linking to a
   403/404 is a bad experience and a subtle information leak (it reveals the
   milestone exists).
3. Mentions are re-resolved on every save; unknown usernames are stored as plain
   text, never as a mention record.

---

## 4. Cross-cutting: what this costs

No new AWS **services** are strictly required for features 1–3 — DynamoDB,
Lambda and API Gateway already cover them. Two things would change that:

- **Email invitations to people without an account** → SES (new service, new
  cost, needs a COST NOTICE). Avoidable by requiring the invitee to register
  first (in-app invitations only).
- **Email/push notifications for mentions** → SES + a stream consumer. Explicitly
  out of scope above.

The real cost delta is the **unauthenticated public surface**: it is the first
part of the system a stranger can invoke, so its throttle is a cost control, not
just a security control.

---

## 5. Suggested build order

Each step is independently shippable and independently verifiable:

1. **Roles/membership** — refactor `getOwnTimeline` → `requireTimelineRole` while
   there is still only one caller shape to migrate. Everything else builds on it.
2. **Public links** — needs the infra change; the role work above already
   introduces "read access that isn't ownership", which public read then reuses.
3. **Mentions** — smallest, and genuinely independent of the other two.

Doing public links before roles would mean writing the read-authorization path
twice.

---

## 6. Open decisions (need a call before implementation)

## 7. What shipped vs. this design

Built as designed, with these notes:

- **A real leak was found while testing the public path.** `batchGetMilestones`/
  `batchGetStages` returned raw DynamoDB items, so `GSI1PK` (`USER#<ownerId>`)
  and the internal keys rode along into every content response. On the
  authenticated path that only reached people who already had access; the public
  endpoint would have handed an anonymous visitor the owner's identifier. Keys
  are now stripped at the data layer, and public media is addressed by **block
  id** instead of object key (the key path embeds the owner id too). Covered by
  a regression test asserting the owner's subject appears nowhere in the payload.
- **Public throttling needed two CDK escape hatches**: per-route settings must
  use raw CloudFormation property names (CDK does not rename inside a map of
  complex types), and the stage needs an explicit dependency on the routes it
  references or the update fails with a 404.
- **User search needed a new index shape.** Prefix search is impossible on a
  partition key and scans are forbidden by the project rules, so username claims
  now carry `GSI1PK='USERNAME'` + `GSI1SK=<username>`. One hot partition, fine
  at this size; shard the key if it ever isn't. Pre-existing claims were
  backfilled.
- **Not built** (deliberate): notifications of any kind — the mention data shape
  supports them (§3) but no stream, consumer or delivery exists; mention
  *autocomplete* (the `/users/search` endpoint is live and the invite field uses
  it, but the milestone editor asks you to type the handle); accepting an
  invitation from a public link.

## 8. Resolved decisions

All resolved by the user on 2026-08-19:

| # | Decision | Resolution |
|---|---|---|
| D1 | Shared-entity edit rule | ✋ **Explicit two-scope membership** (milestone-scoped or timeline-scoped), with a scope warning before every invite — see §2 |
| D2 | Invitations reach people how? | ✋ **In-app only** — invitee must already have an account. No SES, no new service, no new cost |
| D3 | `/users/search` scope | ✋ **Anyone**, authenticated, prefix ≥2 chars, capped ~5, returns username + displayName only |
| D4 | Public timelines serve media? | ✋ **Yes**, under the key-allowlist rule in §1 |
