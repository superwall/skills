import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const check = process.argv.includes("--check")
const sync = process.argv.includes("--sync")
assert.ok(!(check && sync), "Use either --check or --sync")
const skillNames = ["superwall", "superwall-editor"]
const trackedEntries = execFileSync(
  "git",
  ["ls-files", "--stage", "-z", "--", "plugins/superwall", ...skillNames.map((name) => `skills/${name}`)],
  { cwd: root },
).toString().split("\0").filter(Boolean).map((entry) => {
  const [metadata, path] = entry.split("\t")
  const [mode, , stage] = metadata.split(" ")
  assert.equal(stage, "0", `Resolve the Git conflict in ${path}`)
  assert.ok(["100644", "100755"].includes(mode), `Expected a tracked regular file: ${path}`)
  return { path, mode }
})
const trackedFiles = trackedEntries.map(({ path }) => path)
const trackedModes = new Map(trackedEntries.map(({ path, mode }) => [path, mode]))
const json = (path) => JSON.parse(readFileSync(path, "utf8"))
const regularFile = (file) => {
  let path = join(root, file)
  assert.ok(existsSync(path), `Missing tracked file: ${file}`)
  const stat = lstatSync(path)
  assert.ok(stat.isFile(), `Expected a regular file: ${file}`)
  for (path = dirname(path); path !== root; path = dirname(path)) {
    assert.ok(lstatSync(path).isDirectory(), `Expected a regular directory: ${path}`)
  }
  assert.equal(Boolean(stat.mode & 0o111), trackedModes.get(file) === "100755", `Executable mode differs from Git: ${file}`)
  return stat
}
const copyTracked = (prefix, target) => {
  const files = trackedFiles.filter((file) => file.startsWith(`${prefix}/`))
  assert.ok(files.length > 0, `No tracked files found in ${prefix}`)
  for (const file of files) {
    const sourceFile = join(root, file)
    const stat = regularFile(file)
    const targetFile = join(target, file.slice(prefix.length + 1))
    mkdirSync(dirname(targetFile), { recursive: true })
    cpSync(sourceFile, targetFile)
    chmodSync(targetFile, stat.mode & 0o777)
  }
}
const generatedSkills = join(root, "plugins", "superwall", "skills")
for (const name of skillNames) {
  assert.ok(trackedFiles.includes(`skills/${name}/SKILL.md`), `Missing canonical ${name} skill`)
}
if (sync) {
  for (const file of trackedFiles.filter((file) => file.startsWith("skills/"))) regularFile(file)
  rmSync(generatedSkills, { recursive: true, force: true })
  for (const name of skillNames) copyTracked(`skills/${name}`, join(generatedSkills, name))
  console.log("Synced plugin skills. Stage plugins/superwall/skills with the canonical changes, then run npm run plugin:check.")
  process.exit(0)
}

const canonicalFiles = trackedFiles.filter((file) => file.startsWith("skills/"))
const packagedFiles = trackedFiles.filter((file) => file.startsWith("plugins/superwall/skills/"))
const syncHint = "Run npm run plugin:sync and stage the generated skills."
assert.deepEqual(
  packagedFiles.map((file) => file.slice("plugins/superwall/".length)).sort(),
  canonicalFiles.slice().sort(),
  `Plugin skill file set differs from canonical skills. ${syncHint}`,
)
for (const source of canonicalFiles) {
  const packaged = `plugins/superwall/${source}`
  regularFile(source)
  regularFile(packaged)
  assert.equal(trackedModes.get(packaged), trackedModes.get(source), `Plugin skill mode differs: ${packaged}. ${syncHint}`)
  assert.ok(readFileSync(join(root, source)).equals(readFileSync(join(root, packaged))), `Plugin skill contents differ: ${packaged}. ${syncHint}`)
}

const temporaryRoot = check ? mkdtempSync(join(tmpdir(), "superwall-plugin-")) : null
const destination = check ? join(temporaryRoot, "superwall") : join(root, "dist", "superwall")
const markdownFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? markdownFiles(path) : path.endsWith(".md") ? [path] : []
  })

try {
  rmSync(destination, { recursive: true, force: true })
  copyTracked("plugins/superwall", destination)

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
    skillNames,
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
