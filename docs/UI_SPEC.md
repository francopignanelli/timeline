# Timeline — UI Specification (MVP)

All screens: bilingual (en/es), responsive, keyboard-accessible, with loading/empty/error states. Header on authenticated pages: `[T→] Timeline` left, language switcher + user menu (avatar initials → profile, logout) right; light and spacious.

## Auth screens (`/login`, `/register`, `/verify`, `/forgot-password`)

- Centered compact form under the primary logo; generous whitespace; no marketing clutter.
- Register: email, password, username (immutable later, validated live), display name. → verification code screen.
- Errors are specific, localized, restrained ("That email is already registered"), never raw Cognito codes.

## Dashboard (`/dashboard`)

- Personal greeting (localized, time-of-day aware), then "Your timelines" as an editorial list: serif title + mono temporal range (`2016 → Present`) per row, thin separator lines, visibility label when not private-default. `+ New Timeline` as a quiet primary action.
- Empty state: dot–line–arrow motif + invitation to create the first timeline.
- Create/edit timeline dialog: title, description, start (PartialDate picker), end / "Ongoing" toggle, unit, ruler visibility. Visibility shown as PRIVATE (others listed but disabled with "coming soon" hint).

### PartialDate picker (shared component)

Precision selector (Day / Month / Quarter / Year / Approximate) that adapts the input: full date picker, month+year, quarter+year, year, or year±"around". Displays formatted per locale (e.g. `OCT 28 2022`, `Q4 2022`, `~2013`).

## Timeline canvas (`/timeline/:id`)

- Full-viewport canvas below the header; timeline axis horizontal, past → future.
- **Pan**: drag on empty canvas, horizontal wheel/trackpad, arrow keys. **Zoom**: ctrl/cmd + wheel, pinch, `+`/`-` keys, zoom controls; anchored at cursor. **Fit**: button + `0` key fits the timeline's range with padding.
- Ruler (toggleable per timeline setting): adaptive density — years → quarters → months → days as zoom increases; labels thin out before overlapping (no label soup at far zoom).
- Vertical layout (DECISIONS #17): the axis position adapts to content — lower when stages need the below zone (which then belongs exclusively to stage lanes), centered otherwise with milestone levels alternating above/below for balance. Ruler labels sit directly below the axis line; below-axis connectors skip that band. Stages render as lane-assigned bands (lanes computed live; closest lane to the axis preferred). Milestones render as `●` + connector + label; **text overlap is forbidden** — milestones whose *measured label footprints* would overlap at the current zoom are lifted to the lowest free level (greedy, lane-style), each connector preserving its true temporal position. Levels are capped by available height with edge padding; when a label can't fit anywhere the milestone renders as a dot-only marker (existence stays visible; title in tooltip and accessible name). Labels carry an opaque canvas-colored background and all connectors render beneath all labels, so a connector can never strike through text. The first visible ruler tick always carries its full label so the viewport never loses its year anchor.
- Ongoing timelines/stages fade toward a "now" marker rather than hard-stopping.
- Canvas toolbar (quiet, top-right of canvas): add milestone, add stage, fit, zoom, ruler toggle.
- Add milestone/stage: dialog with "New" and "From my milestones/stages" (picker listing existing items) — reuse is first-class.
- Empty timeline: axis + arrow rendered with a centered hint to add the first milestone.

## Milestone modal (`/timeline/:id?milestone=<id>`)

- Opens over the canvas; canvas stays perceptible, de-emphasized (subtle overlay, optional light blur); URL-driven so refresh/back restore it; Esc / outside click closes.
- Content-first: serif title, mono date (precision-aware), then TEXT blocks with editorial typography. Edit controls stay secondary (single "Edit" affordance for the owner) until invoked.
- Edit mode: title, PartialDate picker, add/edit/remove/reorder TEXT blocks.
- Footer metadata: "Appears in N timelines" (from AP10) — grounds the shared-milestone mental model early.
- Delete (in edit mode, destructive-styled): confirms with the list of timelines that reference it.

## Stage interaction

Click a stage band → compact popover (title, range, description) with Edit → dialog like the milestone editor (start/end/ongoing). Unlink vs delete are separate, clearly labeled actions (deletion warns about other referencing timelines).

## Profile (`/profile`)

Display name, bio, location, website, language preference; username shown immutable; avatar = initials (uploads deferred).

## Responsive behavior

- **Desktop**: full experience as above.
- **Tablet**: same canvas; touch pan/pinch primary; toolbar slightly larger targets.
- **Mobile**: canvas remains horizontal pan/pinch but simplified — milestone labels collapse to dots + tap targets, milestone modal becomes full-screen sheet, creation flows full-screen; dashboard/profile stack naturally. Reading and exploring are first-class on mobile; heavy editing is desktop-optimized, not blocked.

## States checklist (every screen)

Loading (skeletons using line/dot motif, no spinners-everywhere), empty (motif + one clear action), error (localized message + retry), plus optimistic updates only where rollback is trivial (presentation toggles).
