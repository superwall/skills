# Migrating a dashboard (editor) paywall to code

A paywall built in Superwall's visual editor becomes a framework paywall by
being **rebuilt**, not transplanted: same design, same products, same
pages and actions, expressed as routes, hooks and your own CSS. The CLI
does the deterministic half; you do the pages; the user reviews in the
studio against the original; nothing goes live until they say so.

```bash
superwall create --from <paywall-id>      # in the app's root, or an empty directory
```

That reads the dashboard paywall and its served document and scaffolds a
project whose `paywalls/<slug>/config.ts` already carries the name,
platform, product slots, presentation style and geometry, feature gating,
scroll and cache settings, background, and the locales to provide. It
writes `paywalls/<slug>/MIGRATION.md`, the brief with the source URL,
screenshot, product table and an inventory, records the source in
`superwall.lock` under `origins`, and connects the project to the same
app. Read the brief first; every step below refers to it.

## What you are migrating from

The served document (the brief's "Served document" URL) is a rendered
HTML page **plus the editor's entire store as JSON** in
`<script id="vike_pageContext" type="application/json">`. Fetch it once
and read the store rather than scraping the DOM; it is the design's
source of truth:

```bash
curl -sL -A "Mozilla/5.0" "<served document url>" -o source.html
```

Inside the store (`typeName` on every record):

| Record | What it is | Becomes |
| --- | --- | --- |
| `paywall` | settings: `presentationStyleV3`, `featureGating`, `isScrollEnabled`, `onDeviceCache`, `gameControllerSupport`, `webCheckoutDestination` | already in `config.ts` |
| `paywall_product:<ref>` | a product slot, with `productVariables` (the example prices the editor rendered with) | `products.<ref>` in `config.ts`; the identifier is `"missing"` on templates and must be fixed |
| `paywall_language:<locale>` | a translated locale | `messages/<locale>.ts` |
| `node` (`type: stack \| text \| img \| video \| lottie \| icon \| navigation \| drawer`) | the element tree via `parentId`; `props` hold text, media, layout; inline `style`/classes on the rendered HTML hold the design tokens | components and CSS |
| `node` with `type: navigation` | **the pages**: each child stack is one page, in `index` order | one route per child under `app/`; the navigation's `currentIndex` state is the router |
| `node` with `type: drawer` | a bottom sheet with an `isOpen` state | a route pushed with the `sheet` transition, or local state for a small one |
| `property-click-behavior` on a node | the action a tap performs (below) | a hook call |
| `state:state.<name>` | custom state (a toggle, a selected choice) | React state, or `useQueryState` on a web funnel |
| `state:products.selectedIndex` | which product is selected | plain React state, as in the `product-selection` example |
| `state:products.hasIntroductoryOffer` | trial eligibility | `useIntroductoryOffer()` |
| `style_variable_group` | design tokens per interface style and breakpoint | `:root` / `:root.dark` custom properties |

Text nodes render **Liquid**: `{{ products.primary.price }}`,
`{{ products.selected.period }}`, `{{ products.yearly.rawPrice | divided_by: 12 | round }}`.
Every `{{ … }}` becomes a read of `useProducts()` variables (the brief
lists them all); filters become JavaScript, and arithmetic on `rawPrice`
becomes `Number()` arithmetic guarded on the value existing. `products.selected`
is whichever slot the selection state points at.

### Action mapping

| Editor action (`"type"` in the store) | Framework |
| --- | --- |
| `purchase` (`by-index` / `by-selected`) | `usePurchase().purchase(reference)`; `by-selected` reads your selection state. `onPurchase` follow-ups become code after `await purchase()` resolves `completed` |
| `restore` | `useActions().restore()` |
| `close` | `useActions().close()` |
| `open-url` | `useActions().openUrl(url)` |
| `navigate-page` (`next` / `back`) | `useRouter().push("<next route>")` / `router.back()` |
| `set-product-index` | set your selection state |
| `set-state` | set the matching React state |
| `set-attribute` | `useActions().setUserAttributes({ … })` |
| `custom-placement` | `useActions().customPlacement(name, params)` |
| `custom-in-app` | `useActions().requestCallback(...)` (docs: `actions`) |
| `request-permission` | `useActions().requestPermission(type)`; `onGranted`/`onDenied` become the resolved status |
| `request-store-review` | `useActions().requestStoreReview()` |
| `redeem-discount` | `useDiscount().redeem(code)` |
| `redeem-purchase` | `useCheckoutRedemption()` (web) |
| `select-choice` / `select-indicator` | React state on the choice group |
| `focus-input` / `scroll-to-element` | a `ref` and `focus()` / `scrollIntoView()` |
| `teleport-to-web` | not migrated; ask the user what the web destination should be |

Fetch `curl -sL superwall.com/docs/framework/actions.md` for the exact hook
signatures before writing them.

## The workflow

1. **Inventory, and get a yes.** From the brief and the store, write down
   every page (navigation children, in order), every drawer, every action
   and where it sits, every `{{ }}` variable, every locale, every asset
   URL (images, video, Lottie, fonts), and every custom state. Show that
   list to the user with the screenshot, and ask whether anything should
   change in the rebuild (usually: nothing, it is a migration). Don't
   write code before that yes.
2. **Fix the products.** A `"missing"` identifier in `config.ts` blocks
   push. The dashboard paywall's product slots name the real products
   on a published paywall; on a template they don't exist, and the user
   has to choose (or you create them, see [cli.md](cli.md)).
3. **Rebuild page by page, in the store's order.** Each navigation child
   is a route; shared chrome (close, back, step indicator) that the editor
   drew outside the navigation goes in `layout.tsx`. Use the framework's
   layout system as written in [layout.md](layout.md): the paywall is
   inset for you, chrome is absolute in the layout, the CTA is sticky in
   the page, no `env()`, no `position: fixed`. Take spacing, type, colors
   and radii from the rendered HTML's inline styles and the
   `style_variable_group` tokens; take nothing from habit. The design
   conventions in [mobile-design.md](mobile-design.md) apply, with the
   reference winning every time.
4. **Rebuild every state, not the one the screenshot shows.** Both
   trial-eligibility variants, every selected product, every toggle, the
   drawer open and closed. **Every string goes through messages**, even
   when the source has one language: the default locale's copy in
   `messages/en.ts` (or the paywall's `defaultLocale`), every
   `paywall_language` as its own `messages/<locale>.ts`, and `t()` in the
   pages, `aria-label`s included; Liquid product variables become `t()`
   interpolations guarded on the value. Assets are downloaded into
   `assets/` and referenced relatively; fonts are subset.
5. **Compare in the studio.** `superwall dev`, open the paywall, and pick
   **Compare › Original**. The right pane is the dashboard paywall served
   as it is today, view-only: it does not follow the studio's theme,
   locale or device variables, so it shows the editor's example prices in
   light mode. Walk every page on an island phone, iPhone SE, a Pixel and
   an iPad, both schemes on your side, and fix what differs. Then ask the
   user to review it the same way; that review is the gate.
6. **Push, never promote.** `superwall push` creates a **new** dashboard
   paywall bound in `superwall.lock`; the original keeps serving. Tell the
   user how to switch: point the campaign's variant at the new paywall,
   and back at the old one to roll back. Do not promote or touch campaigns
   unless asked.
7. **Delete `MIGRATION.md`** when the user is satisfied. The `origins`
   entry in the lock stays, so Compare › Original keeps working.

## What does not migrate, and must be said

- **The original cannot be converted in place.** A framework paywall is a
  new dashboard paywall; the switch is a campaign change the user makes.
- **Editor-only behavior with no framework equivalent**: surveys attached
  to the paywall, `teleport-to-web`, and anything the editor computes
  from states the store carries but the pages never render. Name each one
  in the hand-off as "not carried over" rather than approximating it.
- **Example prices.** The editor stores example `productVariables` per
  slot; the framework never invents prices. Guard every variable and
  design the unpriced state as the framework skill says.
- **Pixel identity is not the goal; the design is.** The editor's
  generated CSS (absolute `vw` widths, deep stack nesting) is not what to
  reproduce. Reproduce what it looks like with clean CSS, and let the
  Compare pane, not a diff of DOM, decide when it matches.
