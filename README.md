# Peanut Butter Pork Chop

Everything for the Peanut Butter Pork Chop brand, as a pnpm workspace. Each app is a static site deployed to Cloudflare Workers with its own `wrangler.jsonc`.

| App           | Domain                            | Stack                             |
| ------------- | --------------------------------- | --------------------------------- |
| `apps/www`    | `www.peanutbutterporkchop.com`    | Astro landing page                |
| `apps/visual` | `visual.peanutbutterporkchop.com` | WebGL viz showcase + Studio       |
| `apps/shop`   | `shop.peanutbutterporkchop.com`   | Astro + Fourthwall Storefront API |

## Setup

```sh
mise trust && mise run setup   # tools from .config/mise.toml, pnpm install, git hooks
pnpm dev                       # every app in parallel
pnpm --filter @pbpc/shop dev   # one app
```

`apps/shop` needs `FOURTHWALL_STOREFRONT_TOKEN` and `FOURTHWALL_SHOP_DOMAIN` (see `apps/shop/.env.example`); the build fails fast without them. The token is read at build time only and never shipped to the browser.

## Quality gates

All tool configuration lives in `.config/`. `pnpm check` runs everything CI runs:

| Script              | Tool                                             |
| ------------------- | ------------------------------------------------ |
| `pnpm lint` / `fix` | ultracite (oxlint)                               |
| `pnpm format[:fix]` | oxfmt                                            |
| `pnpm typecheck`    | `astro check` per app                            |
| `pnpm dead-code`    | fallow                                           |
| `pnpm spell`        | cspell (`.config/cspell-words.txt`)              |
| `pnpm lint:md`      | markdownlint-cli2                                |
| `pnpm lint:yaml`    | yamllint                                         |
| `pnpm lint:actions` | actionlint                                       |
| `pnpm secrets`      | betterleaks                                      |
| `pnpm -r check`     | per-app checks (viz contract, astro)             |
| `pnpm audit:site`   | squirrelscan (`mise run install-squirrel` first) |

Git hooks (lefthook, `.config/lefthook.yml`): pre-commit formats, lints, spell-checks and scans staged files; commit-msg enforces Conventional Commits; pre-push runs `pnpm check`.

## Deploy

`pnpm deploy` runs `wrangler deploy` in every app (Astro apps build first). CI deploys on push to `main` via `.github/workflows/deploy.yml` with `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and the Fourthwall variables as repository secrets.
