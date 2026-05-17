# Momo Shopify theme

Custom Shopify Online Store 2.0 theme for Momo, built on Shopify’s Skeleton theme patterns with Tailwind CSS v4 for utility styling.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/)
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) — theme dev, push, and preview

Optional but recommended:

- [Shopify Liquid VS Code extension](https://shopify.dev/docs/storefronts/themes/tools/shopify-liquid-vscode) — syntax highlighting, linting, and LiquidDoc support

## Development

From this directory (`shopify/`):

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs two processes in parallel:

1. **Tailwind** — watches `src/tailwind.css` and writes `assets/tailwind.css`
2. **Theme dev** — `shopify theme dev` against the store configured in `package.json`

To run them separately:

```bash
pnpm run dev:css    # Tailwind watch only
pnpm run dev:theme  # Shopify theme dev only
```

Change the dev store by editing the `--store` flag in `package.json`, or run `shopify theme dev` manually with your own flags.

### Production CSS

Before pushing or publishing, build minified Tailwind output:

```bash
pnpm run css:build
```

Commit `assets/tailwind.css` when utility classes in Liquid change so the live theme has up-to-date CSS.

## Tailwind

Source: `src/tailwind.css`  
Output: `assets/tailwind.css` (loaded in `layout/theme.liquid` after `critical.css`)

Tailwind scans Liquid and JSON templates via `@source` directives. Use utility classes directly in sections, blocks, and snippets (for example `bg-brand-steel`, `text-brand-heart`).

Brand colors are defined in `src/tailwind.css`:

| Token | Utility examples | Hex |
| --- | --- | --- |
| Steel / primary | `bg-brand-steel`, `text-brand-primary` | `#00253f` |
| Rust | `text-brand-rust` | `#c57639` |
| Earth | `text-brand-earth` | `#987659` |
| Warmth | `text-brand-warmth` | `#ea7657` |
| Heart | `text-brand-heart` | `#ff5e6e` |

Component-specific CSS still belongs in `{% stylesheet %}` tags or `critical.css` when it must load on every page.

## Theme layout

```text
shopify/
├── assets/          # Static files (critical.css, tailwind.css, images, icons)
├── blocks/          # Nestable theme blocks (text, group, …)
├── config/          # settings_schema.json, settings_data.json
├── layout/          # theme.liquid, password.liquid
├── locales/         # en.default.json, en.default.schema.json
├── sections/        # Page sections (hero-fullscreen, header, product, …)
├── snippets/        # Reusable Liquid (css-variables, meta-tags, image, …)
├── src/             # Tailwind source (not uploaded as theme source)
└── templates/       # JSON and Liquid templates
```

See [Shopify theme architecture](https://shopify.dev/docs/storefronts/themes/architecture) for how these folders fit together.

Notable sections:

- **hero-fullscreen** — full-viewport hero with overlay, copy, and CTA
- **header** / **footer** — global chrome (wired via section groups in `header-group.json` and `footer-group.json`)

## Content loading (Horizon-style)

First paint is always server-rendered Liquid. Client updates use Shopify’s [Section Rendering API](https://shopify.dev/docs/api/ajax/section-rendering) (`?section_id=`) and a DOM **morph** layer adapted from [Shopify Horizon](https://github.com/Shopify/horizon) (`morph.js`, `section-renderer.js`, `section-hydration.js`, etc. in `assets/`).

| Feature | Module / section |
| --- | --- |
| Product add to cart | `product-cart.js` — morphs header + cart drawer |
| Cart page updates | `cart-items.js` + `sections/cart.liquid` |
| Cart drawer | `cart-drawer.js`, `sections/cart-drawer.liquid`, header cart button |
| Collection filters | `collection-facets.js` + `sections/collection.liquid` |
| Variant picker (PDP) | `variant-picker.js` — morphs product section on change |
| Page transitions | `view-transitions.js` (theme setting: **Animations → Enable page transitions**) |
| Header hydration | idle `hydrate()` for `data-hydration-key` regions |

Horizon-derived JS is MIT-licensed for Shopify theme development; themes substantially based on Horizon are not eligible for the Shopify Theme Store.

## Conventions

- **Translations** — user-facing copy uses `{{ 'key' | t }}`; add keys to `locales/en.default.json`
- **Schemas** — sections and blocks expose merchant settings via `{% schema %}` JSON
- **CSS variables** — single-property settings map to CSS custom properties; multi-property settings use modifier classes (see `AGENTS.md`)
- **LiquidDoc** — snippets and statically rendered blocks include a `{% doc %}` header

For detailed Liquid, schema, and localization standards used in this repo, see [AGENTS.md](./AGENTS.md).

## Shopify CLI

Common commands (run from `shopify/`):

```bash
shopify theme dev          # local preview with hot reload
shopify theme push         # upload theme to the store
shopify theme pull         # download theme files from the store
shopify theme check        # run Theme Check lints
```

Files listed in `.shopifyignore` are excluded from CLI push/pull/dev operations.

## Monorepo

This theme lives in the `momo` repository alongside `app/` (Shopify app). Theme work stays in `shopify/`; app work stays in `app/`.
