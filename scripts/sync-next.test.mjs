import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const branch = "sync/main-into-next"

const workflowScript = () => {
  const lines = readFileSync(join(root, ".github/workflows/sync-next.yml"), "utf8").split("\n")
  const start = lines.findIndex((line) => line.trim() === "run: |")
  assert.notEqual(start, -1, "sync-next.yml has no run: | block")
  const indent = lines[start + 1].match(/^ */)[0].length
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.match(/^ */)[0].length < indent) break
    body.push(line.slice(indent))
  }
  return body.join("\n")
}

const fixture = (t, { conflict = true } = {}) => {
  const directory = mkdtempSync(join(tmpdir(), "superwall-sync-next-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const origin = join(directory, "origin.git")
  const author = join(directory, "author")
  const runner = join(directory, "runner")
  const bin = join(directory, "bin")
  const log = join(directory, "gh-calls")
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
  const commit = (path, contents, message) => {
    mkdirSync(dirname(join(author, path)), { recursive: true })
    writeFileSync(join(author, path), contents)
    git(author, "add", path)
    git(author, "commit", "-q", "-m", message)
    return git(author, "rev-parse", "HEAD")
  }

  git(directory, "init", "-q", "--bare", "-b", "main", origin)
  git(directory, "init", "-q", "-b", "main", author)
  git(author, "config", "user.name", "Author")
  git(author, "config", "user.email", "author@example.com")
  git(author, "config", "commit.gpgsign", "false")
  git(author, "remote", "add", "origin", origin)
  commit("skill.md", "shared\n", "base")
  git(author, "checkout", "-q", "-b", "next")
  commit("skill.md", "beta\n", "beta edit")
  git(author, "checkout", "-q", "main")
  const mainHead = conflict ? commit("skill.md", "main\n", "main edit") : commit("other.md", "main\n", "main addition")
  git(author, "push", "-q", "origin", "main", "next")

  mkdirSync(bin)
  writeFileSync(
    join(bin, "gh"),
    `#!${process.execPath}\n` +
      `const fs = require("fs"), args = process.argv.slice(2);\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");\n` +
      `if (args[0] === "pr" && args[1] === "list") process.stdout.write(process.env.FAKE_OPEN_PR ? process.env.FAKE_OPEN_PR + "\\n" : "");\n`,
  )
  chmodSync(join(bin, "gh"), 0o755)

  const pushBranch = (ref) => git(author, "push", "-q", "--force", "origin", `${ref}:refs/heads/${branch}`)
  const run = ({ openPr } = {}) => {
    rmSync(runner, { recursive: true, force: true })
    git(directory, "clone", "-q", "--branch", "next", origin, runner)
    git(runner, "config", "commit.gpgsign", "false")
    const result = spawnSync("bash", ["-e", "-c", workflowScript()], {
      cwd: runner,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        GITHUB_REPOSITORY: "superwall/skills",
        FAKE_OPEN_PR: openPr ?? "",
        GIT_TERMINAL_PROMPT: "0",
      },
    })
    const calls = existsSync(log)
      ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
      : []
    return { ...result, calls }
  }
  const remote = (ref) => {
    try {
      return git(directory, "--git-dir", origin, "rev-parse", "--verify", "-q", `refs/heads/${ref}`)
    } catch {
      return undefined
    }
  }
  const isAncestor = (ancestor, ref) =>
    spawnSync("git", ["--git-dir", origin, "merge-base", "--is-ancestor", ancestor, ref]).status === 0
  return { author, git, commit, mainHead, pushBranch, run, remote, isAncestor }
}

const listCall = (calls) => calls.find((call) => call[0] === "pr" && call[1] === "list")
const bodyOf = (call) => call[call.indexOf("--body") + 1]

test("a clean merge is pushed straight to next and asks GitHub nothing", (t) => {
  const repo = fixture(t, { conflict: false })
  const result = repo.run()
  assert.equal(result.status, 0, result.stderr)
  assert.equal(repo.isAncestor(repo.mainHead, "refs/heads/next"), true)
  assert.deepEqual(result.calls, [])
  assert.equal(repo.remote(branch), undefined)
})

test("a conflict with no open sync pull request opens one, whatever merged before", (t) => {
  const repo = fixture(t)
  const result = repo.run()
  assert.equal(result.status, 1)
  assert.equal(repo.remote(branch), repo.mainHead)
  const list = listCall(result.calls)
  assert.ok(list, "the workflow asks for open pull requests")
  assert.deepEqual(list.slice(list.indexOf("--state"), list.indexOf("--state") + 2), ["--state", "open"])
  assert.deepEqual(list.slice(list.indexOf("--base"), list.indexOf("--base") + 2), ["--base", "next"])
  const create = result.calls.find((call) => call[0] === "pr" && call[1] === "create")
  assert.ok(create, "the workflow opens a pull request")
  assert.match(bodyOf(create), /skill\.md/)
  assert.match(bodyOf(create), /merge commit, never a squash/)
  assert.equal(result.calls.some((call) => call[1] === "view"), false)
})

test("a conflict with an open sync pull request comments on it by number", (t) => {
  const repo = fixture(t)
  const result = repo.run({ openPr: `42 ${branch}` })
  assert.equal(result.status, 1)
  const comment = result.calls.find((call) => call[0] === "pr" && call[1] === "comment")
  assert.ok(comment, "the workflow comments on the open pull request")
  assert.equal(comment[2], "42")
  assert.match(bodyOf(comment), /skill\.md/)
  assert.equal(result.calls.some((call) => call[1] === "create"), false)
})

test("a sync branch holding a resolution in progress is kept, and the comment says main moved", (t) => {
  const repo = fixture(t)
  repo.git(repo.author, "checkout", "-q", "-b", "resolving", repo.mainHead)
  const resolution = repo.commit("notes.md", "half resolved\n", "resolution in progress")
  repo.pushBranch("resolving")
  const result = repo.run({ openPr: `42 ${branch}` })
  assert.equal(result.status, 1)
  assert.equal(repo.remote(branch), resolution)
  const comment = result.calls.find((call) => call[1] === "comment")
  assert.match(bodyOf(comment), /main moved while this branch holds a resolution in progress/)
})

test("a sync branch whose commits already reached next is reset to main", (t) => {
  const repo = fixture(t)
  repo.git(repo.author, "checkout", "-q", "next")
  repo.git(repo.author, "pull", "-q", "origin", "next")
  const old = repo.commit("old.md", "merged long ago\n", "old sync resolution")
  repo.git(repo.author, "push", "-q", "origin", "next")
  repo.pushBranch(old)
  const result = repo.run()
  assert.equal(result.status, 1)
  assert.equal(repo.remote(branch), repo.mainHead)
  const create = result.calls.find((call) => call[1] === "create")
  assert.doesNotMatch(bodyOf(create), /resolution in progress/)
})

test("an open pull request from another sync branch gets the comment, and sync/main-into-next is left alone", (t) => {
  const repo = fixture(t)
  const result = repo.run({ openPr: `75 ${branch}-resolved` })
  assert.equal(result.status, 1)
  assert.equal(repo.remote(branch), undefined)
  const comment = result.calls.find((call) => call[1] === "comment")
  assert.ok(comment, "the workflow comments on the open pull request")
  assert.equal(comment[2], "75")
  assert.match(bodyOf(comment), new RegExp(`main moved while ${branch}-resolved holds the resolution`))
  assert.equal(result.calls.some((call) => call[1] === "create"), false)
})
