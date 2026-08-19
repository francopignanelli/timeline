# Timeline

An interactive temporal canvas for organizing and exploring history through Timelines, Milestones, and Stages.

## Repository

| Path | Contents |
|---|---|
| `apps/web` | React 19 + Vite + Tailwind v4 frontend |
| `packages/shared` | Domain types, PartialDate utilities, zod schemas |
| `docs/` | Product, architecture, data model, API, security, design system, costs, decisions, status |
| `CLAUDE.md` | Persistent agent operating rules (read first) |

`apps/api` (Lambda) and `infra` (CDK) are added in their respective phases — see [docs/STATUS.md](docs/STATUS.md).

## Development

```bash
npm install
npm run dev        # frontend on localhost
npm run typecheck
npm run test
npm run lint
npm run build
```

## Project rules

Hard budget cap: **USD $5/month** for AWS + paid services; development targets ~$0. See `CLAUDE.md` and [docs/COSTS.md](docs/COSTS.md) before touching infrastructure.
