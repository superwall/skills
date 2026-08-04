# Localization

Ship a paywall in multiple languages by adding one file per locale. No
registration, no wiring — the filename is the locale, and the device picks
which one renders.

## Add locales

```
superwall/
├── messages/                 shared by every paywall
│   ├── en.ts
│   └── de.ts
└── paywalls/pro/
    └── messages/             this paywall's own
        ├── en.ts
        └── fr.ts
```

Each file default-exports a nested object:

```ts
// paywalls/pro/messages/fr.ts
export default {
  paywall: {
    title: "Passez à Pro",
    cta: "S'abonner · {price}",
    perMonth: "{price} par mois, facturé annuellement",
  },
} as const;
```

A paywall's own catalog layers over the shared one — it overrides the keys
it names and inherits the rest. A locale can exist in either layer or
both. Set the fallback in `config.ts` if it isn't English:

```ts
localization: { defaultLocale: "en" },
```

## Use the strings — `useTranslation()`

```tsx
const { t, locale, setLocale, locales } = useTranslation();

<h1>{t("paywall.title")}</h1>
<button>{price ? t("paywall.cta", { price }) : t("paywall.ctaBare")}</button>
<button aria-label={t("paywall.close")}>×</button>
```

- `t(key, values?)` — the translated string for the active locale.
- `locale` — the active locale, resolved from the device
  (`pt-BR` matches a `pt-BR` catalog, then `pt`, then the default).
- `setLocale(locale)` — override the device; `setLocale(undefined)`
  returns to auto-detection. For previews and tests — on device the
  system setting is the truth.
- `locales` — every locale that has a catalog.

Rules:

- Interpolation is `{name}` with `t(key, { name: value })`.
- A key missing from the active locale falls back to the default locale
  **per key** — a partial translation stays usable.
- An unknown key renders as itself, so `t()` never breaks — which also
  means **key typos are invisible at runtime**; check copy in the studio.
- Guard interpolations on the value existing, with a bare-key fallback
  (as in the CTA above) — never render "Subscribe · undefined".

> **Note:** there is no plural engine — no ICU, no `_one`/`_other`.
> Write around plurals or fork on the count yourself.

## Rules

- **Never put a price in a catalog.** Prices are localized by the store —
  the SDK delivers the right currency and format for the user's region.
  Interpolate them: `"Subscribe · {price}"`.
- **No language picker on device.** The locale is the person's system
  setting; preview other locales with the studio's locale switcher.
- **Copy expands.** German runs long — size nothing to fit English.
- Product `period`/`periodly` ("yearly" → "jährlich") localize
  automatically in 44 languages, independent of your catalogs.
- A single-locale paywall needs none of this — plain strings in JSX are
  fine until the second locale arrives.

`examples/localization` shows four locales, both catalog layers, and
guarded interpolation.
