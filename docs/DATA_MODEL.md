# Timeline — Data Model

## Temporal model

```ts
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR' | 'APPROXIMATE';

interface PartialDate {
  date: string;          // Date format: "DD/MM/YYYY", e.g. "28/10/2022" (user-confirmed standard)
  precision: DatePrecision;
}
```

- `date` is always a complete calendar date in `DD/MM/YYYY` format and serves as the **canonical anchor** for sorting and canvas placement. For imprecise values the anchor is the period start (`2022` → `01/01/2022`, `Q4 2022` → `01/10/2022`); `APPROXIMATE` anchors to whatever date the user picked.
- `precision` drives display formatting and any "fuzzy" visual treatment. Comparison/sorting always uses the anchor.
- **`DD/MM/YYYY` does not sort lexicographically** — raw string comparison of `date` values is forbidden everywhere. All comparison/sorting goes through the shared PartialDate utilities in `packages/shared` (parse → comparable ordinal). No DynamoDB key contains a date, so the table design is unaffected; if the future temporal-range GSI is ever built, it derives a sortable numeric attribute (e.g. `yyyymmdd`) at write time.
- System timestamps (`createdAt`, `updatedAt`) are machine metadata, not domain dates — they remain ISO 8601 datetimes.
- Quarters are derived from the anchor month — no separate quarter field, so invalid combinations are unrepresentable.

## Entities (MVP attributes)

