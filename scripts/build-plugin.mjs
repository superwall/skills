import assert from "node:assert/strict"
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(root, "plugins", "superwall")
const check = process.argv.includes("--check")
const temporaryRoot = check ? mkdtempSync(join(tmpdir(), "superwall-plugin-")) : null
const destination = check ? join(temporaryRoot, "superwall") : join(root, "dist", "superwall")
const skillNames = ["superwall", "superwall-editor"]
const json = (path) => JSON.parse(readFileSync(path, "utf8"))
const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? markdownFiles(path) : path.endsWith(".md") ? [path] : []
  })

try {
  assert.deepEqual(
    readdirSync(join(source, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    ["superwall-account"],
    "Plugin source must contain only the connector-specific skill",
  )

  rmSync(destination, { recursive: true, force: true })
  cpSync(source, destination, { recursive: true })
  for (const name of skillNames) {
    const skillSource = join(root, "skills", name)
    assert.ok(existsSync(join(skillSource, "SKILL.md")), `Missing canonical ${name} skill`)
    cpSync(skillSource, join(destination, "skills", name), { recursive: true })
  }

  const portable = json(join(destination, "plugin.json"))
  const codex = json(join(destination, ".codex-plugin", "plugin.json"))
  const claude = json(join(destination, ".claude-plugin", "plugin.json"))
  const portableMcp = json(join(destination, "mcp.json"))
  const claudeMcp = json(join(destination, ".mcp.json"))

  for (const manifest of [codex, claude]) {
    assert.equal(manifest.name, portable.name, "Plugin names must match")
    assert.equal(manifest.version, portable.version, "Plugin versions must match")
  }
  assert.equal(
    claudeMcp.mcpServers.superwall.url,
    portableMcp.mcpServers.superwall.url,
    "Plugin MCP URLs must match",
  )
  assert.equal(
    portable.$schema.replace("plugin.schema.json", "mcp.schema.json"),
    portableMcp.$schema,
    "Portable manifest schemas must use the same Agent Plugins version",
  )
  assert.deepEqual(
    readdirSync(join(destination, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    [...skillNames, "superwall-account"].sort(),
    "Package must contain exactly the public Superwall skills",
  )
  for (const file of markdownFiles(join(destination, "skills"))) {
    for (const match of readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0]
      if (!target || /^(https?:|mailto:|\/)/.test(target)) continue
      assert.ok(existsSync(resolve(dirname(file), target)), `Missing link target ${target} in ${file}`)
    }
  }

  console.log(check ? "Plugin package validates." : `Built plugin at ${destination}`)
} finally {
  if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
}
