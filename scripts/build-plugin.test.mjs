import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixture = (t) => {
  const directory = mkdtempSync(join(tmpdir(), "superwall-plugin-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const write = (path, contents) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true })
    writeFileSync(join(directory, path), contents)
  }
  const git = (...args) => execFileSync("git", args, { cwd: directory })
  const run = (...args) => spawnSync(process.execPath, [join(directory, "scripts/build-plugin.mjs"), ...args], { cwd: directory, encoding: "utf8" })
  const pass = (...args) => {
    const result = run(...args)
    assert.equal(result.status, 0, result.stderr)
  }
  const fail = (pattern, ...args) => {
    const result = run(...args)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, pattern)
  }
  for (const path of ["plugin.json", "mcp.json", ".mcp.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]) {
    write(`plugins/superwall/${path}`, readFileSync(join(root, "plugins/superwall", path)))
  }
  write("scripts/build-plugin.mjs", readFileSync(join(root, "scripts/build-plugin.mjs")))
  write(".gitignore", ".env\n.superwall/\ndist/\n")
  for (const name of ["superwall", "superwall-editor"]) {
    write(`skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: Fixture\n---\n[Reference](reference.md)\n`)
    write(`skills/${name}/reference.md`, "Fixture reference\n")
  }
  write("skills/superwall-editor/scripts/sw-editor.sh", "#!/bin/sh\nexit 0\n")
  chmodSync(join(directory, "skills/superwall-editor/scripts/sw-editor.sh"), 0o755)
  git("init", "--quiet")
  git("add", ".")
  pass("--sync")
  git("add", "plugins/superwall/skills")
  return { directory, write, git, pass, fail }
}

test("sync and export exclude ignored credentials and session state", (t) => {
  const f = fixture(t)
  f.write("skills/superwall/.env", "SYNTHETIC_SECRET=fixture\n")
  f.write("skills/superwall-editor/.superwall/state.json", "{}\n")
  f.pass("--sync")
  f.pass("--check")
  f.pass()
  assert.equal(existsSync(join(f.directory, "dist/superwall/skills/superwall/.env")), false)
  assert.equal(existsSync(join(f.directory, "dist/superwall/skills/superwall-editor/.superwall")), false)
})

test("stale skill contents fail before export and sync repairs them", (t) => {
  const f = fixture(t)
  f.write("plugins/superwall/skills/superwall/reference.md", "Stale copy\n")
  f.fail(/Plugin skill contents differ/, "--check")
  f.fail(/Plugin skill contents differ/)
  f.pass("--sync")
  f.pass("--check")
})

test("a missing tracked copy is rejected and regenerated", (t) => {
  const f = fixture(t)
  rmSync(join(f.directory, "plugins/superwall/skills/superwall/reference.md"))
  f.fail(/Missing tracked file/, "--check")
  f.pass("--sync")
  f.pass("--check")
})

test("extra tracked plugin files fail and sync removes them", (t) => {
  const f = fixture(t)
  f.write("plugins/superwall/skills/superwall/extra.md", "Unexpected file\n")
  f.git("add", "plugins/superwall/skills")
  f.fail(/Plugin skill file set differs/, "--check")
  f.pass("--sync")
  f.git("add", "plugins/superwall/skills")
  f.pass("--check")
})

test("canonical additions and deletions require refreshed staged copies", (t) => {
  const f = fixture(t)
  f.write("skills/superwall/new.md", "New reference\n")
  f.git("add", "skills")
  f.fail(/Plugin skill file set differs/, "--check")
  f.pass("--sync")
  f.git("add", "plugins/superwall/skills")
  f.pass("--check")
  rmSync(join(f.directory, "skills/superwall/new.md"))
  f.git("add", "skills")
  f.fail(/Plugin skill file set differs/, "--check")
  f.pass("--sync")
  f.git("add", "plugins/superwall/skills")
  f.pass("--check")
})

test("executable mode drift fails and sync preserves canonical permissions", (t) => {
  const f = fixture(t)
  const path = "plugins/superwall/skills/superwall-editor/scripts/sw-editor.sh"
  chmodSync(join(f.directory, path), 0o644)
  f.fail(/Executable mode differs from Git/, "--check")
  f.git("add", path)
  f.fail(/Plugin skill mode differs/, "--check")
  f.pass("--sync")
  f.git("add", path)
  f.pass("--check")
})

test("tracked symlinks cannot supply packaged skills", (t) => {
  const f = fixture(t)
  const path = "plugins/superwall/skills/superwall/reference.md"
  rmSync(join(f.directory, path))
  symlinkSync("../../../../skills/superwall/reference.md", join(f.directory, path))
  f.git("add", path)
  f.fail(/Expected a tracked regular file/, "--check")
})