- **User**: id (Cognito sub), username, displayName, bio?, location?, website?, locale (`en`|`es`), createdAt.
- **Timeline**: id, ownerId, title, description?, start: PartialDate, end?: PartialDate, ongoing: boolean, unit (`DAYS|MONTHS|QUARTERS|YEARS`), rulerVisible: boolean, visibility (`PRIVATE|SHARED|UNLISTED|PUBLIC`, MVP enforces PRIVATE), createdAt, updatedAt.
- **Milestone**: id, ownerId, title, shortLabel?: string (compact canvas display name, falls back to `title` — DECISIONS #53), date: PartialDate, blocks: ContentBlock[], createdAt, updatedAt.
- **Stage**: id, ownerId, title, shortLabel?: string (same fallback as Milestone), description?, start: PartialDate, end?: PartialDate, ongoing: boolean, blocks?: ContentBlock[], createdAt, updatedAt. (`blocks` is optional because Stages predate it — stages stored before DECISIONS #39 have none and stay valid.)
- **TimelineMilestone** (link): timelineId, milestoneId, displayOrder, isHighlighted, isHidden, color?, addedAt.
- **TimelineStage** (link): timelineId, stageId, displayStyle?, isHighlighted, color?, addedAt. (`lane` is computed at render time — see DECISIONS #10.)

`color` is an `EntityColor` palette **name** (`DEFAULT | AMBER | ROSE | VIOLET | TEAL | GREEN | SLATE`), never a raw hex value — stored data may only reference a design token (DECISIONS #31). It lives on the link, not the shared entity, because color is presentation: the same Milestone may read differently in two timelines.

```ts
type ContentBlock = TextBlock | YouTubeBlock | ImageBlock | FileBlock | SetlistBlock;

interface TextBlock    { id; order; type: 'TEXT';    text: string }
interface YouTubeBlock { id; order; type: 'YOUTUBE'; youtubeId: string; caption?: string }
interface ImageBlock   { id; order; type: 'IMAGE';   s3Key; fileName; contentType: ImageMimeType; size; caption? }
interface FileBlock    { id; order; type: 'FILE';    s3Key; fileName; contentType: FileMimeType;  size }
interface SetlistBlock { id; order; type: 'SETLIST'; setlistId: string; caption? }
// future: AUDIO | RECORDED_AUDIO | LINK join the union
```

Blocks stay embedded in the Milestone or Stage item: media blocks store only an **object key**, never bytes, so items remain far below the 400 KB limit even with many attachments. Two caps keep that true — at most `BLOCKS_MAX` (100) blocks, and at most `BLOCKS_BYTES_MAX` (350 KB) of serialized block data, both enforced by `blocksSchema` at the boundary so an over-large entry fails validation rather than the write. (The pre-committed migration to `MILESTONE#<id> / BLOCK#<order>` items is therefore still unnecessary — revisit only if entries routinely approach the byte cap.)

`YouTubeBlock` stores the bare 11-char video id, never a pasted URL; the embed src is rebuilt from it at render time. `ImageBlock`/`FileBlock` store only the S3 key; every view mints a short-lived presigned URL (see SECURITY.md).

IDs are **ULIDs** — lexicographically sortable by creation time, which makes them usable directly in sort keys.

## Access patterns (MVP)

| # | Pattern | Mechanism |
|---|---|---|
| AP1 | Get user profile by userId | `GetItem PK=USER#<id> SK=PROFILE` |
| AP2 | Find user by username (uniqueness + future public URLs) | `GetItem PK=USERNAME#<lower> SK=CLAIM` (conditional put on registration) |
| AP3 | List Timelines owned by a user | GSI1: `GSI1PK=USER#<id>, begins_with(GSI1SK, 'TIMELINE#')` |
| AP4 | Get one Timeline | `GetItem PK=TIMELINE#<id> SK=META` |
| AP5 | Get everything a Timeline references (meta + milestone refs + stage refs) | `Query PK=TIMELINE#<id>` → one query returns META + `MILESTONE#*` + `STAGE#*` items |
| AP6 | Resolve referenced Milestone/Stage bodies | `BatchGetItem` on the ids from AP5 |
| AP7 | Get one Milestone / one Stage | `GetItem PK=MILESTONE#<id>` / `PK=STAGE#<id>`, `SK=META` |
| AP8 | List Milestones owned by a user (picker for "add existing") | GSI1: `GSI1PK=USER#<id>, begins_with(GSI1SK, 'MILESTONE#')` |
| AP9 | List Stages owned by a user | GSI1: `GSI1PK=USER#<id>, begins_with(GSI1SK, 'STAGE#')` |
| AP10 | Which Timelines reference this Milestone/Stage? (deletion integrity, future sharing UX) | GSI1: `GSI1PK=MILESTONE#<id>` (or `STAGE#<id>`) → link items |

Deferred patterns already accommodated by the design (documented, not built): timeline/milestone members (`SK=MEMBER#<userId>` + GSI1 reverse for "timelines accessible by user"), invitations (`SK=INVITE#<id>`, GSI1 by invitee), temporal-range queries (future GSI with date-anchored sort key if timelines outgrow load-all).

## Table design

Single table **`timeline-main`**, on-demand billing, plus one GSI.

| Item | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| User profile | `USER#<userId>` | `PROFILE` | — | — |
| Username claim | `USERNAME#<lower>` | `CLAIM` | — | — |
| Timeline meta | `TIMELINE#<tid>` | `META` | `USER#<ownerId>` | `TIMELINE#<tid>` |
| TimelineMilestone | `TIMELINE#<tid>` | `MILESTONE#<mid>` | `MILESTONE#<mid>` | `TIMELINE#<tid>` |
| TimelineStage | `TIMELINE#<tid>` | `STAGE#<sid>` | `STAGE#<sid>` | `TIMELINE#<tid>` |
| Milestone | `MILESTONE#<mid>` | `META` | `USER#<ownerId>` | `MILESTONE#<mid>` |
| Stage | `STAGE#<sid>` | `META` | `USER#<ownerId>` | `STAGE#<sid>` |

Why single-table (see DECISIONS #6): every hot pattern is either a point read, a one-partition item collection (AP5 is the critical one — a whole canvas in a single query), or a single GSI query. Multiple tables would force N queries or duplicated indexes for the same shapes and would complicate future membership items, while providing no isolation benefit at this scale.

## Integrity rules

- **Delete Milestone/Stage** (owner only): query GSI1 for its link items (AP10), then delete META + all links in `TransactWriteItems` batches (≤100 items per transaction; paginate if ever needed).
- **Delete Timeline**: query `PK=TIMELINE#<id>` (AP5), delete META + link items. Referenced Milestones/Stages are never touched.
- **Link creation**: `TransactWriteItems` with a condition that both the Timeline META and the Milestone/Stage META exist and are owned by the caller (MVP).
- **Username registration**: transactional conditional put of the claim item + profile item.
- **Canvas load** (AP5+AP6): responses are paginated defensively (`limit` + cursor), though MVP timelines are expected to fit one page.
