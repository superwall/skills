#!/usr/bin/env -S node --experimental-strip-types
import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { SYNCED_SKILLS, type SyncedSkill } from "./sync-skills.config.ts"

const API = "https://api.anthropic.com/v1"
const BETA = "skills-2025-10-02,managed-agents-2026-04-01"
const VERSION_HEADER = "2023-06-01"

const { ANTHROPIC_API_KEY, DRY_RUN, FORCE_SYNC } = process.env
const dryRun = DRY_RUN === "1" || DRY_RUN === "true"
const forceSync = FORCE_SYNC === "1" || FORCE_SYNC === "true"

if (!ANTHROPIC_API_KEY && !dryRun) {
  throw new Error("ANTHROPIC_API_KEY is required (or set DRY_RUN=1)")
}

const HEADERS: Record<string, string> = {
  "anthropic-version": VERSION_HEADER,
  "anthropic-beta": BETA,
}
if (ANTHROPIC_API_KEY) HEADERS["x-api-key"] = ANTHROPIC_API_KEY

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

type BuiltBundle = {
  form: FormData
  hash: string
  files: Array<{ path: string; bytes: number }>
}

function buildBundle(skill: SyncedSkill): BuiltBundle {
  const form = new FormData()
  const hasher = createHash("sha256")
  const audit: Array<{ path: string; bytes: number }> = []

  const entries: Array<[string, string]> = [[`${skill.directory}/SKILL.md`, skill.skillMd]]
  for (const f of skill.files) {
    const absolute = resolve(repoRoot, f.source)
    const content = readFileSync(absolute, "utf-8")
    entries.push([`${skill.directory}/${f.target}`, content])
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]))
  for (const [path, content] of entries) {
    hasher.update(path)
    hasher.update("\0")
    hasher.update(content)
    hasher.update("\0")
    form.append("files[]", new Blob([content], { type: "text/markdown" }), path)
    audit.push({ path, bytes: Buffer.byteLength(content, "utf-8") })
  }

  return { form, hash: hasher.digest("hex"), files: audit }
}

function sourcesForSkill(skill: SyncedSkill): string[] {
  return skill.files.map((f) => f.source)
}

function anySourceChanged(skill: SyncedSkill): boolean {
  if (forceSync) return true
  const eventName = process.env.GITHUB_EVENT_NAME
  const before = process.env.GITHUB_EVENT_BEFORE
  const sha = process.env.GITHUB_SHA

  if (eventName !== "push") return true
  if (!before || /^0+$/.test(before)) return true
  if (!sha) return true

  const sources = [
    ...sourcesForSkill(skill),
    "scripts/sync-skills.config.ts",
    "scripts/sync-managed-agent.ts",
  ]

  try {
    const out = execSync(
      `git diff --name-only ${before} ${sha} -- ${sources.map((s) => JSON.stringify(s)).join(" ")}`,
      { cwd: repoRoot, encoding: "utf-8" }
    ).trim()
    return out.length > 0
  } catch (err) {
    console.warn(`git diff failed for ${skill.name}; defaulting to sync.`, err)
    return true
  }
}

async function findSkillIdByName(name: string): Promise<string | null> {
  let page: string | undefined
  while (true) {
    const url = new URL(`${API}/skills`)
    url.searchParams.set("source", "custom")
    url.searchParams.set("limit", "100")
    if (page) url.searchParams.set("page", page)

    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) {
      throw new Error(`list skills failed: ${res.status} ${await res.text()}`)
    }

    const body = (await res.json()) as {
      data: Array<{ id: string; display_title: string | null }>
      next_page?: string | null
    }
    const match = body.data.find((s) => s.display_title === name)
    if (match) return match.id
    if (!body.next_page) return null
    page = body.next_page
  }
}

