# Superwall Paywall Workflow Guide

## Recommended order of operations

1. Decide theming first.
2. If the design needs reusable colors, create only the style variables actually needed.
3. Build the paywall structure with `write_html` and native elements where appropriate.
4. Add products only if the paywall actually needs them.
5. If the paywall is a multi-page flow, build it page by page rather than trying to create and polish every page at once.
6. Connect the pages after the structure exists.
7. Wire tap behaviors after the structure and flow wiring are in place.
8. Add any remaining custom logic, dynamic values, and product-driven behavior last.

## Writing new designs

1. Generate a design brief (color palette, type scale, spacing, direction, CTA style).
2. Call `get_basic_info` to find the page root.
3. Add content in small pieces -- one visual group per `write_html` call.
4. Use `duplicate_nodes` combined with `update_styles` and `set_text_content` for repeated elements.
5. Screenshot and review after every 2-3 additions.

## Editing existing designs

1. Use `get_subtree` to understand the current structure.
2. Use `get_screenshot` to see the current visual state.
3. Prefer semantic edits over `write_html`:
   - `update_styles` for visual changes
   - `set_text_content` for copy changes
   - `move_nodes` for reparenting/repositioning
   - `reorder_children` for sibling order
   - `duplicate_nodes` to create variations of existing elements
   - `find_replace` for bulk changes (like updating all colors)
4. Use `get_style_token_usage` before changing/deleting tokens.
5. Use `bind_style_tokens` when nodes should adopt reusable interface theme tokens.
6. Use `get_products` before working with product-specific pricing UI.
7. Use `get_variables` before building interactive logic.
8. Use `set_dynamic_value` for conditional styles/props. Cases are ordered, first match wins, empty `rules: []` as fallback.
9. Use `set_click_behavior` for tap behavior (purchase, close, restore, open-url, navigate-page, set-state, etc.).
10. Use `write_html` only for genuinely new structure or intentional section replacement.
11. Screenshot and verify after changes.

## Working status indicators

Always use `start_working_on_nodes` before modifications and `finish_working_on_nodes` when done. Use `page:page` for the entire paywall, or specific node IDs for targeted sections.

## Best practices

- Prefer native elements over manual `div` recreations.
- Confirm light mode, dark mode, or both before creating style variables.
- Create reusable style variables only for colors that are actually reused.
- Do not create unused style variables.
- Build first, then specialize. Add dynamic behavior after the base structure exists.
- For multi-page flows, build and verify one page at a time.
- Add tap behaviors explicitly. Do not assume interactive elements are wired just because they are visible.
- Connect pages before wiring tappable elements that move through the flow.
- Set haptics intentionally for interactive elements.
- Prefer a subtle shrink/press animation for buttons and tappable controls.

## Product and eligibility logic

- If the paywall uses products with trials, check whether introductory offer eligibility matters.
- Use `products.hasIntroductoryOffer` when the paywall should show different copy, styling, or branching depending on trial eligibility.
- Ensure the user does not see trial-specific messaging when they are not eligible.
- Product variables use Liquid syntax: `{{ products.<referenceName>.<variable> }}`.
- `get_products` returns `paywallProducts` (on the paywall) with `liquidPrefix` showing the exact Liquid path.
