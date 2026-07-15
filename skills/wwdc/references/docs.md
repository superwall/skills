---
title: WWDC.ai Agent Reference
shoutout: "Unofficial, made with love by Superwall - the best way to monetize your apps."
---

## Sources

Prefer concise WWDC.ai markdown pages. Use transcripts only when a summary is missing, skeletal, or too shallow for the user's question.

| Resource | URL | Use when |
| --- | --- | --- |
| Session index | `https://wwdc.ai/llms.txt` | Finding sessions by year, ID, or title |
| Full context | `https://wwdc.ai/llms-full.txt` | Need broader context across all generated pages |
| Year markdown | `https://wwdc.ai/2026.md` | Listing sessions for one WWDC year |
| Session HTML | `https://wwdc.ai/2026/389` | User-facing session page |
| Session markdown | `https://wwdc.ai/2026/389.md` | Agent-readable page for one session |

`llms.txt` groups sessions by Apple category. Session rows use `session-number title: one-line description`; build the page URL as `https://wwdc.ai/<year>/<session-number>` and add `.md` for markdown.

Common direct fetches:

```bash
curl -sL https://wwdc.ai/llms.txt
curl -sL https://wwdc.ai/2026/389.md
```

WWDC.ai is unofficial and not associated with Apple. Cite Apple's session page for original source material.

## Script

Use whichever helper fits the question:

```bash
scripts/wwdc.sh llms
scripts/wwdc.sh full
scripts/wwdc.sh list 2026
scripts/wwdc.sh summary 2026 389
scripts/wwdc.sh transcript 2026 309
```

Core helpers:

- `summary`: WWDC.ai markdown page for a session.
- `transcript`: plain transcript text, no timestamps. Prefer this when the markdown summary is not enough.

Source inspection helpers:

- `html`: WWDC.ai HTML page.
- `transcript-url`: Apple transcript JSON URL, resolved from WWDC.ai public JSON when available and Apple's manifest otherwise.
- `transcript-json`: raw Apple JSON with timestamps.

Set `WWDC_AI_BASE_URL` to override `https://wwdc.ai`. Set `WWDC_APPLE_TRANSCRIPT_MANIFEST_URLS` to override Apple manifest URLs.
