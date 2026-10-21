# Design tokens (T-04)

Ready to transcribe into `src/ui/styles/tokens.css` (T-08) as CSS custom properties on `:root`. Neutral palette (brief Q4: no branding given). No third-party fonts, no CDN, no inline styles (TL standard 6).

**How ratios were computed:** WCAG 2.2 relative luminance (sRGB linearisation `((c+0.055)/1.055)^2.4`, or `c/12.92` when `c <= 0.04045`; `L = 0.2126R + 0.7152G + 0.0722B`) and ratio `(L1+0.05)/(L2+0.05)`, **rounded down** to 2 decimals. Calculated by hand, not with a tool. Several values match published references (for example #1F2937 on #FFFFFF = 14.68 published, 14.67 here after rounding down). **Not tool-verified:** T-08 or T-17 must confirm them with a contrast checker, and the axe checks in T-16 must pass.

## 1. Colour (light = default; dark = `@media (prefers-color-scheme: dark)`, US-13)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-bg` | `#FFFFFF` | `#111827` | Page background |
| `--color-surface` | `#F3F4F6` | `#1F2937` | Code blocks, row hover, unavailable button |
| `--color-text` | `#1F2937` | `#F9FAFB` | Body text, headings, option text, tags |
| `--color-text-muted` | `#4B5563` | `#D1D5DB` | Hints, counts, topic line |
| `--color-border` | `#6B7280` | `#9CA3AF` | Option rows, code box, unavailable button (dashed) |
| `--color-primary` | `#1D4ED8` | `#93C5FD` | Links, primary button fill, selected border, `accent-color` |
| `--color-primary-hover` | `#1E40AF` | `#BFDBFE` | Primary button hover |
| `--color-on-primary` | `#FFFFFF` | `#111827` | Primary button label |
| `--color-selected-bg` | `#EFF6FF` | `#1E3A8A` | Selected option row (before submit) |
| `--color-success` | `#15803D` | `#86EFAC` | Correct icon and border |
| `--color-success-bg` | `#F0FDF4` | `#052E16` | Correct row, "Correct" feedback panel |
| `--color-danger` | `#B91C1C` | `#FCA5A5` | Wrong-choice icon and border |
| `--color-danger-bg` | `#FEF2F2` | `#450A0A` | Wrong-choice row, "Incorrect" feedback panel |
| `--color-focus` | `#1D4ED8` | `#93C5FD` | Focus ring |

Also set `color-scheme: light` (and `light dark` once the US-13 dark block ships) so that native radios and scrollbars match the theme.

### Contrast pairs (every pair that can appear in the UI)

| # | Foreground / background | Light | Dark | Needed |
| --- | --- | --- | --- | --- |
| 1 | text / bg | 14.67 | 16.97 | 4.5 |
| 2 | text / surface | 13.33 | 14.04 | 4.5 |
| 3 | text / selected-bg | 13.48 | 9.91 | 4.5 |
| 4 | text / success-bg | 14.02 | 14.26 | 4.5 |
| 5 | text / danger-bg | 13.41 | 15.44 | 4.5 |
| 6 | text-muted / bg | 7.55 | 12.03 | 4.5 |
| 7 | text-muted / surface (unavailable Submit) | 6.86 | 9.96 | 4.5 |
| 8 | text-muted / success-bg | 7.21 | 10.11 | 4.5 |
| 9 | text-muted / danger-bg | 6.90 | 10.95 | 4.5 |
| 10 | primary (link, secondary button) / bg | 6.70 | 9.83 | 4.5 |
| 11 | primary / surface | 6.08 | 8.14 | 4.5 |
| 12 | primary (links in feedback) / success-bg | 6.40 | 8.26 | 4.5 |
| 13 | primary / danger-bg | 6.12 | 8.95 | 4.5 |
| 14 | on-primary / primary (button label) | 6.70 | 9.83 | 4.5 |
| 15 | on-primary / primary-hover | 8.72 | 12.48 | 4.5 |
| 16 | success / bg | 5.01 | 12.63 | 4.5 (text-safe) |
| 17 | success / success-bg | 4.79 | 10.61 | 4.5 (text-safe) |
| 18 | danger / bg | 6.47 | 9.34 | 4.5 (text-safe) |
| 19 | danger / danger-bg | 5.91 | 8.50 | 4.5 (text-safe) |
| 20 | border / bg (UI) | 4.83 | 6.98 | 3 |
| 21 | border / surface (UI) | 4.39 | 5.78 | 3 |
| 22 | primary (selected border) / selected-bg (UI) | 6.15 | 5.74 | 3 |
| 23 | focus / bg, surface, success-bg, danger-bg (UI) | = #10, #11, #12, #13 | = #10–#13 | 3 |

Every text pair is at least 4.5:1, so the design never depends on the large-text exemption. Status colours are only used for icons and borders, and they also pass as text.

## 2. Typography (rem-based; root stays at the browser default, never set in px)

| Token | Value |
| --- | --- |
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace` |
| `--font-size-sm` | `0.875rem` (hints, tags, counts) |
| `--font-size-base` | `1rem` (body, buttons) |
| `--font-size-lg` | `1.125rem` (prompt, option text) |
| `--font-size-xl` | `1.25rem` (h2) |
| `--font-size-2xl` | `1.5rem` (h1 below 48em) |
| `--font-size-3xl` | `2rem` (h1 at 48em and above; results score) |
| `--line-height-body` / `-heading` / `-code` | `1.5` / `1.25` / `1.45` |
| `--font-weight-regular` / `-semibold` / `-bold` | `400` / `600` / `700` |

Safe at 200% text size and with text-spacing overrides: no fixed `height` on text containers (use `min-height` only), no `line-clamp`, no truncation; `overflow-wrap: anywhere` on prompts, options and URLs (but not inside `pre`); content width set in rem.

## 3. Spacing, size, radius

| Token | Value | | Token | Value |
| --- | --- | --- | --- | --- |
| `--space-1` | `0.25rem` | | `--space-5` | `1.5rem` |
| `--space-2` | `0.5rem` (minimum gap between targets) | | `--space-6` | `2rem` |
| `--space-3` | `0.75rem` | | `--space-7` | `3rem` |
| `--space-4` | `1rem` | | `--content-max` | `45rem` |
| `--target-min` | `max(44px, 2.75rem)` (US-9.2) | | `--option-min` | `max(48px, 3rem)` |
| `--radius-sm` | `0.25rem` (tags, code) | | `--radius-md` | `0.5rem` (rows, buttons, panels) |
| `--border-width` | `2px` (rows, buttons) | | `--border-width-state` | `3px` (correct / wrong rows), panel left edge `4px` |

## 4. Focus ring

`--focus-ring-width: 3px; --focus-ring-offset: 2px; --focus-ring-color: var(--color-focus)`. Apply with `:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring-color); outline-offset: var(--focus-ring-offset); }`.
- The offset gap always shows the surrounding background, so the ring is measured against bg, surface or panel tint (pairs #10–#13, at least 6.08:1). It is never drawn with `box-shadow` alone, because forced-colours mode removes box shadows.
- Option rows show the ring on the whole row through `.option:has(input:focus-visible)`, with the input's own outline as fallback.
- Not obscured (2.4.11): there are no sticky or fixed elements anywhere. Focusable elements get `scroll-margin-block: var(--space-4)`. Parents of focusable elements must not use `overflow: hidden`, so the ring is never clipped.
- Headings focused by script (`tabindex="-1"`) show no ring, because they are not interactive.

## 5. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | `150ms` | Colour changes on hover/selection |
| `--duration-base` | `200ms` | Opacity fade-in of the feedback panel (no movement) |
| `--easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | |

