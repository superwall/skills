/// <reference types="bun" />
// `npx skills add` parses each SKILL.md frontmatter as YAML and skips any file
// that fails. An unquoted description containing ": " is read as a nested
// mapping, so these tests parse every frontmatter the way an installer would.
import { describe, expect, test } from "bun:test"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const parseFrontmatter = (markdown: string): Record<string, unknown> => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error("no frontmatter block between --- lines")
  const data = Bun.YAML.parse(match[1])
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("frontmatter is not a YAML mapping")
  }
  const fields = data as Record<string, unknown>
  for (const key of ["name", "description"]) {
    if (typeof fields[key] !== "string" || (fields[key] as string).trim() === "") {
      throw new Error(`frontmatter has no string \`${key}\``)
    }
  }
  return fields
}

const skillFiles = [
  ...new Bun.Glob("skills/*/SKILL.md").scanSync({ cwd: root }),
  ...new Bun.Glob("plugins/*/skills/*/SKILL.md").scanSync({ cwd: root }),
].sort()

describe("SKILL.md frontmatter", () => {
  test("finds the skills", () => {
    expect(skillFiles.length).toBeGreaterThan(0)
  })

  for (const file of skillFiles) {
    test(file, async () => {
      const fields = parseFrontmatter(await Bun.file(resolve(root, file)).text())
      expect(fields.name).toBe(file.split("/").at(-2))
    })
  }
})

describe("parseFrontmatter", () => {
  test("accepts a quoted description with a colon and escaped quotes", () => {
    const fields = parseFrontmatter('---\nname: demo\ndescription: "A screen: it says \\"hi\\""\n---\nBody\n')
    expect(fields.description).toBe('A screen: it says "hi"')
  })

  test("rejects an unquoted description with a colon", () => {
    expect(() => parseFrontmatter("---\nname: demo\ndescription: A screen: the rules\n---\n")).toThrow()
  })

  test("rejects a missing frontmatter block", () => {
    expect(() => parseFrontmatter("# No frontmatter\n")).toThrow("no frontmatter block")
  })

  test("rejects frontmatter that is not a mapping", () => {
    expect(() => parseFrontmatter("---\n- a\n- b\n---\n")).toThrow("not a YAML mapping")
  })

  test("rejects a missing or non-string name or description", () => {
    expect(() => parseFrontmatter("---\nname: demo\n---\n")).toThrow("`description`")
    expect(() => parseFrontmatter("---\nname: 3\ndescription: x\n---\n")).toThrow("`name`")
    expect(() => parseFrontmatter('---\nname: demo\ndescription: ""\n---\n')).toThrow("`description`")
  })
})