async function createSkill(skill: SyncedSkill, bundle: BuiltBundle): Promise<{ skillId: string; version: string }> {
  bundle.form.append("display_title", skill.name)
  const res = await fetch(`${API}/skills`, { method: "POST", headers: HEADERS, body: bundle.form })
  if (!res.ok) throw new Error(`create skill failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { id: string; latest_version: string }
  return { skillId: body.id, version: body.latest_version }
}

async function createSkillVersion(skillId: string, bundle: BuiltBundle): Promise<{ version: string }> {
  const res = await fetch(`${API}/skills/${skillId}/versions`, {
    method: "POST",
    headers: HEADERS,
    body: bundle.form,
  })
  if (!res.ok) throw new Error(`create skill version failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { version: string }
  return { version: body.version }
}

type AgentSkillRef = { skill_id: string; type: "custom" | "anthropic"; version?: string }

async function getAgent(
  agentId: string
): Promise<{ version: number; skills: AgentSkillRef[] }> {
  const res = await fetch(`${API}/agents/${agentId}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`get agent ${agentId} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as { version: number; skills: AgentSkillRef[] }
}

async function reconcileAgentSkills(agentId: string, expectedCustomSkillIds: Set<string>) {
  const header = `[agent ${agentId}]`
  const agent = await getAgent(agentId)

  const currentCustom = new Set(
    agent.skills.filter((s) => s.type === "custom").map((s) => s.skill_id)
  )
  const anthropicSkills = agent.skills.filter((s) => s.type === "anthropic")

  const toAdd = [...expectedCustomSkillIds].filter((id) => !currentCustom.has(id))
  const toRemove = [...currentCustom].filter((id) => !expectedCustomSkillIds.has(id))

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log(`${header} in sync (${currentCustom.size} custom, ${anthropicSkills.length} anthropic)`)
    return
  }

  console.log(`${header} reconciling: +${toAdd.length} -${toRemove.length}`)
  for (const id of toAdd) console.log(`    + ${id}`)
  for (const id of toRemove) console.log(`    - ${id}`)

  if (dryRun) {
    console.log(`${header} DRY_RUN=1 — skipping reconcile`)
    return
  }

  const skills: AgentSkillRef[] = [
    ...anthropicSkills.map((s) => ({
      type: "anthropic" as const,
      skill_id: s.skill_id,
      ...(s.version ? { version: s.version } : {}),
    })),
    ...[...expectedCustomSkillIds].map((id) => ({ type: "custom" as const, skill_id: id })),
  ]

  const res = await fetch(`${API}/agents/${agentId}`, {
    method: "POST",
    headers: { ...HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ version: agent.version, skills }),
  })
  if (!res.ok) throw new Error(`reconcile agent ${agentId} failed: ${res.status} ${await res.text()}`)
  console.log(`${header} reconciled.`)
}

async function resolveSkillId(skill: SyncedSkill): Promise<string | null> {
  const header = `[${skill.name}]`
  const sourceChanged = anySourceChanged(skill)
  const existingId = await findSkillIdByName(skill.name)

  if (!sourceChanged && existingId) {
    console.log(`${header} no source file changed; keeping ${existingId}.`)
    return existingId
  }

  if (!sourceChanged && !existingId) {
    console.log(`${header} no source file changed but skill does not exist yet; creating anyway.`)
  }

  const bundle = buildBundle(skill)
  const totalBytes = bundle.files.reduce((sum, f) => sum + f.bytes, 0)
  console.log(
    `${header} bundle: ${bundle.files.length} files, ${totalBytes} bytes, sha256=${bundle.hash.slice(0, 16)}…`
  )
  for (const f of bundle.files) {
    console.log(`    ${f.path}  ${f.bytes}B`)
  }

  if (dryRun) {
    console.log(`${header} DRY_RUN=1 — would ${existingId ? "upload new version" : "create"}.`)
    return existingId
  }

  if (existingId) {
    console.log(`${header} found existing skill ${existingId}; uploading new version…`)
    const { version } = await createSkillVersion(existingId, bundle)
    console.log(`${header} created version ${version}`)
    return existingId
  }

  console.log(`${header} no existing skill; creating…`)
  const result = await createSkill(skill, bundle)
  console.log(`${header} created skill ${result.skillId} at version ${result.version}`)
  return result.skillId
}

async function main() {
  if (SYNCED_SKILLS.length === 0) {
    console.log("No synced skills configured. Nothing to do.")
    return
  }
  console.log(`Syncing ${SYNCED_SKILLS.length} skill(s)${dryRun ? " (DRY RUN)" : ""}…`)

  const agentExpected = new Map<string, Set<string>>()
  for (const skill of SYNCED_SKILLS) {
    const skillId = await resolveSkillId(skill)
    if (!skillId) continue
    for (const agentId of skill.agentIds) {
      if (!agentExpected.has(agentId)) agentExpected.set(agentId, new Set())
      agentExpected.get(agentId)!.add(skillId)
    }
  }

  for (const [agentId, expected] of agentExpected) {
    await reconcileAgentSkills(agentId, expected)
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