`@media (prefers-reduced-motion: reduce)` sets both durations to `0ms`. Script uses `scrollIntoView({ behavior: 'auto' })` rather than `'smooth'` when `matchMedia('(prefers-reduced-motion: reduce)')` matches (US-10.5). The loading spinner becomes a static icon, and the text is always present. The spinner also stops when "Still loading" appears (after 10 s, WCAG 2.2.2). Nothing loops or slides.

## 6. Forced colours (`@media (forced-colors: active)`)

- Do not use `forced-color-adjust: none`. Native radios and buttons keep their system colours.
- Option rows, code box and feedback panel: `border-color: CanvasText`. State is still shown by border style (solid for correct, dashed for wrong, dashed for the unavailable button), by the icons (`fill: currentColor`) and by the visible text tags ("Correct answer", "Your answer"), so meaning never depends on colour (US-10.4).
- Focus: `outline-color: Highlight`. Unavailable Submit: `color: GrayText; border-color: GrayText`, plus the visible hint.
- Icons are inline SVG inside components (`aria-hidden="true"`, `focusable="false"`). They are not loaded from a remote URL and are not CSS background images, which forced-colours mode hides.

## 7. Breakpoints (use em in media queries; custom properties cannot be used inside `@media`)

| Name | Query | Change |
| --- | --- | --- |
| base | below 40em (under 640 px) | Single column, inline padding `--space-4`, buttons full width and stacked |
| sm | `(min-width: 40em)` | Buttons inline with auto width (`min-width: 10rem`); topic counts right-aligned |
| md | `(min-width: 48em)` | h1 uses `--font-size-3xl`; inline padding `--space-5` |
| lg | `(min-width: 64em)` | Inline padding `--space-6`; column stays `--content-max`, centred |
| short | `(max-height: 30em)` | Vertical gaps reduced one step; the header stays in normal flow (no sticky elements) |

640x360 landscape matches `sm` + `short`. 400% zoom at 1280 px gives 320 CSS px and matches `base` (+ `short`).
