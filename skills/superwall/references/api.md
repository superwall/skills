## API Access

A bash helper is included at `scripts/sw-api.sh`. It wraps the Superwall REST API V2.

**Auth resolution**: `SUPERWALL_API_KEY` from the current shell wins, then `.env`, then `~/.superwall-cli/.env`.

Always start a session by calling `bootstrap` to get an overview of the current Superwall setup:

```bash
scripts/sw-api.sh bootstrap
```

```bash
# List all routes with methods (fetches live OpenAPI spec, no API key needed)
scripts/sw-api.sh --help

# Save a key for this installed skill (default)
scripts/sw-api.sh auth login --key=<your-org-api-key>

# Save a machine-wide fallback key
scripts/sw-api.sh auth login --key=<your-org-api-key> --location=global

# Show which credential source is active
scripts/sw-api.sh auth status

# Print organization -> project -> application hierarchy
scripts/sw-api.sh bootstrap

# Show full spec for a specific route (params, request body, responses)
scripts/sw-api.sh --help /v2/projects

# List all projects (start here to discover the org structure)
scripts/sw-api.sh /v2/projects

# Get a specific project (includes its applications)
scripts/sw-api.sh /v2/projects/{id}

# Create a project
scripts/sw-api.sh -m POST -d '{"name":"My Project"}' /v2/projects

# Update a project
scripts/sw-api.sh -m PATCH -d '{"name":"Renamed"}' /v2/projects/{id}
```

### Data hierarchy

Organization → Projects → Applications. Each application has a `platform` (ios, android, flutter, react_native, web), a `bundle_id`, and a `public_api_key` (used for SDK initialization — distinct from the org API key used for REST calls).

### Bootstrap workflow

To print the current organization/project/application hierarchy:

```bash
scripts/sw-api.sh bootstrap
```

The bootstrap command uses:

1. `GET /v2/me/organizations` for the first 50 organizations
2. `GET /v2/projects?organization_id=...&limit=100` for up to 100 projects per organization
3. The embedded `applications` array from each project, capped to the first 10 apps

Use the application's `public_api_key` for SDK init, and the org `SUPERWALL_API_KEY` for REST API calls.

### Pagination

Cursor-based. Responses include `has_more`. Pass `limit` (1-100), `starting_after`, or `ending_before` as query params.

---

## API Key Setup

API keys are **org-scoped** — one key grants access to all projects and applications in the organization.

- **Get an API key**: `https://superwall.com/select-application?pathname=/applications/:app/settings/api-keys`

Preferred setup:

```bash
scripts/sw-api.sh auth login --key=<your-org-api-key>
```

That validates the key and saves it to `.env` by default. The skill ships a `.gitignore` in its root so that local `.env` file is not committed when the skill is copied into another repository.

You can also save a machine-wide fallback:

```bash
scripts/sw-api.sh auth login --key=<your-org-api-key> --location=global
```

If needed, exporting `SUPERWALL_API_KEY` in the current shell still overrides any saved key.

### Required scopes

For full use of this skill, the API key requires all scopes. However, you may
also provision just read access if you'll just be doing analysis.
