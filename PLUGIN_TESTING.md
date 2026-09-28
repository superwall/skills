# Test the Superwall plugin

Test the generated package, not `plugins/superwall`: the source directory contains
only the connector-specific skill. Build the complete package from the canonical
skills before each round of tests.

```bash
npm run plugin:build
npm run plugin:check
claude plugin validate ./dist/superwall
bash -n ./dist/superwall/skills/superwall-editor/scripts/sw-editor.sh
```

The package should contain exactly `superwall`, `superwall-editor`, and
`superwall-account` under `dist/superwall/skills/`. Confirm that `wwdc` is absent.
Use a dedicated Superwall test organization for write tests. Keep a small sample
app repository and a test paywall editor session for the two local coding skills.

## Shared behavior checks

Run the same prompts in each agent where that capability exists, and record the
skill chosen, tools called, account/project scope, outcome, and any error. Use
a fresh conversation after changing a skill or MCP tool definition.

| Prompt | Expected behavior |
| --- | --- |
| “List the projects I can access and summarize the products in my test project.” | `superwall-account` uses the MCP connector, verifies the signed-in account, and reads only the intended project. |
| “Review the Superwall SDK setup in this sample app. Do not edit files.” | In a coding agent, `superwall` reads the repository and relevant framework playbook. It can begin without CLI login. |
| “Attach to this test paywall editor and list the tools available right now.” | In a local coding agent, `superwall-editor` attaches with a current pairing code or authorized launch and asks the browser for its tool list. |
| “What is the weather today?” | No Superwall skill or tool activates. |
| “Create a test entitlement in my test project.” | Only in the test organization: inspect scope and existing state, perform the requested write, then read the result back. |

Also try an ambiguous project name, an unauthenticated session, a nonexistent
resource ID, and a request to change a real account without naming the target.
Check that the agent asks for the missing scope instead of guessing. A test
against an account with sensitive data should use read-only prompts.

## ChatGPT and Codex

1. In ChatGPT Developer mode, register
   `https://superwall-mcp.superwall.com/mcp` as an MCP connection. Use MCP
   Inspector or the ChatGPT connection details to check tool discovery, OAuth,
   and a read-only call first.
2. For a combined local package test, make a disposable local marketplace entry
   pointing to `dist/superwall`. OpenAI's local test flow uses the technical
   `plugin_asdk_app...` ID of the registered connection in `.app.json`. Have
   `$plugin-creator` wire that ID into a **test copy** of the package; do not
   put a personal connection ID in the release artifact. Install from the local
   source in the Plugins Directory and start a new chat.
3. Run the shared prompts in ChatGPT and Codex. Check that the account skill
   routes to MCP, while code and editor skills activate only when a local
   coding environment can perform them. Refresh the MCP connection after any
   server metadata change.

See [OpenAI's test flow](https://developers.openai.com/plugins/deploy/connect-chatgpt)
and [local package setup](https://developers.openai.com/plugins/build/plugins).
Local testing does not replace the later public submission scan and review.

## Claude Code and Claude chat

`claude plugin validate ./dist/superwall` checks the manifest and skill
frontmatter. For a live Claude Code session, sign in to Claude Code and run:

```bash
claude --plugin-dir ./dist/superwall
```

Confirm the three skills are available, then run the shared prompts in a fresh
session. Explicit invocation is useful for diagnosing routing:
`/superwall:superwall-account`, `/superwall:superwall`, and
`/superwall:superwall-editor`. Test automatic selection separately. In Claude
chat or Cowork, upload the generated plugin as a custom plugin, connect the
Superwall account, and test the account prompt; the local CLI and editor
workflows need a coding environment with terminal access. See
[Claude Code local loading](https://code.claude.com/docs/en/plugins/create) and
[Claude plugin use](https://support.claude.com/en/articles/13837440-use-plugins-in-claude).

## Cursor

Copy the generated `dist/superwall` directory to
`~/.cursor/plugins/local/superwall`. Reload Cursor, open Customize, and confirm
all three skills and the MCP server appear. Run the shared prompts in a fresh
agent chat. Copy the directory again and reload after edits; Cursor does not
load a symlink to a target outside its local plugin folder. A team or public
marketplace test comes later from the published generated package. See
[Cursor's local plugin instructions](https://cursor.com/docs/plugins).

## Grok Build

If Grok Build is installed, validate and inspect the local generated package:

```bash
grok plugin validate ./dist/superwall
grok plugin install ./dist/superwall --trust
grok plugin details superwall
```

Start a new session or reload plugins, then run the shared prompts. Use a test
account for writes. See [Grok Build's plugin guide](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/09-plugins.md).

## Muse Code

If Muse Code is installed, validate the package and each skill before installing:

```bash
muse plugins validate ./dist/superwall
muse skills validate ./dist/superwall/skills/superwall
muse skills validate ./dist/superwall/skills/superwall-editor
muse skills validate ./dist/superwall/skills/superwall-account
muse plugins install ./dist/superwall
muse plugins inspect superwall
```

Inspect the runtime capability IDs, then approve the Superwall MCP connection
you intend to test with `muse plugins approve <capability-id>`. Start a new
session and run the shared prompts. The portable `plugin.json` is authoritative
for Muse; additional compatibility manifests may produce a warning. See
[Muse's plugin CLI](https://meta-models.github.io/muse-code-sdk/next/guides/plugins/reference/cli/)
and [format compatibility](https://meta-models.github.io/muse-code-sdk/next/guides/plugins/concepts/compatibility/).
