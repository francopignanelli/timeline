# Timeline — Product Definition

## Vision

Timeline is an interactive temporal canvas for organizing and exploring history — personal, collaborative, or public. Users create visual timelines (concerts, career, education, travels, a company's history) composed of reusable Milestones (points in time) and Stages (periods). It should feel like a calm, editorial, spatial canvas — not a calendar, spreadsheet, or SaaS dashboard.

## Terminology

| Term | Meaning |
|---|---|
| **Timeline** | A visual temporal space that organizes references to Milestones and Stages. Owns presentation, not content. |
| **Milestone** | A point in time (never a duration) with rich block-based content. Independent entity; may appear in many Timelines. |
| **Stage** | A period of time with a start and an end (or ongoing). Independent entity; may appear in many Timelines. |
| **TimelineMilestone** | Link between a Timeline and a Milestone, carrying per-Timeline presentation metadata. |
| **TimelineStage** | Link between a Timeline and a Stage, carrying per-Timeline presentation metadata. |
| **PartialDate** | A date plus explicit precision: `DAY`, `MONTH`, `QUARTER`, `YEAR`, `APPROXIMATE`. |
| **Visibility** | `PRIVATE`, `SHARED`, `UNLISTED`, `PUBLIC` (Timeline-level). |
| **Role** | `OWNER`, `EDITOR`, `VIEWER` (membership on Timelines and Milestones). |

## MVP Scope (confirmed with user, 2026-08-19)

Single-user core:

- Authentication: register, login, logout, email verification, password recovery (Cognito).
- User profile: display name, username, bio, optional location/website, locale preference. (Avatar deferred — requires uploads.)
- Dashboard: list own Timelines, create, open, see visibility state.
- Timeline CRUD: title, description, start (PartialDate), optional end / ongoing, time unit (days/months/quarters/years), ruler visibility, visibility field (PRIVATE enforced).
- Timeline canvas: horizontal past→future, pan, zoom, fit-to-view, adaptive ruler.
- Milestones: CRUD with title, PartialDate, ordered content blocks — **TEXT blocks only in MVP** (block model supports future types). Reusable: one Milestone can be linked into multiple of the owner's Timelines.
- Stages: CRUD with title, start/end PartialDates, ongoing state. Automatic lane layout for overlaps. Linkable into multiple own Timelines.
- Milestone detail modal reflected in URL (`?milestone=...`), survives refresh.
- Bilingual UI (English + Spanish) with locale detection and per-user preference.

## Explicitly deferred (specified, extensible, not built)

- Media uploads (images/video/audio/files) and S3 — block model already supports them.
- Cover images, avatars.
- Sharing and collaboration: Timeline/Milestone membership, roles, invitations (PENDING/ACCEPTED/REJECTED), mentions (`@username`), "add shared milestone to my timeline" flow.
- SHARED / UNLISTED / PUBLIC visibility behavior and public read-only pages (`/u/{username}/{slug}`).
- Milestone duplication.
- Cross-user Stage sharing.
- External integrations (Setlist.fm, Spotify, …) — generic `ExternalIntegration` model documented, not built.
- Social login (Google/Apple) — Cognito architecture stays compatible.
- Custom domain, CloudFront, production environment.
- All AI features (disabled by default, require explicit approval).

## Behavior specifications

### Timeline

- A user may create many Timelines; each shows title, description, temporal range, unit, ruler toggle.
- Start is required (PartialDate); end is optional; `ongoing = true` means the timeline extends to "now" visually.
- Deleting a Timeline deletes its link entities only — never the Milestones/Stages it references.

### Milestone

- Always a point. Precision affects display (e.g. `OCT 28 2022` vs `2022` vs `~2013`) and canvas placement (placed at a canonical anchor date; see DATA_MODEL).
- Content is an ordered list of blocks. MVP: TEXT. Future: IMAGE, VIDEO, AUDIO, RECORDED_AUDIO, FILE, LINK. Blocks are reorderable (model supports it; UI may land after MVP).
- Editing a Milestone changes it everywhere it is referenced.
- Deleting a Milestone removes it and all Timeline references to it (owner-only; confirm in UI).
- Unlinking from a Timeline never deletes the Milestone.

### Stage

- Has start and end PartialDates; `ongoing = true` replaces the end.
- Overlapping Stages are placed in automatically computed lanes (closest available lane to the axis). Lanes are computed at render time, not stored.
- Same reuse/unlink/delete semantics as Milestones.

### Privacy model

- Timelines: PRIVATE by default. MVP enforces PRIVATE (owner-only access) at the backend; the visibility field exists and validates all four values so later phases don't migrate data.
- Milestones/Stages: accessible to their owner only in MVP. The membership model (OWNER/EDITOR/VIEWER) is documented in SECURITY.md and DATA_MODEL.md for later phases.

### Collaboration & permission model (deferred, designed)

- Timeline membership: OWNER (settings, members, visibility, content, delete), EDITOR (content create/edit/delete), VIEWER (read).
- Milestone membership: OWNER (edit, members, delete, share), EDITOR (edit content), VIEWER (read).
- Mentions are associations, never permissions.
- Invitations: PENDING → ACCEPTED/REJECTED, per-invite role.
- Backend enforces every rule; frontend only reflects them.

## Language / i18n

- UI languages: English (`en`) and Spanish (`es`) from the start, via i18n resources.
- Default: browser language if supported, else `en`; user can switch; preference stored on profile.
- Dates, numbers, and temporal labels use `Intl` APIs with the active locale.
