# Momo Shopify theme

Custom Online Store 2.0 theme for [Momo](https://shopify.dev/) — Liquid templates, Tailwind CSS v4, and Horizon-style JavaScript (Section Rendering API, morph updates, native ES modules).

The storefront theme and the Shopify admin app are **separate projects**. This repository contains only the theme. Theme source must live at the **repository root** so the Shopify CLI can push and sync the theme correctly.

The Momo admin app (React Router, embedded admin) is developed in its own project alongside this repo locally (`../app`).

## Prerequisites

- [Node.js](https://nodejs.org/) LTS
- [pnpm](https://pnpm.io/)
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli)

Optional:

- [Shopify Liquid VS Code extension](https://shopify.dev/docs/storefronts/themes/tools/shopify-liquid-vscode)

## Quick start

From the repository root:

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs Tailwind in watch mode and `shopify theme dev` in parallel. Override the dev store with `shopify theme dev --store <store>` if needed (the default store is set in `package.json` → `dev:theme`).

### Production CSS

Before pushing theme changes that add or change Tailwind utilities:

```bash
pnpm run css:build
```

## Repository layout

```text
.
├── assets/          # CSS, JS modules, images (includes compiled tailwind.css)
├── blocks/          # Theme blocks
├── config/          # settings_schema.json, settings_data.json
├── layout/          # theme.liquid, password.liquid
├── locales/         # Storefront and editor translations
├── sections/        # Theme sections
├── snippets/        # Reusable Liquid (scripts, cart, images, etc.)
├── src/             # Tailwind source → assets/tailwind.css
├── templates/       # JSON / Liquid page templates
├── AGENTS.md        # Liquid, schema, and localization conventions
├── biome.json       # Biome config (Tailwind-aware CSS)
└── package.json     # Dev scripts and Tailwind toolchain
```

## Tooling

### Theme CSS

Tailwind v4 scans Liquid and JSON templates under `blocks/`, `layout/`, `sections/`, `snippets/`, and `templates/`. Source: `src/tailwind.css` → output: `assets/tailwind.css`.

Brand color tokens are defined in `src/tailwind.css` (`brand-steel`, `brand-rust`, `brand-earth`, `brand-warmth`, `brand-heart`, etc.) and exposed as utilities such as `bg-brand-steel` and `text-brand-rust`.

### Theme JavaScript

No bundler — native ES modules with an import map in `snippets/scripts.liquid`. Shared modules live in `assets/` (`component.js`, `morph.js`, `section-renderer.js`, cart helpers, and others). Entry scripts are loaded per template from that snippet.

Cart and section updates use the Section Rendering API with DOM morphing (`@theme/morph`, `@theme/section-renderer`).

### Linting and conventions

Theme conventions for Liquid, schemas, and translations are documented in [AGENTS.md](./AGENTS.md).

## Shopify CLI

Run theme commands from the repository root:

```bash
shopify theme dev
shopify theme push
shopify theme pull
```

## Related project

| Project | Description |
| --- | --- |
| Momo admin app | Shopify embedded app (React Router). Separate repo / `../app` locally. Use `pnpm dev` in that project for app development. |

## Further reading

- [AGENTS.md](./AGENTS.md) — contributor and agent guidelines for this theme
- [Shopify theme architecture](https://shopify.dev/docs/storefronts/themes/architecture)
- [Section Rendering API](https://shopify.dev/docs/api/ajax/section-rendering)
