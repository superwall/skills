# The web-runtime engine (not for surfaces)

`handoffs.ts` and `story-motion.css` are the hand-off engine as it first
shipped, in a hand-rolled web2app runtime that swaps pages itself: it clones
the outgoing page, pins the clone, keys entrances on its own
`data-motion` / `data-flow-transition` / `data-handoff` attributes, and
positions some copies with `position: fixed`.

On a Superwall surface none of that applies. The framework's router swaps
the pages, keeps the leaving one mounted and stamps `data-sw-transition` and
`data-sw-phase` on every layer, so the engine is `../framework/` instead:
no clone, exits and entrances as CSS on those attributes, flights in a
layout-level motion layer. Building a page swapper, a custom router or a
fixed copy on a surface is the wrong build, whatever this code made easy.

Read these files only when the user keeps a flow in their own web runtime
and has declined to move it to a surface.
