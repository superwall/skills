<p align="center">
  <a href="https://superwall.com/">
    <img src="https://user-images.githubusercontent.com/3296904/158817914-144c66d0-572d-43a4-9d47-d7d0b711c6d7.png" alt="Superwall" height="100" />
  </a>
</p>

# Superwall Agent Skills

Official agent skills for integrating Superwall SDKs, managing Superwall
resources, analyzing data, and building paywalls.

## Install

We recommend using [skills.sh](https://skills.sh) CLI to install the skills.

Install all skills (works for all frontier agents):

```bash
npx skills add superwall/skills --agent claude-code universal --global --yes 
```

Install one skill:

```bash
npx skills add superwall/skills --skill superwall --agent claude-code universal --global --yes 
npx skills add superwall/skills --skill superwall-editor --agent claude-code universal --global --yes 
```

## Set up the CLI

The `superwall` skill uses the official CLI for authenticated resource and data
access. Install it and sign in once:

```bash
npm install --global superwall
superwall login
superwall whoami --json
```

For CI, authenticate without a browser:

```bash
superwall login --api-key <key>
```

The session is stored under `~/.superwall`. Agents should pass `--json` to data
and mutation commands.

## Included skills

- `superwall`: Resources, App Store Connect, Apple Search Ads, ClickHouse analytics, docs, SDK
  integration, migration, and review workflows.
- `superwall-editor`: Live paywall, onboarding, and web-to-app editing through a
  paired browser session.
- `wwdc`: WWDC session lookup, comparison, citation, summarization, and
  transcript navigation using [wwdc.ai](https://wwdc.ai/).

The `superwall` skill carries the app-side workflow playbooks under
`workflows/` (`integrate`, `placements`, `dashboard`, `review`, `migrate`),
one playbook plus one file per framework or provider. Those are
also what the `superwall` CLI runs headless for `superwall
integrate|review|migrate`: its build bundles the skill from `main` into the
package (`packages/cli` in the
[superwall monorepo](https://github.com/superwall/superwall)) and it installs
the live repo over that copy at `superwall login`. Edit them here; see [AUTHORING.md](AUTHORING.md).
