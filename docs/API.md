# Timeline — REST API (MVP)

## Conventions

- Base: API Gateway HTTP API, JSON only. All routes require a valid Cognito JWT (authorizer) — there are no public endpoints in MVP.
- Identity always comes from JWT claims; request bodies never carry the caller's userId.
- Validation: shared zod schemas from `packages/shared` (same schemas the frontend uses).
- Errors: `{ "error": { "code": "STRING_CODE", "message": "human readable (en)" } }` with 400 (validation), 401 (no/invalid token), 403 (not authorized), 404 (not found *or* not visible — no existence leaks), 409 (conflict, e.g. username taken), 500 (opaque; details only in logs). Frontend maps `code` → localized message.
- Pagination: `?limit=` + opaque `cursor` (base64 `LastEvaluatedKey`); responses include `nextCursor` when more items exist. MVP list sizes are expected to fit one page; the contract exists so it never has to be retrofitted.
- All PartialDate fields are `{ date: "DD/MM/YYYY", precision: "DAY|MONTH|QUARTER|YEAR|APPROXIMATE" }` — format and real-calendar validity (leap years, month lengths) enforced by the shared zod schema.

## Endpoints

### Users

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Profile of the authenticated user (creates it on first call after signup if missing). |
| PUT | `/me` | Update displayName, bio, location, website, locale. Username is set once at registration (409 on conflict). |

### Timelines

| Method | Path | Description |
|---|---|---|
| GET | `/timelines` | List own timelines (AP3). |
| POST | `/timelines` | Create. Body: title, description?, start, end?, ongoing, unit, rulerVisible, visibility (MVP: only `PRIVATE` accepted). |
| GET | `/timelines/{timelineId}` | Timeline meta (owner only). |
| PATCH | `/timelines/{timelineId}` | Partial update of meta fields. |
| DELETE | `/timelines/{timelineId}` | Deletes meta + link items only; never referenced Milestones/Stages. |
| GET | `/timelines/{timelineId}/content` | Canvas payload: `{ timeline, milestones: [{ ref, milestone }], stages: [{ ref, stage }] }` (AP5 + AP6). `ref` carries the per-timeline presentation metadata. |

### Milestones

| Method | Path | Description |
|---|---|---|
| GET | `/milestones` | List own milestones (AP8) — the "add existing" picker. |
| POST | `/milestones` | Create. Body: title, date, blocks (TEXT only in MVP). |
| GET | `/milestones/{milestoneId}` | Fetch one (owner only). |
| PATCH | `/milestones/{milestoneId}` | Update title, date, blocks. |
| DELETE | `/milestones/{milestoneId}` | Deletes milestone + **all** its timeline links (AP10, transactional). UI must confirm. |

### Timeline↔Milestone links

| Method | Path | Description |
|---|---|---|
| POST | `/timelines/{timelineId}/milestones` | Link. Body: `{ milestoneId }` to link existing, **or** `{ milestone: {...} }` to create-and-link atomically. 409 if already linked. |
| PATCH | `/timelines/{timelineId}/milestones/{milestoneId}` | Update presentation: displayOrder, isHighlighted, isHidden. |
| DELETE | `/timelines/{timelineId}/milestones/{milestoneId}` | Unlink only — milestone untouched. |

### Stages & Timeline↔Stage links

Identical shape to milestones: `/stages`, `/stages/{stageId}`, `/timelines/{timelineId}/stages`, `/timelines/{timelineId}/stages/{stageId}`. Stage body: title, description?, start, end?, ongoing. Link presentation: displayStyle?, isHighlighted.

## Authorization rules (MVP)

Every handler resolves the resource, then requires `resource.ownerId === jwt.sub` before proceeding (403/404 semantics above). Link operations require ownership of **both** ends. When membership arrives, the ownership check widens to a role check in one place per module (service layer) — routes and repositories don't change.
