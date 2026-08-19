# Timeline — Design System

Direction: warm minimalism, editorial elegance, generous whitespace, restrained UI, distinctive blue accent. The Timeline graphic vocabulary (horizontal lines, points, arrows, bands) *is* the visual identity — no decorative illustration. Inspired by Anthropic's restraint, never its layouts, assets, or terracotta accent.

## Tokens

Implemented as CSS variables in `apps/web/src/styles/tokens.css`, mapped into Tailwind v4 `@theme`. No hardcoded visual values in components.

### Color

```css
--bg: #FAF9F5;            /* app + canvas background */
--surface: #F5F0E8;
--surface-elevated: #FFFFFF;

--text: #141413;
--text-secondary: #3D3D3A;
--text-muted: #6C6A64;

--border: #E6DFD8;
--timeline-line: #D8D3CB;

--accent: #315CF5;
--accent-hover: #2448C9;

--danger: #B42318;   /* validation errors, destructive actions only */

--dark: #181715;
--dark-elevated: #252320;
--text-on-dark: #FAF9F5;
```

Accent (#315CF5) is reserved for: primary actions, selected/active Milestones, links, focus rings, meaningful brand details. Neutral Milestones/Stages stay quiet. Never use accent as a background wash.

### Typography

| Family | Use |
|---|---|
| **Inter** | UI: navigation, buttons, forms, labels, dialogs |
| **Source Serif 4** | Editorial: major titles, Timeline titles, public pages |
| **JetBrains Mono** | Sparingly: dates, ruler labels, temporal metadata |

Scale (rem-based, responsive at breakpoints):

```
Display 64/400 · H1 48/400 · H2 36/400 · H3 28/500
Body-lg 20/400 · Body 16/400 · Small 14/400 · Caption 12/500 · Button 14/500
```

Hierarchy via size/spacing/position, not bold. Fonts self-hosted via `@fontsource` packages (no external font CDN requests).

### Spacing, radii, borders, z-index, motion, breakpoints

```
Spacing: 4 8 12 16 24 32 48 64 96
Radii:   sm 6 · md 8 (buttons/inputs) · lg 12 (cards/dialogs)
Borders: 1px solid var(--border); shadows minimal or none
Z-index: canvas 0 · canvas-overlays 10 · header 20 · dropdown 30 · dialog 40 · toast 50
Motion:  fast 120ms · base 200ms · slow 300ms, ease-out; all motion respects prefers-reduced-motion
Breakpoints: sm 640 · md 768 · lg 1024 · xl 1280
```

## Logo

Concept: a horizontal timeline shaft that reads as the bar of a **T**, with a small arrowhead on the right and a matching tail chevron on the left — `≻────≻` — and the stem centered beneath, so the mark is symmetric in visual weight while staying unmistakably directional (user-refined 2026-08-19). Flat, monochrome-capable, no gradients, recognizable at 16 px (favicon).

- **Primary**: symbol + wordmark "Timeline" (Inter, never abbreviated) — header, auth screens, public pages.
- **Symbol only**: favicon, app icon, compact/mobile navigation, loading states.
- **Monochrome**: `--text` on light, `--text-on-dark` on dark, where accent is unsuitable.

Built as inline SVG components (`<LogoMark/>`, `<LogoFull/>`). The head and tail chevrons stay small and slightly thinner than the shaft/stem so they read as subtle direction markers, not a heavy double arrow.

## Components (build only when repetition demands)

Planned primitives: Button (primary/secondary/tertiary; h-40–44, px-16, radius 8, text 14/500), IconButton, Input, Textarea, Select, Dialog (accessible: focus trap, Esc, aria-modal), Dropdown/Menu, Tooltip, Avatar (initials until uploads exist), EmptyState, LoadingState, LanguageSwitcher.

Cards: radius 12, padding 20–24, 1px border, shadow none/minimal — used only where grouping genuinely helps; never wrap everything.

## Canvas visual language

- Axis/ruler: thin marks, `--timeline-line`, muted JetBrains Mono labels; ruler supports, never dominates. No visible grid on `--bg`.
- Milestones: `● / │ / label` attached to the axis — not floating cards. Selected = accent; neutral = `--text-secondary`.
- Stages: subtle horizontal bands (`──══──`), muted fills at low opacity + 1px definition; overlaps distinguished by lane + label + border treatment, never color alone.
- Empty/loading states reuse the dot–line–arrow vocabulary.

## Accessibility baseline

Contrast ≥ 4.5:1 for text (all token pairs above pass on `--bg`); visible focus (2px accent ring, offset 2); full keyboard operability including canvas (arrow-key pan, +/- zoom, tab through milestones); semantic HTML; labeled form fields; alt text support in the block model; state never conveyed by color alone (selected milestones also change shape/weight; stage distinction uses lanes + labels).
