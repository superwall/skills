# Test the Superwall plugin

Test the generated package, not `plugins/superwall`: the source directory does
not contain the canonical skills. Build the complete package before each round
of tests.

```bash
npm run plugin:build
npm run plugin:check
claude plugin validate --strict ./dist/superwall
bash -n ./dist/superwall/skills/superwall-editor/scripts/sw-editor.sh
```

The package should contain exactly `superwall` and `superwall-editor` under
`dist/superwall/skills/`. Confirm that `wwdc` is absent.
The build copies Git-tracked files, including their current local edits. Stage
new package files before testing them; untracked files, including local secrets
and session state, are excluded. `plugin:check` verifies package contents,
manifest consistency, and relative Markdown links; it is not a full JSON Schema
validator and does not exercise a client's runtime.
Use a dedicated Superwall test organization for write tests. Keep a small sample
app repository and a test paywall editor session for the two local coding skills.

For deeper package validation, validate `plugin.json` and `mcp.json` against
their published `$schema` URLs with a JSON Schema Draft 2020-12 validator.
Compare packaged skills to the canonical files, including executable modes.
In a disposable checkout, add synthetic ignored `.env` and session-state files
and confirm the build excludes them; change a manifest version or a reference
link and confirm `plugin:check` fails. Keep these fixtures out of release files.

Use a localhost mock relay to exercise the packaged editor script's
attach → tools → call → release and expose → wait flows without a real account.
Check JSON arguments, tool errors, stale-token cleanup, and state-file
permissions. A mock test verifies the CLI lifecycle; the live editor test below
verifies browser pairing and the current tool schemas.

## Client capabilities

These are the documented capabilities to test, not a record of completed live
tests. Record the client version alongside each result.

| Client | Bundled skills | Bundled remote MCP | Test setup |
| --- | --- | --- | --- |
| ChatGPT / Codex | Code and editor workflows need a workspace with terminal access | Yes; use the registered connection flow for the ChatGPT local test copy | Local marketplace and a new chat |
| Claude Code | Yes | Yes | `claude --plugin-dir ./dist/superwall` |
| Claude chat / Cowork | Code and editor workflows need an environment with the required files and tools | Yes | Custom plugin upload and account connection |
| Cursor | Yes | Yes | Copy to the local plugin directory and reload |
| Grok Build | Yes | Yes | Validate and install the generated package |
| Muse Code | Yes | Inactive in its current Agent Plugins adapter | Validate and install; test skills and CLI fallback |

The editor script needs Bash, `curl`, and `jq`. On Windows, run it in an
environment that provides them, such as WSL. Use a recognized identity for
`--agent-name` (`codex`, `claude`, or `cursor`, for example); use `other` for Grok
Build, Muse Code, or any agent the script does not recognize.

## Shared behavior checks

Run the same prompts in each agent where that capability exists, and record the
skill activation, tools called, account/project scope, outcome, and any error. Use
a fresh conversation after changing a skill or MCP tool definition.

| Prompt | Expected behavior |
| --- | --- |
| “List the projects I can access and summarize the products in my test project.” | The agent uses MCP tools directly, verifies the signed-in account, and reads only the intended project. |
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
   source in the Plugins Directory and start a new chat. This `.app.json` test
   copy cannot be submitted as a public plugin ZIP.
3. Run the shared prompts in ChatGPT and Codex. Check that account prompts use
   MCP tools, while code and editor skills activate only when a local
   coding environment can perform them. Refresh the MCP connection after any
   server metadata change.

See [OpenAI's test flow](https://developers.openai.com/plugins/deploy/connect-chatgpt)
and [local package setup](https://developers.openai.com/plugins/build/plugins).
Local testing does not replace the later public submission scan and review.

## Claude Code and Claude chat

`claude plugin validate --strict ./dist/superwall` checks the manifest and skill
frontmatter and fails on warnings. For a live Claude Code session, sign in to
Claude Code and run:

```bash
claude --plugin-dir ./dist/superwall
```

Confirm the two skills are available, then run the shared prompts in a fresh
session. Explicit invocation is useful for diagnosing local skill routing:
`/superwall:superwall` and `/superwall:superwall-editor`. Test automatic
selection and direct MCP tool use separately. In Claude
chat or Cowork, upload the generated plugin as a custom plugin, connect the
Superwall account, and test the account prompt; the local CLI and editor
workflows need a coding environment with terminal access. See
[Claude Code local loading](https://code.claude.com/docs/en/plugins/create) and
[Claude plugin use](https://support.claude.com/en/articles/13837440-use-plugins-in-claude).

Claude Code also offers [plugin evals](https://code.claude.com/docs/en/plugin-evals)
for isolated behavior tests. Keep cases outside the release package and run
them against a disposable copy with `--runs 1 --mocks record --no-publish`.
Use fixtures and mocked MCP results to check automatic skill activation, SDK
review without CLI login, account scope selection, CLI fallback, and unrelated
prompts. The default eval flow disables real MCP servers and can compare the
plugin against a run without it. Evals consume model usage and may require
early access; they do not verify OAuth or the real relay.

## Cursor

Copy the generated `dist/superwall` directory to
`~/.cursor/plugins/local/superwall`. Reload Cursor, open Customize, and confirm
both skills and the MCP server appear. Run the shared prompts in a fresh
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
muse plugins install ./dist/superwall
muse plugins inspect superwall
```

The portable `plugin.json` is authoritative for Muse. Its current adapter
imports the two skills but reports the bundled remote MCP server as unsupported
and inactive; compatibility overlays are also inactive. Approval cannot enable
that server. Start a new session and test SDK review and the CLI fallback for
account operations. Use `--agent-name other` for the editor workflow. See
[Muse's plugin CLI](https://meta-models.github.io/muse-code-sdk/next/guides/plugins/reference/cli/)
and [format compatibility](https://meta-models.github.io/muse-code-sdk/next/guides/plugins/concepts/compatibility/).

## OpenAI public submission

Public listing and review requirements are a separate release gate. The current
package has listing text and product/privacy/terms URLs. Supply the support URL,
`https://superwall.com/docs/support`, in the submission dashboard. Distribution
still needs square `logo` and `composerIcon` assets referenced in the OpenAI interface.
Codex package validation requires both. A portable ZIP can be uploaded without
them, but the dashboard requires a primary icon before submission. Review test
cases and a demo URL can be supplied in the dashboard instead of committed to
the package. Keep credentials, personal connection IDs, and account-specific
test transcripts outside this public repository.

Build a fresh package and ZIP its contents with `plugin.json` and `mcp.json` at
the ZIP root. Do not upload the local test copy: public submission currently
rejects packages containing `apps`, `.app.json`, or lifecycle hooks. Check the
ZIP for credentials and local runtime files before uploading it.

Upload the ZIP to create a draft, clear package and skill findings, then connect
the declared remote MCP server in the dashboard. Complete domain verification,
OAuth, and the tool scan there. Prepare a dedicated reviewer account with sample
data, run exactly five positive and three negative test cases, and provide a
video walkthrough URL and release notes. Enter reviewer credentials privately
in the dashboard. Submit for review, then publish after approval. See
[OpenAI's submission guide](https://developers.openai.com/plugins/deploy/submission).
