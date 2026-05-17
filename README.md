# Momo

Monorepo for the Momo Shopify storefront and admin app.

| Package | Description |
| --- | --- |
| [`shopify/`](./shopify/) | Custom Online Store 2.0 theme (Liquid, Tailwind CSS v4, Horizon-style JS) |
| [`app/`](./app/) | Shopify app (React Router, embedded admin) |

Each package has its own dependencies and scripts. Work from the directory that matches what you are changing.

## Prerequisites

- [Node.js](https://nodejs.org/) LTS (see `app/package.json` engines for supported versions)
- [pnpm](https://pnpm.io/)
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli)

Optional:

- [Shopify Liquid VS Code extension](https://shopify.dev/docs/storefronts/themes/tools/shopify-liquid-vscode) for theme work

## Quick start

### Theme (storefront)

```bash
cd shopify
pnpm install
pnpm dev
```

`pnpm dev` runs Tailwind in watch mode and `shopify theme dev` in parallel. See [shopify/README.md](./shopify/README.md) for CSS builds, theme structure, cart/section JS, and CLI commands.

### App (admin)

```bash
cd app
pnpm install
pnpm dev
```

See [app/README.md](./app/README.md) for authentication, GraphQL, webhooks, Prisma, and deployment.

## Repository layout

```text
momo/
├── app/                 # Shopify app (React Router + Vite)
├── shopify/             # Theme source (uploaded to the store)
│   ├── assets/          # CSS, JS modules, images
│   ├── sections/        # Theme sections
│   ├── snippets/        # Reusable Liquid
│   ├── templates/       # JSON / Liquid templates
│   └── src/             # Tailwind source (build output → assets/)
├── biome.json           # Biome config (theme CSS / tooling)
└── README.md
```

## Tooling

- **Theme CSS** — Tailwind CLI compiles `shopify/src/tailwind.css` to `shopify/assets/tailwind.css`. Run `pnpm run css:build` in `shopify/` before pushing when utilities change.
- **Theme JS** — Native ES modules with an import map (no bundler). Entry scripts are loaded per template in `shopify/snippets/scripts.liquid`.
- **Linting** — Theme conventions and Liquid standards are documented in [shopify/AGENTS.md](./shopify/AGENTS.md). The app uses ESLint via `pnpm run lint` in `app/`.

## Shopify CLI

Run theme commands from `shopify/` and app commands from `app/`. The dev store for the theme is configured in `shopify/package.json` (`dev:theme` script); override with `shopify theme dev --store <store>` as needed.

## Further reading

- [shopify/README.md](./shopify/README.md) — theme development, brand tokens, Section Rendering API
- [shopify/AGENTS.md](./shopify/AGENTS.md) — Liquid, schema, and localization conventions for contributors and agents
- [app/README.md](./app/README.md) — app template docs, deployment, troubleshooting
