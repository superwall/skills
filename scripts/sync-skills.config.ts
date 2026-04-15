export type SyncedSkillFile = {
  source: string
  target: string
}

export type SyncedSkill = {
  name: string
  agentIds: string[]
  directory: string
  skillMd: string
  files: SyncedSkillFile[]
}

const SUPERWALL_EDITOR_AGENT_ID = process.env.SUPERWALL_EDITOR_AGENT_ID ?? ""

const PAYWALL_EDITOR_GUIDE_SKILL_MD = `---
name: paywall-editor-guide
description: Build and edit Superwall paywalls directly via the editor tool set. Covers native sw-* elements, editing workflow, and design standards. Consult references for detail.
---

# Paywall Editor Guide

Tools are invoked directly through the editor — no attachment step. Reach for the reference below that matches the task at hand.

- Editing workflow and when to use which tool: [references/workflow.md](references/workflow.md)
- Native sw-* elements (multiple-choice, indicator, drawer, picker, lottie, navigation): [references/native-elements.md](references/native-elements.md)
- Design standards, review checkpoints, typography, and conversion principles: [references/design.md](references/design.md)

## Orchestration rules

- Prefer semantic tools (\`update_styles\`, \`set_text_content\`, \`set_dynamic_value\`, \`move_nodes\`) over re-running \`write_html\` on existing structure.
- Prefer native \`sw-*\` elements over hand-rolled \`<div>\` recreations when the UI represents a semantic control.
- Screenshot every 2-3 modifications with \`get_screenshot\` to verify before continuing.
- Use \`start_working_on_nodes\` before edits and \`finish_working_on_nodes\` after.
- For multi-page flows, build one page at a time then wire with the navigation tools.
- Products: call \`get_products\` before touching pricing UI; reference via \`{{ products.<name>.<var> }}\`.
`

export const SYNCED_SKILLS: SyncedSkill[] = [
  {
    name: "paywall-editor-guide",
    agentIds: SUPERWALL_EDITOR_AGENT_ID ? [SUPERWALL_EDITOR_AGENT_ID] : [],
    directory: "paywall-editor-guide",
    skillMd: PAYWALL_EDITOR_GUIDE_SKILL_MD,
    files: [
      {
        source: "skills/paywall-editor/references/workflow.md",
        target: "references/workflow.md",
      },
      {
        source: "skills/paywall-editor/references/native-elements.md",
        target: "references/native-elements.md",
      },
      {
        source: "skills/paywall-editor/references/design.md",
        target: "references/design.md",
      },
    ],
  },
]
