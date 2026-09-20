# coding-plan

Turns a product idea (or an existing codebase) into a structured PRD — Fase → Fitur → Sub-fitur — ready for an AI coding agent to execute. npm workspaces monorepo.

## Layout

- **`apps/web/`** — the Next.js web app (idea-to-PRD generator, auth, dashboard). See `apps/web/README.md` for setup, and `apps/web/prd.md` / `knowledge.md` / `changelog.md` for its planning docs.
- **`packages/shared/`** — TypeScript types shared between the web app and the CLI (API response envelope, PRD structure). This is *the* reason this is a monorepo instead of two separate repos — see the "Monorepo over separate repos" decision in `apps/web/knowledge.md` §3.
- **`packages/cli/`** — not yet implemented. See `developer-brief-cli-tool.md`.
- **`developer-brief-web-app.md`** / **`developer-brief-cli-tool.md`** — the original system-level briefs both units were planned from (Appendix I split: one deployable per document).

## Setup

```bash
npm install          # installs and links all workspaces from the root
npm run dev           # → apps/web dev server
npm run build         # → apps/web production build
npm run lint          # → apps/web lint
npm run test          # → apps/web tests
```

Per-workspace commands: `npm run <script> --workspace=apps/web` (or `-w apps/web`).

## Why a monorepo

The web app and CLI share an API contract (`packages/shared`) — the CLI is a consumer of the web app's backend, not an independent service. Keeping that contract in one place avoids the two of them silently drifting apart, which is a real risk a duplicated-types setup already hit once (see the `PrdGenerator.tsx` fix noted in `apps/web/knowledge.md`'s Architecture section). Each unit still keeps its own `prd.md`/`knowledge.md`/`changelog.md` — only the repo/tooling is shared, not the planning documents.
