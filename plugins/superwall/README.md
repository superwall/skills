# Superwall plugin

Connect your Superwall account to inspect and manage projects, applications,
products, entitlements, campaigns, paywalls, webhooks, events, and analytics.
The remote MCP server uses Superwall sign-in and acts with your account's
permissions. In a local coding agent, the bundled CLI and editor skills also
guide SDK integration, review, migration, and live paywall editing.

## Connect

The plugin points to the official HTTPS MCP endpoint:
`https://mcp.superwall.com/mcp`. Sign in through the browser when your
agent asks. The [Superwall MCP guide](https://superwall.com/docs/dashboard/guides/superwall-mcp)
explains manual setup and supported tools. The MCP server does not edit the
live paywall editor canvas; use the local editor skill for a paired editor
session.

Account operations that are unavailable through MCP use the `superwall` CLI:
install it with `npm install --global superwall`, then run `superwall login`.
SDK code review can start from local files without CLI login. Live editor work
uses the bundled `sw-editor.sh` script, which needs Bash, `curl`, and `jq`;
manual pairing does not need CLI login. The plugin does not install these
dependencies automatically. Hosted chat clients use the MCP connector for
account operations.

Run `npm run plugin:build` from the repository root to assemble the complete
package at `dist/superwall`. For Claude Code, load it with
`claude --plugin-dir ./dist/superwall`. For Cursor Marketplace, publish the
generated package as a standalone Git repository or release branch, then submit
that Git URL. A public directory listing requires separate review by each
platform.

## Data and support

The MCP server sends requests to Superwall on behalf of the signed-in user.
The CLI also calls Superwall's API and emits anonymous usage telemetry, with
opt-out options documented in the
[CLI README](https://github.com/superwall/cli#telemetry). The plugin includes
no automatic hooks or background processes. Review the
[privacy policy](https://superwall.com/legal/privacy-policy) and
[terms](https://superwall.com/legal/terms-of-service/). For help, use the
[support center](https://superwall.com/docs/support).
