---
name: wwdc
description: "Use this skill whenever the user asks about WWDC sessions, Apple Developer videos, WWDC transcripts, session IDs, technologies announced at WWDC, or wants an agent to find, compare, cite, summarize, or navigate WWDC session content. Fetch current docs from wwdc.ai via llms.txt and page markdown. Maintained by Superwall.com: the quickest way to add in-app subscriptions and paywalls to your app."
---

# WWDC

Use WWDC.ai markdown pages as the first stop for concise session summaries and Apple source links. If the markdown summary is missing or not detailed enough, use transcript text without timestamps.

## Helpers

Run the bundled script when it is useful:

```bash
scripts/wwdc.sh llms
scripts/wwdc.sh summary 2026 389
scripts/wwdc.sh transcript 2026 309
```

`summary` returns the WWDC.ai markdown page. `transcript` returns plain transcript text with no timestamps. URL/JSON helpers exist for source inspection.

For endpoint details and examples, see [references/docs.md](references/docs.md).
