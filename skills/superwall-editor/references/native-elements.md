# Superwall Native Elements Guide

When using `write_html`, prefer native `sw-*` elements over generic HTML whenever the UI represents a semantic control. Native elements stay editable, bindable, and tool-aware inside the editor.

## When to use which element

| UI pattern | Element | Key attributes |
|------------|---------|---------------|
| Selectable options, surveys, radio/checkbox cards | `<sw-multiple-choice>` | `selection-mode`, `<sw-option>`, `<sw-choice-item>` |
| Dots, pills, progress bars, step indicators | `<sw-indicator>` | `current-index`, `total-items`, `<sw-indicator-item>` |
| Drawers, bottom sheets | `<sw-drawer>` | `dismissible`, `detents`, `open-state` |
| Date/time pickers | `<sw-picker>` | `picker-style`, `components`, `min-date`, `max-date` |
| Animations | `<sw-lottie>` | `src`, `autoplay`, `loop`, `speed` |
| Multi-page flows | `<sw-navigation>` | `transition`, `<sw-page>` children |

## Native-first rules

- Selectable answers, survey options, radio rows, checkbox rows, tappable choice cards: use `<sw-multiple-choice>`.
- Dots, pills, segmented progress, linear progress bars, onboarding progress: use `<sw-indicator>`.
- Drawers, bottom sheets, slide-over panels: use `<sw-drawer>`.
- Date or time pickers: use `<sw-picker>`.
- Lottie animations: use `<sw-lottie>`.
- Multi-page onboarding or paywall flows: use `<sw-navigation>` with `<sw-page>` children, then wire entry/routes with the dedicated navigation tools.
- Use plain HTML for layout, text, and visuals only when there is no native element that represents the control.

## Multiple choice

Use `<sw-multiple-choice>` for any selectable list. Supply choices with direct `<sw-option>` children.

```html
<sw-multiple-choice selection-mode="single">
  <sw-option label="Cook at home" value="cook-home" />
  <sw-option label="Order delivery" value="delivery" />
  <sw-option label="Eat out" value="eat-out" />
</sw-multiple-choice>
```

If you need a custom repeated row layout, provide at most one direct `<sw-choice-item>` template child:

```html
<sw-multiple-choice selection-mode="single" style="gap:12px;">
  <sw-option label="Starter" value="starter" />
  <sw-option label="Pro" value="pro" />
  <sw-choice-item style="background-color:#ffffff;border-radius:16px;padding:18px 20px;" />
</sw-multiple-choice>
```

Important:

- `<sw-option>` is only valid as a direct child of `<sw-multiple-choice>`.
- `<sw-multiple-choice>` accepts at most one direct `<sw-choice-item>`.
- Do not create one `<sw-choice-item>` per option.
- Any visual or content difference between options should be implemented by dynamically changing child nodes inside the single `<sw-choice-item>` template.
- If the design has selected and unselected states, implement both states explicitly. Selected cards, checkmarks, highlights, borders, icons, and labels should respond correctly to `state:self.isSelected`, and the unselected fallback should also be defined.

### Per-choice specialization

Per-choice icons, subtitles, colors, badges, visibility, and other specialized content are supported through the single template child. Create one `<sw-choice-item>` template, place child SVG/text/container nodes inside it, then call `set_dynamic_value` on those child nodes using self-scoped template state.

Use:

- `state:self.value` to branch by the option value.
- `state:self.label` to branch by label text.
- `state:self.index` to branch by position.
- `state:self.isSelected` to branch by selected state.
- `state:self.isFirst` and `state:self.isLast` for edge-specific layout tweaks.

```html
<sw-multiple-choice selection-mode="single" style="gap:16px;">
  <sw-option label="Improve sleep" value="sleep" />
  <sw-option label="Improve focus" value="focus" />
  <sw-option label="Regulate emotions" value="emotions" />
  <sw-option label="Enhance energy" value="energy" />
  <sw-choice-item style="border-radius:20px;padding:20px;">
    <svg width="40" height="40" viewBox="0 0 40 40"></svg>
    <p>Improve sleep</p>
    <p>Subtitle</p>
    <div style="display:none;">Popular</div>
  </sw-choice-item>
</sw-multiple-choice>
```

Then use `set_dynamic_value` on whatever child properties need specialization (SVG src, subtitle text, background color, badge visibility).

Never solve per-option specialization by creating multiple `sw-choice-item` nodes.

## Indicator

Use `<sw-indicator>` for dots, segments, or progress bars. Style the single repeated `<sw-indicator-item>` template.

```html
<sw-indicator current-index="1" total-items="3" style="width:100%;gap:8px;">
  <sw-indicator-item style="height:6px;border-radius:3px;" />
</sw-indicator>
```

Important:

- `<sw-indicator>` accepts at most one direct `<sw-indicator-item>`.
- Do not create one `<sw-indicator-item>` per segment manually.

Self-scoped fields: `state:self.index`, `state:self.isCurrent`, `state:self.isCompleted`, `state:self.isFirst`, `state:self.isLast`.

## Drawer

```html
<sw-drawer dismissible="true" detents="0.25,0.5,1" background-interactive="false">
  <p>Drawer content</p>
</sw-drawer>
```

Use `open-state="state:..."` when the drawer should bind to an external state.

## Picker

```html
<sw-picker
  picker-style="wheel"
  components="date-and-time"
  minute-interval="5"
  min-date="today"
  max-date="+1 month"
/>
```

Supported `components`: `date`, `date-and-time`, `time`, `time-list`.

## Navigation

Use `<sw-navigation>` for multi-page flows. Each `<sw-page>` child becomes one page.

```html
<sw-navigation transition="push">
  <sw-page data-name="Welcome">
    <p>Welcome</p>
  </sw-page>
  <sw-page data-name="Plans">
    <p>Choose a plan</p>
  </sw-page>
</sw-navigation>
```

After creating structure, use navigation tools:
1. `get_navigation_pages` to discover page IDs
2. `set_navigation_entry_connection` for the starting page
3. `set_navigation_connection` for page-to-page wiring
4. `set_click_behavior` with `navigate-page` direction `next`/`back`

Do not encode routes in HTML. Do not pass target page IDs in click behavior.

## Lottie

```html
<sw-lottie src="https://example.com/animation.json" autoplay loop speed="1.0" />
```

## Constraints

- Leaf nodes (text, image, input, video, svg, lottie, picker) cannot contain children.
- `choice-item` is only valid as the single direct template child of `multiple-choice`.
- `indicator-item` is only valid as the single direct template child of `indicator`.
- Self-scoped template state is only valid inside `choice-item` or `indicator-item` subtrees.
- If a screenshot visually resembles a native control, prefer the native control.
