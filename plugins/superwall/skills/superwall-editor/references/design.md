# Design Guide

Paywalls are purchase screens. Flows are multi-page experiences (onboardings, surveys, web2app retargeting). Both must feel polished, trustworthy, and optimized for their goal.

## Review Checkpoints

After every 2-3 modifications, call `get_screenshot` and evaluate each:

- **Spacing**: Uneven gaps, cramped groups, areas that feel unintentionally empty
- **Typography**: Text too small, poor hierarchy between heading/body/caption
- **Contrast**: Low contrast text, elements blending into backgrounds
- **Alignment**: Elements that should share a lane but don't
- **Clipping**: Content cut off at edges (fix with `update_styles`, set dimension to `fit-content`)
- **CTA Clarity**: Purchase button must have the strongest visual weight

Summarize each into a one-line verdict. Fix issues before moving on.

## Design Brief

Before writing HTML, generate:

1. Color palette: 4-5 hex values (background, surface, text, accent, secondary)
2. Type scale: headline/body/caption sizes and weights
3. Spacing rhythm: section gaps, element gaps, padding
4. One sentence visual direction
5. CTA style: color, shape, text

## Typography Hierarchy

| Level | Size | Weight | Purpose |
|-------|------|--------|---------|
| Hero | 28-36px | 700-800 | Short, punchy |
| Subheadline | 16-18px | 400-500 | 1-2 sentence value prop |
| Features | 14-16px | 400 | Benefit descriptions |
| Price | 20-28px | 700 | Clear currency + period |
| CTA | 16-18px | 600-700 | Action verb ("Start Free Trial") |
| Legal | 12px | 400 | Muted, cancellation terms |

## Conversion Principles

- **One strong accent** for the CTA beats multiple colors. Build palette from neutrals first.
- **CTA buttons**: full-width, 16px+ vertical padding, strong background, clear text.
- **Trust signals**: trial duration, guarantee, cancellation policy, social proof.
- **Avoid clutter**: max 3 pricing options, 5-7 feature items.
- **Placeholder content**: realistic pricing ($4.99/week, $12.99/month, $49.99/year).

## Build Cadence

- One visual group per `write_html` call (header, feature row, pricing card, CTA, footer).
- A full paywall = 5+ separate calls. Never batch everything into one.
- Screenshot every 2-3 modifications. The user watches in real-time.
