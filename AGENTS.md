# AGENTS.md

pnpm workspace, three static Cloudflare Workers sites under `apps/` (`www`, `visual`, `shop`). Read `README.md` for the map; `apps/visual/README.md` for the viz contract.

- Tool config is in `.config/`; never add config files to the repo root.
- Run `pnpm check` before committing. Commits follow Conventional Commits.
- `apps/visual` is vanilla browser JS with no build step; keep it that way.
- `apps/shop` reads Fourthwall at build time; see `apps/shop/src/lib/fourthwall.ts`.
